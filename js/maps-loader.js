// maps-loader.js — Carga la API de JavaScript de Google Maps (librería "places") en el navegador,
// bajo demanda, usando una key restringida por dominio.
//
// Hasta el 19 ago 2026 esta app nunca ponía una key de Google en el navegador (el usuario lo pidió
// explícitamente en ese momento). El 20 ago 2026 pidió lo contrario: "Necesito conectar todo a
// google maps y que sea todo a partir de eso... si se ve la clave la restringiremos de alguna
// manera, porque tengo mil problemas sin google maps" — o sea, ahora SÍ se expone una key en el
// navegador, a cambio de restringirla en Google Cloud Console.
//
// Por qué es una key DISTINTA de GOOGLE_MAPS_API_KEY (la que usa server/maps.js desde el servidor
// para Distance Matrix y Places Text Search): esa key server-side no tiene (ni puede tener, sin
// romperse) una restricción de "HTTP referrers", porque las llamadas server-to-server no mandan un
// header Referer de navegador. La key de acá SÍ tiene que estar restringida por HTTP referrer al
// dominio de la app — si alguien la copia del código fuente del navegador y la usa desde otro
// sitio, Google la rechaza. Se guarda en Vercel como GOOGLE_MAPS_BROWSER_KEY y se sirve desde
// GET /api/lugares/maps-key (server/routes/lugares.js) — nunca hardcodeada en este archivo.
//
// Uso: `await GoogleMapsLoader.listo()` antes de usar `google.maps.places.Autocomplete` (ver
// js/components.js wireAutocompleteCiudad / wireAutocompletePlace). Si la promesa rechaza (key no
// configurada todavía, sin conexión, dominio no restringido correctamente, etc.), quien la llama
// TIENE que caer a un fallback sin autocomplete — nunca asumir que el mapa está disponible.
const GoogleMapsLoader = (() => {
  let promesa = null;

  function cargarScript(apiKey) {
    return new Promise((resolve, reject) => {
      window.__onGoogleMapsListo = () => resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=es&region=AR&loading=async&callback=__onGoogleMapsListo`;
      script.async = true;
      script.onerror = () => reject(new Error("No se pudo cargar la API de Google Maps (revisá la conexión o la restricción de dominio de la key)."));
      document.head.appendChild(script);
    });
  }

  function listo() {
    if (!promesa) {
      promesa = (async () => {
        if (window.google && window.google.maps && window.google.maps.places) return true;
        const { apiKey } = await Api.get("/api/lugares/maps-key");
        if (!apiKey) throw new Error("Google Maps todavía no está configurado (falta GOOGLE_MAPS_BROWSER_KEY).");
        await cargarScript(apiKey);
        if (!window.google || !window.google.maps || !window.google.maps.places) {
          throw new Error("Google Maps no se pudo inicializar.");
        }
        return true;
      })().catch((err) => {
        promesa = null; // permitir reintentar en un próximo llamado (ej. otra vista, o F5)
        throw err;
      });
    }
    return promesa;
  }

  return { listo };
})();
