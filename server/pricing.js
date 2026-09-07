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
// El peaje se calcula así (corregido el 25 ago 2026 — ver más abajo, a pedido explícito del usuario:
// "No me estás sacando bien los peajes, de pehuajo a la plata si, pero ponele alvear no, en un viaje
// corto, sacalos de ruta 0"):
//   1. Si el par toca La Plata y la otra ciudad está en la tabla curada (distancias_corredor), se usa
//      el peaje REAL de esa tabla — verificado a mano contra www.ruta0.com/ruta/argentina/ para la
//      mayoría de las ciudades del corredor (ver claude/ruta-compartida-status.md, proyecto de
//      Claude). Esto pasa SIEMPRE que el par toca La Plata, no solo cuando Google Maps falla — antes
//      (hasta el 24 ago 2026) la tabla curada solo se usaba como respaldo de emergencia, y todo par
//      que tocaba La Plata terminaba usando la estimación plana por km de abajo aunque hubiera un
//      peaje real conocido, lo cual daba resultados muy alejados de la realidad en trayectos cortos
//      con un peaje real chico (ej. La Plata-General Alvear: 258 km × $58/km estimaba ~$14.960, pero
//      el peaje real es una sola cabina de $1.500 — los peajes son un monto fijo por cabina, no
//      proporcional al km, ver la sección de arriba).
//   2. Si no (el par no toca La Plata, o toca La Plata pero la otra ciudad no está en la tabla
//      curada), se estima como km × "peaje_por_km_estimado" (config) — Google Maps no informa costo
//      real de peajes para pares fuera del corredor conocido, así que esto sigue siendo una
//      aproximación de referencia.
//   3. EXCEPCIÓN (07 sep 2026, a pedido explícito del usuario: "pero si voy por saladillo no tengo
//      esos peajes!!"): si el par toca La Plata y la ciudad curada tiene una o más "variantes" de
//      ruta cargadas (`server/corredor.js`, campo `variantes` de esa ciudad), y `ciudadesIntermedias`
//      incluye la ciudad que identifica alguna de esas variantes (ej. "Saladillo"), se usa el km Y
//      el peaje de ESA variante en vez del default de la ciudad — con prioridad absoluta, incluso
//      por sobre Google Maps. Motivo: Google Maps calcula la distancia DIRECTA entre las dos
//      ciudades nombradas (La Plata y el destino), sin ninguna noción de que el auto en realidad
//      pasa por el medio por otra ciudad — así que ni su km ni (mucho menos) su estimación de peaje
//      reflejan la ruta real que el conductor tildó/cargó como intermedia. Ver DISTANCIAS_DEFAULT en
//      server/corredor.js para las variantes cargadas — por ahora solo Pehuajó tiene una (vía
//      Saladillo, verificada contra Ruta0: La Plata-Saladillo 203 km/$1.500 + Saladillo-Pehuajó 236
//      km/$0 = 439 km/$1.500 en total, contra 409 km/$27.806 de la autopista de referencia). El resto
//      de las ciudades del corredor todavía no fueron auditadas para ver si tienen la misma
//      alternativa — queda como gap conocido (ver claude/ruta-compartida-status.md).
// `origenCoords`/`destinoCoords` (20 ago 2026, opcionales): {lat, lng} del lugar exacto que ya
// resolvió el Autocomplete de Google Maps al elegir esa ciudad (ver server/maps.js
// distanciaKmEntreCiudades para el motivo — nombres de ciudad ambiguos como "San Vicente" o
// "General Alvear" pueden resolver mal o fallar si solo se manda el nombre como texto). Solo se
// usan para la llamada real a Google Maps cuando no hay nada cacheado todavía — el cache siempre
// queda indexado por nombre de ciudad, no por coordenadas, así que no cambia nada de lo que ya
// estaba cacheado.
async function calcularPorCiudades(origenCiudad, destinoCiudad, asientosOfrecidos, origenCoords, destinoCoords, ciudadesIntermedias = []) {
  const validado = validarCiudades(origenCiudad, destinoCiudad);
  if (validado.error) return { error: validado.error };

  const origen = origenCiudad.trim();
  const destino = destinoCiudad.trim();

  let km = await getDistanciaCacheada(origen, destino);
  let peaje = null;
  let motivoFalloMaps = null; // 21 ago 2026 — ver el fix en server/maps.js distanciaKmEntreCiudades

  if (km == null) {
    const resultado = await maps.distanciaKmEntreCiudades(origen, destino, origenCoords, destinoCoords);
    km = resultado.km;
    motivoFalloMaps = resultado.motivo;
    if (km != null) await guardarDistanciaCache(origen, destino, km);
  }

  // 25 ago 2026: si el par toca La Plata, se prioriza el peaje REAL de la tabla curada por sobre la
  // estimación plana por km — ver el comentario grande de arriba. Esto corre SIEMPRE que el par toca
  // La Plata (haya o no resuelto Google Maps el km), no solo como respaldo de emergencia.
  const esParLaPlata = origen === CIUDAD_BASE || destino === CIUDAD_BASE;
  if (esParLaPlata) {
    const otraCiudad = origen === CIUDAD_BASE ? destino : origen;
    const distancias = await getDistanciasCorredor();
    const datos = distancias[otraCiudad];
    if (datos) {
      // Variante de ruta real (07 sep 2026, ver comentario grande de arriba) — si alguna de las
      // ciudades intermedias que mandó el cliente coincide con la que identifica una variante
      // cargada para esta ciudad (ej. "Saladillo" para Pehuajó), esa variante manda por sobre TODO
      // lo demás (default de la tabla y Google Maps incluidos), porque es la única fuente que sabe
      // que el auto pasa por el medio por otro lado.
      const variante = Array.isArray(datos.variantes)
        ? datos.variantes.find((v) => ciudadesIntermedias.includes(v.requiereCiudad))
        : null;
      if (variante) {
        peaje = variante.peaje;
        km = variante.km;
      } else {
        peaje = datos.peaje;
        // El km real de Google Maps (si lo hay) sigue teniendo prioridad sobre el km de la tabla
        // curada — la tabla curada solo aporta el km como último recurso, si Google Maps no pudo
        // resolverlo. El peaje, en cambio, siempre sale de la tabla curada cuando hay dato (línea de
        // arriba) porque es más preciso que la estimación por km.
        if (km == null) km = datos.km;
      }
    }
  }

  if (km != null && peaje == null) {
    const peajePorKm = (await getConfig("peaje_por_km_estimado")) || 0;
    peaje = round2(km * peajePorKm);
  }

  if (km == null) {
    // 21 ago 2026: se agrega el motivo real de Google Maps (si lo hay) al final del mensaje — antes
    // decía siempre lo mismo ("probá de nuevo en un rato") sin importar la causa real, lo que hacía
    // imposible diagnosticar un fallo real (ej. una API sin habilitar) sin acceso a los logs del
    // servidor. Nunca se inventa ni se ajusta ningún km/precio con esto, es solo texto informativo.
    const motivo = process.env.GOOGLE_MAPS_API_KEY
      ? "No pudimos calcular la distancia en este momento — probá de nuevo en un rato."
      : "Esta combinación de ciudades todavía no tiene la integración con Google Maps configurada.";
    const detalle = motivoFalloMaps ? ` (Detalle técnico: ${motivoFalloMaps})` : "";
    return { error: `No tenemos la distancia entre "${origen}" y "${destino}". ${motivo}${detalle}` };
  }

  const calculo = await calcularPrecioSugerido(km, peaje, asientosOfrecidos);
  return { ...calculo, distanciaKm: km, peajesEstimados: peaje, origenCiudad: origen, destinoCiudad: destino };
}

async function calcularPrecioSugerido(distanciaKm, peajesTotal, asientosOfrecidos = 3) {
  // La clave de config se llama "precio_nafta_super" desde siempre. El 21 ago 2026 se había cambiado
  // el LABEL (no el número) a "Nafta V Power", a pedido del usuario de ese momento ("que el calculo
  // sea sobre nafta v power") — el 07 sep 2026, a pedido explícito del usuario ("Quiero el precio de
  // nafta super, osea que los viajes se calculen con precio de super"), el label volvió a "Nafta
  // Súper" en el panel admin ("Valores de referencia") y en Reglas de la Ruta, para que quede claro
  // que el cálculo usa el precio de la nafta Súper (no la premium/V Power). El NÚMERO en sí
  // ($/litro) NO se tocó en ninguno de los dos cambios — por la regla "OJO CON LOS PRECIOS" (nunca
  // inventar/ajustar un valor de precio a partir de lo que dice el chat), el admin es quien tiene que
  // cargar a mano, desde el panel, el $/litro real de la nafta Súper vigente si el valor guardado
  // todavía refleja el precio de V Power (más caro) que se pudo haber cargado mientras el label decía
  // eso.
  const precioNafta = await getConfig("precio_nafta_super");
  const consumoPor100km = await getConfig("consumo_litros_100km");
  const precioMinimoPorKm = (await getConfig("precio_minimo_por_km")) || 0;
  const precioMinimoBase = (await getConfig("precio_minimo_base")) || 0;

  const litros = (distanciaKm / 100) * consumoPor100km;
  const costoCombustible = litros * precioNafta;
  const ctoTotal = costoCombustible + peajesTotal;

  // Divisor FIJO en 4 (21 ago 2026, a pedido explícito del usuario: "No me cambies el precio por
  // cantidad de personas que viajan! Es segun la nafta y los km que te pase, el minimo y nada
  // mas"). Hasta acá, si el conductor ofrecía el 4to asiento el divisor pasaba a 5 ("reprorrateo
  // entre 5" del algoritmo original, ver claude/viaje-compartido-app-v1.md) — eso hacía que el
  // precio SUGERIDO por asiento bajara solo por ofrecer más asientos, sin que cambiara nada del
  // costo real del viaje (misma nafta, mismos peajes, mismos km). El usuario decidió sacar esa
  // variación: el precio por asiento ahora sale SIEMPRE de (nafta + peajes) ÷ 4, sea que el auto
  // ofrezca 3 o 4 asientos — nunca depende de `asientosOfrecidos`. `asientos` se sigue calculando y
  // devolviendo (clamp 1-4) porque otras partes de la app lo siguen usando para mostrar cuántos
  // asientos tiene el viaje, pero ya no participa en la cuenta del precio.
  const asientos = Math.min(Math.max(Number(asientosOfrecidos) || 3, 1), 4);
  const divisor = 4;
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
