// api/corredor.js — Distancias/peajes de referencia (respaldo de emergencia) y helpers de camino
// para calcular automáticamente km, peajes y precio SIN que el conductor pueda tocarlos.
//
// Desde el 13 ago 2026 los viajes ya NO tienen que tener a La Plata como origen o destino.
//
// Desde el 19 ago 2026 (a pedido explícito del usuario: "Eso es para los km de las ciudades,
// TODAS!!"), la tabla de abajo YA NO es la fuente principal de distancia para los pares que
// incluyen a La Plata — pasó a ser un respaldo de emergencia. Ahora TODO par de ciudades (incluido
// La Plata ↔ X) se resuelve primero con la Distance Matrix API de Google Maps (cacheada para no
// volver a pagar la misma consulta) — ver server/pricing.js (calcularPorCiudades) para el detalle
// completo de la cascada. La tabla de abajo solo se usa si Google Maps no responde.
//
// Desde el 20 ago 2026 (a pedido explícito del usuario: "Necesito conectar todo a google maps y
// que sea todo a partir de eso"), CIUDADES_CORREDOR YA NO restringe qué ciudades puede elegir el
// conductor — eso ahora lo resuelve el buscador real de Google Maps en el navegador (Places
// Autocomplete, ver js/maps-loader.js). CIUDADES_CORREDOR solo se sigue usando para saber qué
// ciudades tienen una fila en la tabla de respaldo de abajo.
//
// IMPORTANTE: los valores de abajo son ESTIMACIONES de distancia y peaje por ruta, no vienen de
// un mapa real — hay que revisarlos y corregirlos desde el panel de administración (Panel de
// administración → Distancias del corredor) si alguna vez se usan de verdad (o sea, si Google Maps
// llegara a fallar para un par que toca La Plata).
"use strict";

const CIUDAD_BASE = "La Plata";

const CIUDADES_CORREDOR = [
  "La Plata",
  "Chascomús",
  "Rauch",
  "Tandil",
  "Balcarce",
  "Necochea",
  "Luján",
  "Mercedes",
  "Chivilcoy",
  "Bragado",
  "9 de Julio",
  "Carlos Casares",
  "Pehuajó",
  "Trenque Lauquen",
  "Santa Rosa",
  // Agregadas el 10 ago 2026 a pedido del usuario (ciudades intermedias entre La Plata y Santa
  // Rosa/el corredor de Ruta 226): Saladillo, Bolívar y General Alvear (Buenos Aires — hay otra
  // "General Alvear" en Mendoza, no es esa).
  "Saladillo",
  "Bolívar",
  "General Alvear",
];

// Distancia y peaje ESTIMADOS entre La Plata y cada ciudad del corredor (ida). Editable desde el
// panel de administración una vez desplegado — esto es solo el valor inicial de referencia.
const DISTANCIAS_DEFAULT = {
  "Chascomús": { km: 120, peaje: 800 },
  "Rauch": { km: 190, peaje: 1600 },
  "Tandil": { km: 200, peaje: 2400 },
  "Balcarce": { km: 250, peaje: 2800 },
  "Necochea": { km: 330, peaje: 3200 },
  "Luján": { km: 190, peaje: 1800 },
  "Mercedes": { km: 230, peaje: 2200 },
  "Chivilcoy": { km: 270, peaje: 2600 },
  "Bragado": { km: 310, peaje: 3000 },
  "9 de Julio": { km: 350, peaje: 3400 },
  "Carlos Casares": { km: 380, peaje: 3600 },
  "Pehuajó": { km: 420, peaje: 3800 },
  "Trenque Lauquen": { km: 480, peaje: 4200 },
  "Santa Rosa": { km: 600, peaje: 5500 },
  // Estimaciones sacadas de calculadoras de rutas públicas (no de Google Maps — ver nota arriba),
  // igual de "a revisar desde el panel admin" que el resto de la tabla. Fuentes consultadas:
  // ruta0.com y distanciasentre.com (10 ago 2026).
  "Saladillo": { km: 203, peaje: 1900 },
  "Bolívar": { km: 416, peaje: 4000 },
  "General Alvear": { km: 258, peaje: 2500 },
};

// Valida que origen y destino sean dos ciudades distintas y no vacías.
//
// Hasta el 20 ago 2026 esto además exigía que las dos ciudades estuvieran en la lista fija
// CIUDADES_CORREDOR de acá arriba. Se sacó esa restricción a pedido del usuario ("Necesito conectar
// todo a google maps y que sea todo a partir de eso") — ahora el conductor elige la ciudad con el
// buscador real de Google Maps (Places Autocomplete, ver js/maps-loader.js y
// js/components.js wireAutocompleteCiudad), así que cualquier ciudad real de Argentina que Google
// reconozca es válida, no solo las 18 de la lista curada. CIUDADES_CORREDOR y DISTANCIAS_DEFAULT
// se mantienen igual, pero ahora son solo el respaldo de emergencia para pares que tocan La Plata
// cuando Google Maps no puede resolver la distancia (ver server/pricing.js calcularPorCiudades) —
// ya no restringen qué ciudades se pueden elegir.
function validarCiudades(origenCiudad, destinoCiudad) {
  const origen = (origenCiudad || "").trim();
  const destino = (destinoCiudad || "").trim();
  if (!origen || !destino) return { error: "Elegí ciudad de origen y de destino." };
  if (origen === destino) return { error: "El origen y el destino no pueden ser la misma ciudad." };
  return {};
}

// Arma el camino ordenado de un viaje: [origen, ...intermedias en el orden en que el conductor las
// cargó, destino]. A pedido del usuario (19 ago 2026): un viaje "La Plata -> Pehuajó" que pasa por
// "9 de Julio" tiene que poder reservarse también solo para el tramo "9 de Julio -> Pehuajó" — este
// camino es la base para saber qué tramos son válidos dentro de ese viaje (ver resolverTramo).
// Acepta tanto un `viaje` ya parseado (ciudades_intermedias como array) como una fila cruda de la
// base (ciudades_intermedias como el TEXT con el JSON serializado) — así sirve igual en
// server/routes/viajes.js (antes de filaViaje) y en server/routes/reservas.js.
function caminoDelViaje(viaje) {
  const intermedias = Array.isArray(viaje.ciudades_intermedias)
    ? viaje.ciudades_intermedias
    : JSON.parse(viaje.ciudades_intermedias || "[]");
  return [viaje.origen_ciudad, ...intermedias, viaje.destino_ciudad];
}

// Valida que un tramo pedido (origenPedido -> destinoPedido) sea parte del camino real de un viaje
// Y respete el sentido en que viaja el conductor — no se puede reservar "al revés" (ej. un viaje
// La Plata -> Pehuajó no puede reservarse como Pehuajó -> 9 de Julio, aunque las dos ciudades estén
// en el camino). Si no se pide un tramo puntual (faltan origenPedido y/o destinoPedido), devuelve
// el viaje completo — mismo comportamiento que siempre tuvo la app antes de este cambio.
function resolverTramo(camino, origenPedido, destinoPedido) {
  const origen = (origenPedido || camino[0] || "").trim();
  const destino = (destinoPedido || camino[camino.length - 1] || "").trim();
  const idxOrigen = camino.findIndex((c) => c === origen);
  const idxDestino = camino.findIndex((c) => c === destino);
  if (idxOrigen === -1) return { error: `"${origen}" no es parte de la ruta de este viaje.` };
  if (idxDestino === -1) return { error: `"${destino}" no es parte de la ruta de este viaje.` };
  if (idxOrigen >= idxDestino) {
    return {
      error: `Ese tramo no respeta el sentido del viaje (el conductor va de "${camino[0]}" a "${camino[camino.length - 1]}").`,
    };
  }
  const esCompleto = origen === camino[0] && destino === camino[camino.length - 1];
  return { origen, destino, esCompleto };
}

module.exports = { CIUDAD_BASE, CIUDADES_CORREDOR, DISTANCIAS_DEFAULT, validarCiudades, caminoDelViaje, resolverTramo };
