// api/corredor.js — Ciudades habilitadas y distancias/peajes de referencia del corredor,
// para calcular automáticamente km, peajes y precio SIN que el conductor pueda tocarlos.
//
// Por qué una tabla fija y no Google Maps: el corredor de Ruta Compartida (fase inicial) es un
// conjunto chico y fijo de ~14 ciudades, todas con origen o destino en La Plata (así lo dicen las
// Reglas de la Ruta). Con eso alcanza una tabla de distancia/peaje "La Plata ↔ cada ciudad" sin
// necesidad de una cuenta de Google Cloud con facturación ni llamadas a una API paga por cada
// búsqueda. El día que el corredor crezca a rutas que NO pasen por La Plata, o a ciudades fuera de
// esta lista, ahí sí conviene integrar la Distance Matrix API de Google Maps (necesitaría que se
// cree un proyecto de Google Cloud con facturación habilitada y nos pase la API key).
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
};

// Dado un origen y un destino, determina la "otra ciudad" (la que no es La Plata) y valida que la
// combinación sea una de las habilitadas en esta fase (siempre con origen o destino en La Plata).
function resolverOtraCiudad(origenCiudad, destinoCiudad) {
  const origen = (origenCiudad || "").trim();
  const destino = (destinoCiudad || "").trim();
  if (!origen || !destino) return { error: "Elegí ciudad de origen y de destino." };
  if (origen === destino) return { error: "El origen y el destino no pueden ser la misma ciudad." };
  if (origen !== CIUDAD_BASE && destino !== CIUDAD_BASE) {
    return { error: `Por ahora solo habilitamos viajes con origen o destino en ${CIUDAD_BASE}.` };
  }
  const otraCiudad = origen === CIUDAD_BASE ? destino : origen;
  if (!CIUDADES_CORREDOR.includes(otraCiudad)) {
    return { error: `"${otraCiudad}" todavía no es una ciudad habilitada del corredor.` };
  }
  return { otraCiudad };
}

module.exports = { CIUDAD_BASE, CIUDADES_CORREDOR, DISTANCIAS_DEFAULT, resolverOtraCiudad };
