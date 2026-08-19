// api/pricing.js — Motor de cálculo económico de Ruta Compartida (versión async/Postgres).
// Misma lógica que la versión local; ahora getConfig y las funciones que la usan son async
// porque la consulta a la base ahora es una llamada de red a Postgres.
"use strict";

const db = require("./db");
const maps = require("./maps");
const { nowIso } = require("./helpers");
const { validarCiudades, DISTANCIAS_DEFAULT, CIUDAD_BASE } = require("./corredor");

async function getConfig(clave) {
  const row = await db.get("SELECT valor FROM config WHERE clave = ?", [clave]);
  return row ? Number(row.valor) : null;
}

// Único lugar que decide "¿faltan menos de 24 hs para la salida?" — lo usan tanto la política de
// reembolso al pasajero (server/routes/reservas.js) como la penalización a la cuenta corriente del
// conductor cuando cancela un viaje (server/routes/viajes.js), para que el mismo límite de tiempo
// se calcule siempre igual en los dos lugares.
function faltanMenosDe24Hs(viaje) {
  const salida = new Date(`${viaje.fecha_salida}T${viaje.hora_salida}:00`);
  if (Number.isNaN(salida.getTime())) return false; // si no se puede determinar la fecha, no penalizamos
  const msHastaSalida = salida.getTime() - Date.now();
  return msHastaSalida < 24 * 60 * 60 * 1000;
}

// Se completa con DISTANCIAS_DEFAULT (server/corredor.js) cualquier ciudad que todavía no esté
// guardada en la base — pasa cuando se agrega una ciudad nueva al código después de que esta base
// ya tenía su fila de config sembrada (el seed inicial no vuelve a correr). Así una ciudad nueva
// funciona para calcular precios apenas se despliega, sin esperar a que alguien abra el panel de
// admin y guarde — el admin igual puede corregir el valor de referencia cuando quiera, y esa
// corrección sí queda en la base y tiene prioridad sobre el default del código.
async function getDistanciasCorredor() {
  const row = await db.get("SELECT valor FROM config WHERE clave = ?", ["distancias_corredor"]);
  const guardado = row ? JSON.parse(row.valor) : {};
  return { ...DISTANCIAS_DEFAULT, ...guardado };
}

// Busca (y guarda) en distancias_cache el km de un par de ciudades ya consultado antes a Google
// Maps, para no volver a pagar por la misma consulta. Se guarda siempre en orden alfabético para
// que el par funcione en cualquier sentido (origen/destino intercambiados = misma fila).
async function getDistanciaCacheada(ciudadA, ciudadB) {
  const [a, b] = [ciudadA, ciudadB].sort();
  const row = await db.get("SELECT km FROM distancias_cache WHERE ciudad_a = ? AND ciudad_b = ?", [a, b]);
  return row ? Number(row.km) : null;
}
async function guardarDistanciaCache(ciudadA, ciudadB, km) {
  const [a, b] = [ciudadA, ciudadB].sort();
  await db.run(
    `INSERT INTO distancias_cache (ciudad_a, ciudad_b, km, fuente, created_at) VALUES (?,?,?,?,?)
     ON CONFLICT (ciudad_a, ciudad_b) DO UPDATE SET km = EXCLUDED.km, created_at = EXCLUDED.created_at`,
    [a, b, km, "google_maps", nowIso()]
  );
}

// Calcula distancia, peajes y precio de forma 100% automática a partir de las ciudades elegidas —
// nadie (ni el conductor) puede tocar el km ni el precio: ambos salen siempre de esta cascada y de
// calcularPrecioSugerido(). Desde el 19 ago 2026, a pedido explícito del usuario ("Eso es para los
// km de las ciudades, TODAS!!"), Google Maps es la fuente PRINCIPAL de distancia para cualquier par
// de ciudades del corredor, incluidos los pares que tocan La Plata — antes esos pares usaban
// siempre la tabla curada a mano y nunca consultaban a Google Maps:
//   1. distancias_cache (Postgres): si ya se consultó antes este par (con cualquiera de las dos
//      fuentes de abajo), se reusa sin volver a pagar/consultar. Se guarda siempre en orden
//      alfabético, así que sirve para cualquier par, incluido La Plata ↔ X.
//   2. Google Maps Distance Matrix API (server/maps.js): fuente principal para TODO par nuevo. El
//      resultado se guarda en el cache de arriba para la próxima vez.
//   3. Tabla curada a mano (distancias_corredor) — SOLO como respaldo de emergencia, y SOLO para
//      pares que incluyen a La Plata (es la única tabla que existe): se usa nada más si Google Maps
//      falla o no está configurado, para que la app no se quede sin poder calcular un viaje
//      La Plata ↔ X por un problema puntual de la API. Mientras Google Maps responda, nunca se usa.
//   4. Si no hay nada cacheado, Google Maps no está configurado (o falla) y no hay tabla curada
//      para ese par (o el par no toca La Plata), se devuelve un error claro en vez de inventar un
//      km.
// El peaje SIEMPRE se estima como km × "peaje_por_km_estimado" (config) cuando el km viene de cache
// o de Google Maps, porque ninguna de las dos fuentes informa costo real de peajes — solo cuando se
// cae al respaldo de la tabla curada se usa el peaje que también viene cargado ahí a mano.
async function calcularPorCiudades(origenCiudad, destinoCiudad, asientosOfrecidos) {
  const validado = validarCiudades(origenCiudad, destinoCiudad);
  if (validado.error) return { error: validado.error };

  const origen = origenCiudad.trim();
  const destino = destinoCiudad.trim();

  let km = await getDistanciaCacheada(origen, destino);
  let peaje = null;

  if (km == null) {
    km = await maps.distanciaKmEntreCiudades(origen, destino);
    if (km != null) await guardarDistanciaCache(origen, destino, km);
  }

  if (km != null) {
    const peajePorKm = (await getConfig("peaje_por_km_estimado")) || 0;
    peaje = round2(km * peajePorKm);
  } else {
    // Respaldo de emergencia: solo para pares que tocan La Plata, y solo si Google Maps no pudo
    // resolverlo (sin key configurada, cuota agotada, o un error puntual de la API).
    const esParLaPlata = origen === CIUDAD_BASE || destino === CIUDAD_BASE;
    if (esParLaPlata) {
      const otraCiudad = origen === CIUDAD_BASE ? destino : origen;
      const distancias = await getDistanciasCorredor();
      const datos = distancias[otraCiudad];
      if (datos) {
        km = datos.km;
        peaje = datos.peaje;
      }
    }
  }

  if (km == null) {
    const motivo = process.env.GOOGLE_MAPS_API_KEY
      ? "No pudimos calcular la distancia en este momento — probá de nuevo en un rato."
      : "Esta combinación de ciudades todavía no tiene la integración con Google Maps configurada.";
    return { error: `No tenemos la distancia entre "${origen}" y "${destino}". ${motivo}` };
  }

  const calculo = await calcularPrecioSugerido(km, peaje, asientosOfrecidos);
  return { ...calculo, distanciaKm: km, peajesEstimados: peaje, origenCiudad: origen, destinoCiudad: destino };
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
  faltanMenosDe24Hs,
  calcularPrecioSugerido,
  calcularPorCiudades,
  validarPrecioElegido,
  calcularDesgloseReserva,
  round2,
};
