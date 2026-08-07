// api/pricing.js — Motor de cálculo económico de Viaje Compartido (versión async/Postgres).
// Misma lógica que la versión local; ahora getConfig y las funciones que la usan son async
// porque la consulta a la base ahora es una llamada de red a Postgres.
"use strict";

const db = require("./db");

async function getConfig(clave) {
  const row = await db.get("SELECT valor FROM config WHERE clave = ?", [clave]);
  return row ? Number(row.valor) : null;
}

async function calcularPrecioSugerido(distanciaKm, peajesTotal, asientosOfrecidos = 3) {
  const precioNafta = await getConfig("precio_nafta_super");
  const consumoPor100km = await getConfig("consumo_litros_100km");

  const litros = (distanciaKm / 100) * consumoPor100km;
  const costoCombustible = litros * precioNafta;
  const ctoTotal = costoCombustible + peajesTotal;

  const asientos = Math.min(Math.max(Number(asientosOfrecidos) || 3, 1), 4);
  const divisor = asientos >= 4 ? 5 : 4;
  const precioSugerido = ctoTotal / divisor;

  return {
    precioNaftaUsado: precioNafta,
    litrosEstimados: round2(litros),
    costoCombustible: round2(costoCombustible),
    ctoTotal: round2(ctoTotal),
    divisor,
    asientosOfrecidos: asientos,
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
      motivo: `La recaudación total (${recaudacionTotal}) no puede superar el Techo Operativo del viaje (${ctoTotal}). Reglas de la Ruta, punto 4.3.1.`,
      techoAjuste,
      pisoAjuste,
    };
  }

  return { valido: true, techoAjuste, pisoAjuste, recaudacionTotal };
}

async function calcularDesgloseReserva(precioPorAsiento, asientosReservados) {
  const comisionPct = (await getConfig("comision_plataforma_pct")) / 100;
  const montoTotal = round2(precioPorAsiento * asientosReservados);
  const comisionPlataforma = round2(montoTotal * comisionPct);
  const montoConductor = round2(montoTotal - comisionPlataforma);
  return { montoTotal, comisionPlataforma, montoConductor, comisionPct: comisionPct * 100 };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  getConfig,
  calcularPrecioSugerido,
  validarPrecioElegido,
  calcularDesgloseReserva,
  round2,
};
