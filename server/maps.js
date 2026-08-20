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

// `coordsA`/`coordsB` (20 ago 2026): {lat, lng} opcional del lugar EXACTO que el conductor ya
// eligió con el Autocomplete real de Google Maps al elegir la ciudad (ver js/components.js
// wireAutocompleteCiudad, que ya captura lat/lng de la selección pero antes se descartaban). Se
// prefieren sobre el nombre de la ciudad como texto porque hay nombres de ciudad repetidos varias
// veces en Argentina — ej. "San Vicente" existe en Buenos Aires, Misiones, Santa Fe y Salta; hay un
// "General Alvear" en Mendoza (el más conocido) y otro en Buenos Aires — y pedirle a la Distance
// Matrix API "San Vicente, Argentina" sin más contexto puede resolver a la localidad equivocada, o
// no encontrar ruta entre las dos que resolvió, y devolver un error de "no pudimos calcular la
// distancia" aunque las dos ciudades reales sí estén conectadas por ruta. Con lat/lng no hay
// ambigüedad posible: es el punto exacto que Google ya nos devolvió al elegir esa ciudad. Si no
// vienen coordenadas (ej. viajes viejos, o el buscador de ciudades cayó al modo de lista fija sin
// Google Maps), se sigue usando el nombre como texto, igual que antes.
async function distanciaKmEntreCiudades(ciudadA, ciudadB, coordsA, coordsB) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const coordsValidas = (c) => c && typeof c.lat === "number" && typeof c.lng === "number";
  const origenTexto = coordsValidas(coordsA) ? `${coordsA.lat},${coordsA.lng}` : `${ciudadA}, Argentina`;
  const destinoTexto = coordsValidas(coordsB) ? `${coordsB.lat},${coordsB.lng}` : `${ciudadB}, Argentina`;
  const origen = encodeURIComponent(origenTexto);
  const destino = encodeURIComponent(destinoTexto);
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

// Busca lugares reales (estaciones de servicio, terminales, plazas, etc.) con la Places API de
// Google, para elegir el PUNTO DE ENCUENTRO exacto de un viaje (a pedido del usuario, 19 ago 2026:
// "que seleccione el punto de encuentro en google maps y que le aparezca al usuario los puntos de
// encuentro... Todo esto igual a blablacar"). Usa el mismo GOOGLE_MAPS_API_KEY que ya existe — a
// propósito NUNCA se llama a esto desde el navegador directo a Google: el conductor busca desde
// nuestro propio endpoint (server/routes/lugares.js), que llama acá con la key guardada en el
// servidor. Así la key sigue siendo un secreto de servidor, nunca queda expuesta en el código del
// navegador (ver la explicación completa en server/routes/lugares.js).
//
// Devuelve como máximo 5 resultados con nombre, dirección y coordenadas — o [] si no hay resultados
// o la API no está configurada/falla (nunca inventa un lugar).
async function buscarLugares(query) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !query || !query.trim()) return [];

  const q = encodeURIComponent(query.trim());
  // "region=ar" sesga los resultados hacia Argentina (Text Search no soporta restringir el país
  // de forma estricta como sí hace la API de Geocoding/Autocomplete con "components").
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&region=ar&language=es&key=${apiKey}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Google Places Text Search respondió", resp.status);
      return [];
    }
    const data = await resp.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places Text Search status:", data.status, data.error_message || "");
      return [];
    }
    return (data.results || []).slice(0, 5).map((r) => ({
      nombre: r.name,
      direccion: r.formatted_address,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
      place_id: r.place_id,
    }));
  } catch (err) {
    console.error("Error consultando Google Places Text Search:", err.message);
    return [];
  }
}

module.exports = { distanciaKmEntreCiudades, buscarLugares };
