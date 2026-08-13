// server/maps.js — Integración opcional con la Distance Matrix API de Google Maps.
//
// Se usa SOLO para pares de ciudades que no son "La Plata ↔ X" (esos siguen usando la tabla
// curada a mano de server/corredor.js, más precisa y sin costo). Para cualquier otro par —
// viajes entre dos ciudades intermedias del corredor, ej. Tandil ↔ Bolívar — no hay forma de
// tener esa distancia medida a mano de antemano, así que se pide una vez a Google Maps y se
// cachea en la tabla `distancias_cache` (ver server/db.js) para no volver a pagar por la misma
// consulta.
//
// Requiere la variable de entorno GOOGLE_MAPS_API_KEY (proyecto de Google Cloud con facturación
// habilitada — hace falta tarjeta de crédito para generar la key aunque el uso quede dentro del
// crédito gratuito mensual de Google). Ver README.md para el paso a paso de cómo generarla.
//
// Si la variable no está configurada, o la llamada falla por cualquier motivo (red, cuota,
// ciudad no encontrada, etc.), esta función devuelve null — nunca inventa un km a ojo. Quien la
// llama (server/pricing.js) decide qué hacer: por ahora, devolver un error claro en vez de dejar
// publicar el viaje con una distancia inventada.
"use strict";

async function distanciaKmEntreCiudades(ciudadA, ciudadB) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const origen = encodeURIComponent(`${ciudadA}, Argentina`);
  const destino = encodeURIComponent(`${ciudadB}, Argentina`);
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origen}&destinations=${destino}&units=metric&key=${apiKey}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Google Maps Distance Matrix respondió", resp.status);
      return null;
    }
    const data = await resp.json();
    if (data.status !== "OK") {
      console.error("Google Maps Distance Matrix status:", data.status, data.error_message || "");
      return null;
    }
    const elemento = data?.rows?.[0]?.elements?.[0];
    if (!elemento || elemento.status !== "OK" || !elemento.distance) {
      console.error("Google Maps Distance Matrix: no encontró ruta entre", ciudadA, "y", ciudadB, elemento?.status);
      return null;
    }
    const metros = elemento.distance.value;
    return Math.round((metros / 1000) * 10) / 10; // km con 1 decimal
  } catch (err) {
    console.error("Error consultando Google Maps Distance Matrix:", err.message);
    return null;
  }
}

module.exports = { distanciaKmEntreCiudades };
