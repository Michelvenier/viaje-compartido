// api/corredor.js — Ciudades habilitadas y distancias/peajes de referencia del corredor,
// para calcular automáticamente km, peajes y precio SIN que el conductor pueda tocarlos.
//
// Desde el 13 ago 2026 los viajes ya NO tienen que tener a La Plata como origen o destino: se
// puede viajar entre dos ciudades intermedias del corredor (ej. Tandil ↔ Bolívar). Los pares que
// incluyen a La Plata siguen usando la tabla de abajo (curada a mano, revisada por el admin, sin
// costo por consulta); cualquier otro par se resuelve con la Distance Matrix API de Google Maps y
// se cachea — ver server/maps.js y server/pricing.js (calcularPorCiudades) para el detalle.
//
// IMPORTANTE: los valores de abajo son ESTIMACIONES de distancia y peaje por ruta, no vienen de
// un mapa real — hay que revisarlos y corregirlos desde el panel de administración (Panel de
// administración → Distancias del corredor) antes de operar con usuarios reales.
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

// Valida que origen y destino sean dos ciudades distintas, ambas dentro del corredor habilitado.
// Ya NO exige que una de las dos sea La Plata (esa restricción se sacó a pedido del usuario, para
// permitir viajes entre ciudades intermedias) — ver server/pricing.js para cómo se resuelve el km
// según el par elegido.
function validarCiudades(origenCiudad, destinoCiudad) {
  const origen = (origenCiudad || "").trim();
  const destino = (destinoCiudad || "").trim();
  if (!origen || !destino) return { error: "Elegí ciudad de origen y de destino." };
  if (origen === destino) return { error: "El origen y el destino no pueden ser la misma ciudad." };
  if (!CIUDADES_CORREDOR.includes(origen)) {
    return { error: `"${origen}" todavía no es una ciudad habilitada del corredor.` };
  }
  if (!CIUDADES_CORREDOR.includes(destino)) {
    return { error: `"${destino}" todavía no es una ciudad habilitada del corredor.` };
  }
  return {};
}

module.exports = { CIUDAD_BASE, CIUDADES_CORREDOR, DISTANCIAS_DEFAULT, validarCiudades };
