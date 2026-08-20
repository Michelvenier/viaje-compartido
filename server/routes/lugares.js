// server/routes/lugares.js — Búsqueda de lugares reales (estaciones de servicio, terminales,
// plazas, etc.) para elegir el punto de encuentro exacto de un viaje, y entrega de la clave de
// Google Maps para uso en el navegador (ver mapsKey más abajo).
//
// Hasta el 20 ago 2026, esta búsqueda pasaba SIEMPRE por este endpoint propio para que ninguna key
// de Google llegara al navegador. Ese día el usuario pidió explícitamente lo contrario ("Necesito
// conectar todo a google maps y que sea todo a partir de eso... si se ve la clave la
// restringiremos de alguna manera, porque tengo mil problemas sin google maps"): ahora el
// navegador SÍ usa la API de JavaScript de Google Maps directamente (Autocomplete real, con mapa
// interactivo) para origen, destino, ciudades intermedias y el punto de partida — ver
// js/maps-loader.js y GOOGLE_MAPS_BROWSER_KEY más abajo. Esta búsqueda por texto server-side se
// deja como está (no rompe nada) para el buscador de puntos de encuentro por ciudad ya construido
// (ver js/components.js puntoEncuentroEditarHtml) — sigue funcionando igual, sin necesitar la key
// del navegador.
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

module.exports = { buscar, mapsKey };
