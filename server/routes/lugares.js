// server/routes/lugares.js — Búsqueda de lugares reales (estaciones de servicio, terminales,
// plazas, etc.) para elegir el punto de encuentro exacto de un viaje, detección automática de las
// ciudades intermedias de una ruta (ver ruta() más abajo), y entrega de la clave de Google Maps
// para uso en el navegador (ver mapsKey más abajo).
//
// Hasta el 20 ago 2026, la búsqueda de lugares pasaba SIEMPRE por este endpoint propio para que
// ninguna key de Google llegara al navegador. Ese día el usuario pidió explícitamente lo contrario
// ("Necesito conectar todo a google maps y que sea todo a partir de eso... si se ve la clave la
// restringiremos de alguna manera, porque tengo mil problemas sin google maps"): ahora el
// navegador SÍ usa la API de JavaScript de Google Maps directamente (Autocomplete real para elegir
// origen, destino y ciudades intermedias a mano si hace falta) — ver js/maps-loader.js y
// GOOGLE_MAPS_BROWSER_KEY más abajo. Esta búsqueda de lugares por texto (buscar()) y la detección
// de ciudades en ruta (ruta()) siguen siendo server-side (usan GOOGLE_MAPS_API_KEY, no la key del
// navegador) porque llaman a APIs de Google que no tienen versión "cliente" en la librería de
// JavaScript (Places Text Search, Directions, Geocoding inverso).
"use strict";

const maps = require("../maps");
const { ok, badRequest } = require("../helpers");

// GET /api/lugares/buscar?q=... — devuelve hasta 5 lugares candidatos (nombre, dirección, lat,
// lng, place_id) para que el conductor elija el punto de encuentro exacto de una ciudad (origen,
// destino, o una de las ciudades intermedias). A propósito SIN adminOnly ni sesión: mismo nivel de
// confianza que el resto de esta app (ver server/blob.js subir() para la misma explicación).
async function buscar(req, res, params, query) {
  const q = (query.q || "").trim();
  if (!q) return badRequest(res, "Escribí qué lugar buscás (ej. una estación de servicio o una plaza).");
  const resultados = await maps.buscarLugares(q);
  ok(res, { resultados });
}

// GET /api/lugares/ruta?origen_lat=...&origen_lng=...&destino_lat=...&destino_lng=...&origen_ciudad=
// ...&destino_ciudad=... — a pedido del usuario (20 ago 2026, "que lo elija el chofer" reiterado el
// 21 ago 2026): calcula automáticamente las ciudades por las que pasa CADA camino real distinto
// entre origen y destino (Directions con alternativas + Geocoding inverso, ver server/maps.js
// ciudadesEnRuta), para que el conductor NO tenga que agregarlas a mano y pueda elegir cuál ruta va
// a hacer realmente cuando hay más de una opción (ej. Pehuajó → La Plata por Chivilcoy o por
// Bolívar/Saladillo). Sin sesión a propósito, mismo criterio que buscar()/mapsKey() de acá
// arriba/abajo. Devuelve { disponible, rutas } — ver el comentario de ciudadesEnRuta en
// server/maps.js para el significado exacto de cada caso; el frontend (js/views.js viewPublicar)
// cae al modo manual de siempre cuando disponible=false.
async function ruta(req, res, params, query) {
  const num = (v) => (v === undefined || v === null || v === "" ? NaN : Number(v));
  const origenCoords = { lat: num(query.origen_lat), lng: num(query.origen_lng) };
  const destinoCoords = { lat: num(query.destino_lat), lng: num(query.destino_lng) };
  if (Number.isNaN(origenCoords.lat) || Number.isNaN(origenCoords.lng) || Number.isNaN(destinoCoords.lat) || Number.isNaN(destinoCoords.lng)) {
    return badRequest(res, "Faltan las coordenadas de origen y/o destino.");
  }
  const resultado = await maps.ciudadesEnRuta(origenCoords, destinoCoords, query.origen_ciudad, query.destino_ciudad);
  ok(res, resultado);
}

// GET /api/lugares/maps-key — entrega la clave de Google Maps para uso EN EL NAVEGADOR (carga de
// la API de JavaScript de Maps con Autocomplete real, mapa interactivo, etc.).
//
// A propósito es una clave DISTINTA de GOOGLE_MAPS_API_KEY (la que usa este servidor para Distance
// Matrix y Places Text Search) — nunca hay que reusar la misma key para las dos cosas: la del
// navegador tiene que estar restringida en Google Cloud Console por "HTTP referrers" (el dominio
// de Vercel del proyecto, ej. "https://viaje-compartido-5nhl.vercel.app/*"), y una key restringida
// así NO funciona desde el servidor (las llamadas server-to-server no mandan un header Referer de
// navegador que matchee esa restricción). Se guarda en Vercel como GOOGLE_MAPS_BROWSER_KEY — ver
// claude/ruta-compartida-status.md para el paso a paso de cómo crearla y restringirla.
//
// Sin sesión ni adminOnly a propósito (cualquiera que abra la app tiene que poder cargar el mapa) —
// mismo criterio que GET /api/config/cobro (server/routes/admin.js). Si la variable no está
// configurada todavía, devuelve apiKey: null — el frontend cae a los selects/inputs de texto de
// siempre en vez de romperse (ver js/maps-loader.js).
async function mapsKey(req, res) {
  ok(res, { apiKey: process.env.GOOGLE_MAPS_BROWSER_KEY || null });
}

module.exports = { buscar, ruta, mapsKey };
