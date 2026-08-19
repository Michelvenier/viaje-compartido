// server/routes/lugares.js — Búsqueda de lugares reales (estaciones de servicio, terminales,
// plazas, etc.) para elegir el punto de encuentro exacto de un viaje (a pedido del usuario, 19 ago
// 2026: "que seleccione el punto de encuentro en google maps... Todo esto igual a blablacar").
//
// POR QUÉ ESTE ENDPOINT PROPIO Y NO LLAMAR A GOOGLE DIRECTO DESDE EL NAVEGADOR: el usuario pidió
// explícitamente NO exponer ninguna clave de Google en el código del navegador (a diferencia del
// mapa interactivo tipo "arrastrar el pin", que sí necesita eso). Con este endpoint, el navegador
// le pregunta a NUESTRO servidor ("¿qué lugares hay para 'YPF ruta 5 9 de Julio'?"), y es el
// servidor el que consulta a Google con la key guardada en Vercel (GOOGLE_MAPS_API_KEY, la misma
// que ya se usa para calcular distancias) — la key nunca sale del servidor, mismo patrón que ya
// usa el resto de la integración con Google Maps (ver server/maps.js).
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

module.exports = { buscar };
