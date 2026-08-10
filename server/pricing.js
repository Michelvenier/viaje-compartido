// api/pricing.js — Motor de cálculo económico de Ruta Compartida (versión async/Postgres).
// Misma lógica que la versión local; ahora getConfig y las funciones que la usan son async
// porque la consulta a la base ahora es una llamada de red a Postgres.
"use strict";

const db = require("./db");
const { resolverOtraCiudad } = require("./corredor");

async function getConfig(clave) {
  const row = await db.get("SELECT valor FROM config WHERE clave = ?", [clave]);
  return row ? Number(row.valor) : null;
}

async function getDistanciasCorredor() {
  const row = await db.get("SELECT valor FROM config WHERE clave = ?", ["distancias_corredor"]);
  return row ? JSON.parse(row.valor) : {};
}

// Calcula distancia, peajes y precio de forma 100% automática a partir de las ciudades elegidas —
// nadie (ni el conductor) puede tocar el km ni el precio: ambos salen siempre de esta tabla y de
// calcularPrecioSugerido(). Ver api/corredor.js para el porqué de la tabla fija en vez de una API
// externa de mapas.
async function calcularPorCiudades(origenCiudad, destinoCiudad, asientosOfrecidos) {
  const resuelto = resolverOtraCiudad(origenCiudad, destinoCiudad);
  if (resuelto.error) return { error: resuelto.error };

  const distancias = await getDistanciasCorredor();
  const datos = distancias[resuelto.otraCiudad];
  if (!datos) return { error: `No tenemos todavía la distancia de referencia para "${resuelto.otraCiudad}".` };

  const calculo = await calcularPrecioSugerido(datos.km, datos.peaje, asientosOfrecidos);
  return { ...calculo, distanciaKm: datos.km, peajesEstimados: datos.peaje, otraCiudad: resuelto.otraCiudad };
}

async function calcularPrecioSugerido(distanciaKm, peajesTotal, asientosOfrecidos = 3) {
  const precioNafta = await getConfig("precio_nafta_super");
  const consumoPor100km = await getConfig("consumo_litros_100km");
  const precioMinimoPorKm = (await getConfig("precio_minimo_por_km")) || 0;
  const precioMinimoBase = (await getConfig("precio_minimo_base")) || 0;

  const litros = (distanciaKm / 100) * consumoPor100km;
  const costoCombustible = litros * precioNafta;
  const ctoTotal = costoCombustible + peajesTotal;

  const asientos = Math.min(Math.max(Number(asientosOfrecidos) || 3, 1), 4);
  const divisor = asientos >= 4 ? 5 : 4;
  const precioPorCosto = ctoTotal / divisor;

  // Piso mínimo por asiento: nunca menos que precioMinimoBase (tarifa mínima para trayectos
  // cortos) ni menos que distanciaKm × precioMinimoPorKm (para que los trayectos largos escalen).
  // Con los valores default ($12.000 de base y $52/km), un viaje de hasta ~230 km paga el mínimo
  // base de $12.000, y a partir de ahí escala por km — a los 500 km da exactamente $26.000.
  // Si el cálculo por costo real (nafta + peajes) da más que ambos pisos, se respeta ese valor.
  const precioPiso = Math.max(precioMinimoBase, distanciaKm * precioMinimoPorKm);
  const precioSugerido = Math.max(precioPorCosto, precioPiso);

  return {
    precioNaftaUsado: precioNafta,
    litrosEstimados: round2(litros),
    costoCombustible: round2(costoCombustible),
    ctoTotal: round2(ctoTotal),
    divisor,
    asientosOfrecidos: asientos,
    precioPorCosto: round2(precioPorCosto),
    precioPiso: round2(precioPiso),
    precioSugerido: round2(precioSugerido),
  };
}

async function validarPrecioElegido({ precioSugerido, precioElegido, ctoTotal, asientosOfrecidos }) {
  const tolerancia = (await getConfig("tolerancia_ajuste_pct")) / 100;
  const techoAjuste = round2(precioSugerido * (1 + tolerancia));
  const pisoAjuste = round2(precioSugerido * (1 - tolerancia));

  if (precioElegido > techoAjuste) {
    return {
      valido: false,
      motivo: `El precio no puede superar el sugerido en más de un ${tolerancia * 100}% (máximo permitido: $${techoAjuste} por asiento).`,
      techoAjuste,
      pisoAjuste,
    };
  }
  if (precioElegido < pisoAjuste * 0.5) {
    return {
      valido: false,
      motivo: "El precio ingresado es demasiado bajo para representar un gasto real del trayecto.",
      techoAjuste,
      pisoAjuste,
    };
  }

  const recaudacionTotal = round2(precioElegido * asientosOfrecidos);
  if (recaudacionTotal > ctoTotal) {
    return {
      valido: false,
      motivo: `La recaudación total (${recaudacionTotal}) no puede superar el Techo Operativo del viaje (${ctoTotal}). Reglas de la Ruta, punto 3.`,
      techoAjuste,
      pisoAjuste,
    };
  }

  return { valido: true, techoAjuste, pisoAjuste, recaudacionTotal };
}

// Modelo de cobro: el pasajero le paga a Ruta Compartida SOLO la comisión de intermediación
// (10% del costo compartido, con un mínimo de $2.000). El resto ("montoConductor") no lo cobra
// la plataforma: el pasajero se lo transfiere directamente al conductor (por transferencia o QR
// a su alias de Mercado Pago) al momento del viaje. Así la plataforma solo factura su comisión.
async function calcularDesgloseReserva(precioPorAsiento, asientosReservados) {
  const comisionPct = (await getConfig("comision_plataforma_pct")) / 100;
  const comisionMinima = (await getConfig("comision_minima")) || 0;
  const montoTotal = round2(precioPorAsiento * asientosReservados);
  const comisionPlataforma = round2(Math.max(montoTotal * comisionPct, comisionMinima));
  const montoConductor = round2(montoTotal - comisionPlataforma);
  return { montoTotal, comisionPlataforma, montoConductor, comisionPct: comisionPct * 100, comisionMinima };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  getConfig,
  getDistanciasCorredor,
  calcularPrecioSugerido,
  calcularPorCiudades,
  validarPrecioElegido,
  calcularDesgloseReserva,
  round2,
};
