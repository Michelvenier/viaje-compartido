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

// ---------------------------------------------------------------------------
// CIUDADES A LO LARGO DE UNA RUTA — a pedido del usuario (20 ago 2026): "NO QUIERO QUE EL CHOFER
// TENGA QUE AGREGAR LA CIUDAD INTERMEDIA, QUE LO TOME DE GOOGLE MAPS SOLO LA APLICACION, SEGUN LA
// RUTA QUE ELIJA EL CHOFER". Google Maps no tiene un endpoint que devuelva directamente "la lista
// de ciudades por las que pasa esta ruta" — hay que armarlo con dos APIs:
//   1. Directions API: le pedimos la ruta real entre el origen y el destino (lat/lng exactos, los
//      mismos que ya elige el Autocomplete de ciudades) — devuelve una polyline codificada con la
//      forma exacta del camino.
//   2. Se "muestrea" esa polyline cada cierta distancia (ver muestrearPuntos) y cada punto muestreado
//      se manda a la Geocoding API en modo REVERSO (lat/lng -> nombre de lugar) para saber qué
//      ciudad/localidad hay ahí.
// Ninguna de las dos son la misma API que ya se usaba (Distance Matrix, Places Text Search) — hay
// que habilitarlas aparte en Google Cloud Console (mismo proyecto, misma GOOGLE_MAPS_API_KEY del
// servidor) antes de que esto funcione. Mientras no estén habilitadas (o falle la consulta por
// cualquier motivo), se devuelve { disponible: false, ciudades: [] } y quien llama (server/routes/
// lugares.js, js/views.js viewPublicar) cae al modo manual de siempre (buscar y agregar cada
// ciudad intermedia a mano) — nunca se rompe la publicación por esto.
// ---------------------------------------------------------------------------

// Distancia entre dos puntos {lat,lng} en km (fórmula de haversine) — se usa solo para decidir
// cada cuántos km "muestrear" la polyline de la ruta, nunca para el precio del viaje (eso sigue
// siendo 100% Distance Matrix API, ver distanciaKmEntreCiudades arriba).
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Decodifica una "encoded polyline" de Google (algoritmo estándar de Google Maps) a una lista de
// puntos {lat, lng} en orden. No depende de ninguna librería externa.
function decodePolyline(encoded) {
  const puntos = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    puntos.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return puntos;
}

// Elige hasta `maxPuntos` puntos de la polyline, espaciados de forma pareja a lo largo de TODA la
// ruta (nunca solo el primer tramo) — si la ruta es más corta que `minEspaciadoKm`, no tiene
// sentido buscar intermedias y devuelve [].
function muestrearPuntos(polyline, maxPuntos, minEspaciadoKm) {
  let totalKm = 0;
  for (let i = 1; i < polyline.length; i++) totalKm += haversineKm(polyline[i - 1], polyline[i]);
  if (totalKm < minEspaciadoKm) return [];

  const espaciado = Math.max(minEspaciadoKm, totalKm / (maxPuntos + 1));
  const puntos = [];
  let acumulado = 0;
  let objetivo = espaciado;
  for (let i = 1; i < polyline.length && puntos.length < maxPuntos; i++) {
    acumulado += haversineKm(polyline[i - 1], polyline[i]);
    if (acumulado >= objetivo) {
      puntos.push(polyline[i]);
      objetivo += espaciado;
    }
  }
  return puntos;
}

function normalizarNombre(s) {
  return (s || "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Geocoding inverso de UN punto {lat,lng} -> nombre de localidad, o null si no se pudo resolver.
// Mismo criterio de extracción que el Autocomplete del navegador (js/components.js
// wireAutocompleteCiudad): prioriza "locality", cae a "administrative_area_level_2" (partido) si
// no hay.
async function nombreLocalidadEnPunto(apiKey, punto) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${punto.lat},${punto.lng}&language=es&key=${apiKey}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status !== "OK") return null;
    for (const resultado of data.results || []) {
      const comps = resultado.address_components || [];
      const locality = comps.find((c) => c.types.includes("locality"));
      const partido = comps.find((c) => c.types.includes("administrative_area_level_2"));
      const nombre = (locality || partido || {}).long_name;
      if (nombre) return nombre;
    }
    return null;
  } catch (err) {
    console.error("Error en reverse geocoding:", err.message);
    return null;
  }
}

const RUTA_MAX_PUNTOS = 12; // tope de llamadas a Geocoding por viaje publicado, para no disparar el costo
const RUTA_MIN_ESPACIADO_KM = 15; // no tiene sentido muestrear más seguido que esto

// Calcula las ciudades por las que pasa la ruta real entre origenCoords y destinoCoords (ambos
// {lat, lng}, los mismos que ya resuelve el Autocomplete de ciudades del navegador). Devuelve
// { disponible, ciudades }:
//   - disponible=false: la función no pudo correr (key sin configurar, Directions/Geocoding APIs
//     no habilitadas, error de red, etc.) — quien llama tiene que caer al modo manual de siempre.
//   - disponible=true, ciudades=[]: la ruta se calculó bien pero es corta o no se detectó ninguna
//     localidad relevante en el camino — es un resultado válido, no un error.
//   - disponible=true, ciudades=[{nombre,lat,lng}, ...]: en el orden real en que se encuentran
//     yendo de origen a destino. Nunca incluye al origen ni al destino mismos.
async function ciudadesEnRuta(origenCoords, destinoCoords, origenCiudad, destinoCiudad) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const coordsValidas = (c) => c && typeof c.lat === "number" && typeof c.lng === "number";
  if (!apiKey || !coordsValidas(origenCoords) || !coordsValidas(destinoCoords)) {
    return { disponible: false, ciudades: [] };
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origenCoords.lat},${origenCoords.lng}&destination=${destinoCoords.lat},${destinoCoords.lng}&key=${apiKey}`;
  let data;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error("Google Directions respondió", resp.status);
      return { disponible: false, ciudades: [] };
    }
    data = await resp.json();
  } catch (err) {
    console.error("Error consultando Google Directions:", err.message);
    return { disponible: false, ciudades: [] };
  }
  if (data.status !== "OK" || !data.routes || !data.routes[0]) {
    console.error("Google Directions status:", data.status, data.error_message || "");
    return { disponible: false, ciudades: [] };
  }

  const encoded = data.routes[0].overview_polyline && data.routes[0].overview_polyline.points;
  if (!encoded) return { disponible: false, ciudades: [] };
  const polyline = decodePolyline(encoded);
  if (polyline.length < 2) return { disponible: true, ciudades: [] };

  const puntosMuestra = muestrearPuntos(polyline, RUTA_MAX_PUNTOS, RUTA_MIN_ESPACIADO_KM);
  if (!puntosMuestra.length) return { disponible: true, ciudades: [] };

  const conNombre = await Promise.all(
    puntosMuestra.map(async (p) => ({ ...p, nombre: await nombreLocalidadEnPunto(apiKey, p) }))
  );

  const vistos = new Set([normalizarNombre(origenCiudad), normalizarNombre(destinoCiudad)]);
  const ciudades = [];
  for (const p of conNombre) {
    if (!p.nombre) continue;
    const norm = normalizarNombre(p.nombre);
    if (vistos.has(norm)) continue;
    vistos.add(norm);
    ciudades.push({ nombre: p.nombre, lat: p.lat, lng: p.lng });
  }
  return { disponible: true, ciudades };
}

module.exports = { distanciaKmEntreCiudades, buscarLugares, ciudadesEnRuta };
