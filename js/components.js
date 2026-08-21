// components.js — piezas de UI reutilizables (acordeones, chips, tarjetas de viaje, estrellas).

// ---------------------------------------------------------------------------
// AUTOCOMPLETE DE GOOGLE MAPS — ata un buscador real de Google (Places Autocomplete) a un <input>
// de texto, a pedido del usuario (20 ago 2026: "Ciudades intermedias de manera automática, no que
// te deje escribir cualquier cosa. Origen y destino también mejorar"). Requiere que
// `GoogleMapsLoader.listo()` (js/maps-loader.js) ya haya resuelto antes de llamar a estas dos
// funciones — si Google Maps no está disponible, el caller tiene que quedarse con el fallback de
// siempre (selects/inputs de texto libre) en vez de llamar a esto.
// ---------------------------------------------------------------------------

// Ata un Autocomplete restringido a CIUDADES de Argentina. Llama a onSeleccion({nombre, lat, lng,
// placeId}) solo cuando el usuario elige una sugerencia real de la lista desplegada por Google —
// `nombre` es el nombre corto de la localidad (ej. "9 de Julio"), sacado de los
// address_components de tipo "locality" (con "administrative_area_level_2" como respaldo, para el
// puñado de localidades que Google no marca como "locality"). Si el usuario escribe algo y aprieta
// Enter sin elegir de la lista, `place.geometry` viene vacío y no se llama a onSeleccion — el
// caller decide qué hacer con eso (ver js/views.js viewPublicar, campoCiudadValido).
function wireAutocompleteCiudad(input, onSeleccion) {
  const autocomplete = new google.maps.places.Autocomplete(input, {
    types: ["(cities)"],
    componentRestrictions: { country: "ar" },
    fields: ["address_components", "geometry", "name", "place_id"],
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place || !place.geometry) return;
    const comps = place.address_components || [];
    const locality = comps.find((c) => c.types.includes("locality"));
    const partido = comps.find((c) => c.types.includes("administrative_area_level_2"));
    const nombre = (locality || partido || { long_name: place.name }).long_name;
    onSeleccion({
      nombre,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      placeId: place.place_id,
    });
  });
  return autocomplete;
}

// Reemplaza el <select> de ciudad que hay dentro de `cont` (un contenedor `.field` con el select
// adentro, ver js/views.js data-ciudad-field) por un <input> de texto con buscador real de Google
// Maps atado (wireAutocompleteCiudad). Preserva el valor que tenía el select y cualquier <label>
// que hubiera adentro. Devuelve el <input> nuevo. Se usa tanto en la publicación de un viaje (con
// validación estricta de que se haya elegido una sugerencia real) como en los buscadores de home y
// resultados (sin esa validación, porque ahí el backend ya acepta texto parcial con ILIKE).
//
// Fix (21 ago 2026, a pedido del usuario: "puedo poner las ciudades pero no me las toma... me sigue
// apareciendo que elija origen y destino y ya los elegi"): antes, si el usuario tipeaba una ciudad
// y por el motivo que fuera (no clickeó ninguna sugerencia real de la lista desplegada, apretó Enter
// sin elegir, etc.) el campo quedaba con texto pero SIN seleccionar de verdad, no había NINGUNA
// señal visible de que la ciudad no se había "tomado" — el resto de la pantalla (precio, ciudades
// intermedias, puntos de encuentro) se quedaba mostrando el estado viejo/inicial para siempre, sin
// ninguna pista de qué faltaba. Ahora, al perder el foco (blur) con texto tipeado que no viene de
// una selección real, se muestra un aviso claro abajo del campo, y se llama a `onInvalido` (si el
// caller lo pasa) para que pueda refrescar el resto de la pantalla con el estado real actual (en vez
// de dejar tarjetas o mensajes de una selección anterior colgados en pantalla).
function reemplazarSelectPorAutocompleteCiudad(cont, name, onSeleccion, placeholder, onInvalido) {
  const viejo = cont.querySelector("select, input");
  const valorInicial = viejo ? viejo.value : "";
  const label = cont.querySelector("label");
  cont.innerHTML = "";
  if (label) cont.appendChild(label);
  const input = document.createElement("input");
  input.type = "text";
  input.name = name;
  input.autocomplete = "off";
  input.placeholder = placeholder || "Escribí y elegí una ciudad de la lista…";
  input.value = valorInicial;
  if (valorInicial) input.dataset.valida = "1";
  cont.appendChild(input);
  const aviso = document.createElement("small");
  aviso.className = "aviso-ciudad-no-valida";
  aviso.style.cssText = "display:none;color:var(--danger);margin-top:4px";
  aviso.textContent = "⚠️ Elegí esta ciudad de la lista de sugerencias que aparece al escribir — no alcanza con tipearla y apretar Enter.";
  cont.appendChild(aviso);
  wireAutocompleteCiudad(input, (lugar) => {
    input.value = lugar.nombre;
    input.dataset.valida = "1";
    aviso.style.display = "none";
    if (onSeleccion) onSeleccion(lugar, input);
  });
  input.addEventListener("input", () => {
    input.dataset.valida = "";
    aviso.style.display = "none";
  });
  input.addEventListener("blur", () => {
    if (input.value && input.dataset.valida !== "1") {
      aviso.style.display = "block";
      if (onInvalido) onInvalido(input);
    } else {
      aviso.style.display = "none";
    }
  });
  return input;
}

// Ata un Autocomplete SIN restricción de tipo (direcciones, comercios, lugares puntuales como una
// estación de servicio o una terminal) — para elegir un punto de partida exacto. onSeleccion
// recibe {nombre, direccion, lat, lng, placeId}.
function wireAutocompletePlace(input, onSeleccion) {
  const autocomplete = new google.maps.places.Autocomplete(input, {
    componentRestrictions: { country: "ar" },
    fields: ["formatted_address", "geometry", "name", "place_id"],
  });
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place || !place.geometry) return;
    onSeleccion({
      nombre: place.name || place.formatted_address,
      direccion: place.formatted_address || place.name,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      placeId: place.place_id,
    });
  });
  return autocomplete;
}

function renderAccordion(items, idPrefix) {
  return `<div class="accordion" data-accordion="${idPrefix}">
    ${items
      .map(
        (item, i) => `
      <div class="accordion-item" data-idx="${i}">
        <div class="accordion-header" data-toggle="${idPrefix}-${i}">
          <span>${item.titulo || item.q}</span>
          <span class="icon">▾</span>
        </div>
        <div class="accordion-body">${item.html || `<p>${item.a}</p>`}</div>
      </div>`
      )
      .join("")}
  </div>`;
}

function wireAccordions(root = document) {
  root.querySelectorAll(".accordion-header").forEach((header) => {
    header.addEventListener("click", () => {
      const item = header.closest(".accordion-item");
      item.classList.toggle("open");
    });
  });
}

// Devuelve el avatar de una persona: la foto real si tiene una cargada (foto_perfil subida como
// público, ver server/blob.js — URL completa http(s)://...), o si no las iniciales de siempre.
// Los pathnames privados viejos (subidos antes de este cambio, o cualquier otro campo que no sea
// foto_perfil/vehiculo_foto) NO empiezan con "http", así que caen solos al fallback de iniciales
// en vez de romper un <img> con una URL que nadie sin sesión de admin puede ver.
function avatarHtml(fotoUrl, nombre, apellido, claseExtra = "") {
  const clase = `avatar ${claseExtra}`.trim();
  if (fotoUrl && /^https?:\/\//.test(fotoUrl)) {
    return `<img src="${escapeHtml(fotoUrl)}" alt="Foto de ${escapeHtml(nombre || "")}" class="${clase}" style="object-fit:cover">`;
  }
  return `<div class="${clase}">${iniciales(nombre, apellido)}</div>`;
}

function renderTripCard(viaje) {
  const c = viaje.conductor || {};
  const intermedias = (viaje.ciudades_intermedias || []).join(" · ");
  return `
    <div class="trip-card" data-viaje-id="${viaje.id}">
      <div style="flex:1">
        <div class="trip-route">${escapeHtml(viaje.origen_ciudad)} <span class="arrow">→</span> ${escapeHtml(viaje.destino_ciudad)}</div>
        ${intermedias ? `<div class="muted">Pasa por: ${escapeHtml(intermedias)}</div>` : ""}
        <div class="trip-meta">
          <span>📅 ${fmtFecha(viaje.fecha_salida)}</span>
          <span>🕒 ${viaje.hora_salida}${viaje.hora_llegada_estimada ? " → " + viaje.hora_llegada_estimada : ""}</span>
          <span>💺 ${viaje.asientos_disponibles} de ${viaje.asientos_totales} disponibles</span>
        </div>
        <div class="tag-row">
          ${viaje.permite_mascotas ? '<span class="tag">🐾 Mascotas</span>' : ""}
          ${viaje.permite_equipaje_grande ? '<span class="tag">🧳 Equipaje grande</span>' : '<span class="tag">🎒 Solo mochila</span>'}
          ${viaje.permite_fumar ? '<span class="tag">🚬 Se puede fumar</span>' : '<span class="tag">🚭 No fumadores</span>'}
          <span class="tag">${viaje.pref_charla === "silencio" ? "🤫 Prefiere silencio" : "💬 Le gusta charlar"}</span>
        </div>
        <div class="trip-driver">
          ${avatarHtml(c.foto_perfil, c.nombre, c.apellido)}
          <div>
            <strong>${escapeHtml(c.nombre || "")}</strong>
            ${c.rating_count ? `<span class="stars">★ ${c.rating_promedio}</span> <span class="muted">(${c.rating_count})</span>` : '<span class="muted">Sin calificaciones aún</span>'}
          </div>
        </div>
      </div>
      <div class="trip-price">
        <div class="amount">${fmtMoney(viaje.precio_por_asiento)}</div>
        <div class="muted">por asiento</div>
      </div>
    </div>`;
}

function renderStarsInput(name, value = 0) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += `<span data-star="${i}" class="${i <= value ? "active" : ""}">★</span>`;
  }
  return `<div class="rating-stars-input" data-rating-field="${name}">${stars}<input type="hidden" name="${name}" value="${value}"></div>`;
}

function wireStarsInputs(root = document) {
  root.querySelectorAll(".rating-stars-input").forEach((widget) => {
    const input = widget.querySelector("input[type=hidden]");
    widget.querySelectorAll("span[data-star]").forEach((star) => {
      star.addEventListener("click", () => {
        const val = Number(star.dataset.star);
        input.value = val;
        widget.querySelectorAll("span[data-star]").forEach((s) => {
          s.classList.toggle("active", Number(s.dataset.star) <= val);
        });
      });
    });
  });
}

function renderChips(name, options, selected) {
  return `<div class="chips" data-chip-group="${name}">
    ${options
      .map(
        (opt) =>
          `<button type="button" class="chip-toggle ${opt.value === selected ? "active" : ""}" data-chip-value="${opt.value}">${opt.label}</button>`
      )
      .join("")}
    <input type="hidden" name="${name}" value="${selected || ""}">
  </div>`;
}

function wireChips(root = document) {
  root.querySelectorAll("[data-chip-group]").forEach((group) => {
    const input = group.querySelector("input[type=hidden]");
    group.querySelectorAll(".chip-toggle").forEach((chip) => {
      chip.addEventListener("click", () => {
        group.querySelectorAll(".chip-toggle").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        input.value = chip.dataset.chipValue;
      });
    });
  });
}

// ---------------------------------------------------------------------------
// PUNTO DE ENCUENTRO — buscador de lugares reales (Google Places, vía nuestro propio endpoint
// server/routes/lugares.js, para que la key server-side de Google nunca llegue al navegador) + un
// mapa interactivo con pin arrastrable para elegir o afinar el lugar exacto (20 ago 2026, a pedido
// del usuario: "Quiero que el origen y destino sea seleccionable en google maps, osea interactivo
// dentro de la app"; este archivo se sirve tal cual al navegador, sin build step, así que no debe
// mencionar marcas de la competencia en ningún comentario ni texto visible, aunque el usuario las
// nombre en el chat).
//
// Hasta el 20 ago 2026 esto era un iframe de Google Maps SIN key (solo lectura, sin pin
// arrastrable) porque en ese momento el usuario quería evitar exponer una key en el navegador. Ese
// mismo día pidió lo contrario ("si se ve la clave la restringiremos de alguna manera, porque tengo
// mil problemas sin google maps"), así que ahora el mapa de ESTA tarjeta (la que usa el conductor
// para elegir el punto, ver puntoEncuentroEditarHtml/wirePuntosEncuentro) es un
// google.maps.Map + google.maps.Marker de verdad (montarMapaInteractivo), con GOOGLE_MAPS_BROWSER_KEY
// (restringida por dominio, ver js/maps-loader.js). Si esa API no carga (key no configurada
// todavía, sin conexión, etc.) cae automáticamente al iframe embebido de siempre — nunca bloquea la
// publicación por esto. La vista de SOLO LECTURA que ve el pasajero (o el conductor revisando una
// solicitud ya hecha, ver puntoEncuentroVerHtml/mapaEmbedHtml) sigue siendo el iframe sin key a
// propósito: no hace falta interactividad ahí, y así esas pantallas no dependen de que la API de
// JavaScript esté disponible.
// ---------------------------------------------------------------------------

// Iframe de Google Maps sin key, centrado en un lat/lng puntual. Funciona con cualquier cuenta
// (no hace falta facturación ni API habilitada) porque usa la versión pública de maps.google.com,
// no la API — por eso es de solo lectura (no se puede arrastrar el pin ni buscar adentro).
function mapaEmbedHtml(lat, lng, alto = 180) {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return "";
  return `<iframe src="https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&output=embed"
    style="width:100%;height:${alto}px;border:0;border-radius:8px;margin-top:6px" loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

// Tarjeta de "punto de encuentro" de SOLO LECTURA — para mostrarle al pasajero (o al conductor
// revisando sus solicitudes) el lugar exacto que ya se eligió. `punto` es
// {nombre, direccion, lat, lng, place_id} (una entrada de viaje.puntos_encuentro) o null/undefined.
function puntoEncuentroVerHtml(punto) {
  if (!punto || !punto.nombre) return "";
  return `<div class="punto-encuentro-ver" style="margin-top:6px;padding:10px;border:1px solid var(--border);border-radius:8px">
    <div style="font-weight:600">📍 ${escapeHtml(punto.nombre)}</div>
    ${punto.direccion ? `<div class="muted" style="font-size:.9em">${escapeHtml(punto.direccion)}</div>` : ""}
    ${mapaEmbedHtml(punto.lat, punto.lng)}
  </div>`;
}

// Muestra los puntos de encuentro (subida y bajada) de UNA reserva ya cargada — usa
// r.puntos_encuentro (el objeto completo del viaje, keyeado por ciudad, ver server/routes/
// reservas.js porPasajero/porViaje) y el tramo real de esa reserva (tramo_origen_ciudad/
// tramo_destino_ciudad si reservó solo una parte del camino, si no origen_ciudad/destino_ciudad
// del viaje completo). Si el conductor no cargó un punto para esas ciudades, no se muestra nada.
function puntosEncuentroReservaHtml(r) {
  const puntos = r.puntos_encuentro || {};
  const origenCiudad = r.tramo_origen_ciudad || r.origen_ciudad;
  const destinoCiudad = r.tramo_destino_ciudad || r.destino_ciudad;
  const origenHtml = puntos[origenCiudad] ? puntoEncuentroVerHtml(puntos[origenCiudad]) : "";
  const destinoHtml = puntos[destinoCiudad] ? puntoEncuentroVerHtml(puntos[destinoCiudad]) : "";
  if (!origenHtml && !destinoHtml) return "";
  return `
    ${origenHtml ? `<p class="muted" style="margin:8px 0 0;font-size:0.8rem">📍 Punto de encuentro en ${escapeHtml(origenCiudad)}:</p>${origenHtml}` : ""}
    ${destinoHtml ? `<p class="muted" style="margin:8px 0 0;font-size:0.8rem">📍 Punto de encuentro en ${escapeHtml(destinoCiudad)}:</p>${destinoHtml}` : ""}`;
}

// Info de solo texto (nombre + dirección) del punto ya elegido, para mostrar DEBAJO del mapa
// interactivo en la tarjeta de edición — a diferencia de puntoEncuentroVerHtml, esta versión no
// incluye el iframe (el mapa de arriba ya lo reemplaza en la tarjeta editable, ver
// puntoEncuentroEditarHtml/wirePuntosEncuentro más abajo).
function puntoEncuentroInfoHtml(punto) {
  if (!punto || !punto.nombre) return "";
  return `<div class="punto-encuentro-ver" style="margin-top:6px">
    <div style="font-weight:600">📍 ${escapeHtml(punto.nombre)}</div>
    ${punto.direccion ? `<div class="muted" style="font-size:.9em">${escapeHtml(punto.direccion)}</div>` : ""}
  </div>`;
}

// Tarjeta EDITABLE de "punto de encuentro" (para cuando el conductor está publicando un viaje):
// mapa interactivo (tocar o arrastrar el pin) + buscador de texto como alternativa. SOLO se usa
// para origen y destino (20 ago 2026, a pedido del usuario: "quiero que todo se vea en google
// maps... obviamente lo elige el chofer al punto de partida y al punto de llegada" — no se puede
// publicar sin elegir un punto ahí, ver validación en el submit de viewPublicar). `ciudad` es la
// clave exacta que después se usa en viaje.puntos_encuentro; `seleccionado` es el punto ya elegido
// para esa ciudad en esta sesión de edición, si hay (se preserva al re-renderizar el contenedor
// completo, ver js/views.js viewPublicar → renderPuntosEncuentroContainer). `centroInicial`
// ({lat,lng}, opcional, 20 ago 2026) es el centro con el que arranca el mapa ANTES de que el
// conductor elija nada — viene de la ciudad ya geolocalizada por el Autocomplete, ver js/views.js
// coordsPorCiudad; si no hay, el mapa arranca centrado en Argentina entera.
//
// Las ciudades INTERMEDIAS ya NO usan esta tarjeta (21 ago 2026, a pedido del usuario: "que la
// ubicacion para esta sea en la ruta en la entrada... el chofer solo elegiria que ciudades
// intermedias quiere") — ver puntoEncuentroAutomaticoHtml más abajo.
function puntoEncuentroEditarHtml(ciudad, seleccionado, centroInicial) {
  const centroLat = centroInicial && typeof centroInicial.lat === "number" ? centroInicial.lat : "";
  const centroLng = centroInicial && typeof centroInicial.lng === "number" ? centroInicial.lng : "";
  return `<div class="punto-encuentro-editar" data-ciudad="${escapeHtml(ciudad)}" data-centro-lat="${centroLat}" data-centro-lng="${centroLng}" style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:8px">
    <label style="font-weight:600">📍 Punto de encuentro en ${escapeHtml(ciudad)} <span class="muted" style="font-weight:400">(obligatorio)</span></label>
    <small class="hint">Tocá o arrastrá el pin en el mapa para marcar el lugar exacto donde vas a esperar (o dejar) a tus pasajeros — o buscalo por nombre más abajo (una estación de servicio, terminal, plaza, tu casa, etc.).</small>
    <div class="pe-mapa-interactivo" style="width:100%;height:220px;border-radius:8px;margin-top:8px;background:var(--bg-soft,#eee);display:flex;align-items:center;justify-content:center">
      <span class="muted" style="font-size:.85em">Cargando mapa…</span>
    </div>
    <div class="field-row" style="margin-top:8px">
      <input type="text" class="pe-buscar-input" placeholder="O buscá por nombre: Ej. YPF Ruta 5, ${escapeHtml(ciudad)}" style="flex:1">
      <button type="button" class="btn btn-outline pe-buscar-btn">Buscar</button>
    </div>
    <div class="pe-resultados"></div>
    <div class="pe-seleccionado">${
      seleccionado
        ? `${puntoEncuentroInfoHtml(seleccionado)}<button type="button" class="btn btn-outline danger pe-quitar-btn" style="margin-top:4px;padding:4px 10px;font-size:.85em">Quitar</button>`
        : ""
    }</div>
  </div>`;
}

// Tarjeta de SOLO LECTURA para el punto de encuentro de una ciudad INTERMEDIA (21 ago 2026, a
// pedido del usuario: "que la ubicacion para esta sea en la ruta en la entrada... el chofer solo
// elegiria que ciudades intermedias quiere"). A diferencia de origen/destino (puntoEncuentroEditarHtml,
// arriba), acá no hay nada para tocar ni buscar: `coords` es el punto real sobre la ruta que ya
// calculó Google (Directions + Geocoding inverso, detección automática — ver js/views.js
// intentarDetectarRuta — o el centro de la ciudad si se agregó a mano con el buscador de siempre
// porque la detección automática no estaba disponible, ver mejorarCampoIntermedias). El conductor
// solo elige QUÉ ciudades intermedias incluir (el checklist de arriba); dónde exactamente cae el
// punto en cada una ya no es una decisión suya.
function puntoEncuentroAutomaticoHtml(ciudad, coords) {
  if (!coords) {
    return `<div class="punto-encuentro-auto" style="margin-top:10px;padding:10px;border:1px dashed var(--border);border-radius:8px">
      <div style="font-weight:600">📍 Punto de encuentro en ${escapeHtml(ciudad)}</div>
      <small class="hint">Todavía no tenemos la ubicación exacta sobre la ruta para esta ciudad — se va a completar sola en cuanto esté disponible. No hace falta que hagas nada acá.</small>
    </div>`;
  }
  return `<div class="punto-encuentro-auto" style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:8px">
    <div style="font-weight:600">📍 Punto de encuentro en ${escapeHtml(ciudad)}</div>
    <small class="hint">Se toma automáticamente sobre el camino real — no hace falta elegir nada acá.</small>
    ${mapaEmbedHtml(coords.lat, coords.lng)}
  </div>`;
}

// Monta un mapa interactivo (google.maps.Map + Marker arrastrable) dentro de `container` para que
// el conductor elija el punto de encuentro tocando o arrastrando el pin (20 ago 2026, a pedido del
// usuario). `centro` es {lat,lng} de partida (el punto ya elegido, o el centro de la ciudad si
// todavía no eligió nada, o null); `puntoInicial` es el punto ya elegido si lo hay (se dibuja el
// pin ahí de entrada). `onCambiar(punto)` se llama cada vez que el conductor mueve el pin (tocando
// o arrastrando), con el punto recalculado ({nombre, direccion, lat, lng}) vía reverse geocoding.
//
// Devuelve `{ moverPin(punto) }` para que el buscador de texto (wirePuntosEncuentro más abajo)
// pueda mover el mismo pin cuando el conductor elige un resultado de la búsqueda en vez de tocar el
// mapa — o `null` si la API de JavaScript de Google Maps no está disponible ahora (key no
// configurada, sin conexión, etc.), caso en el que el caller tiene que caer al iframe de siempre.
async function montarMapaInteractivo(container, centro, puntoInicial, onCambiar) {
  try {
    await GoogleMapsLoader.listo();
    if (!window.google || !window.google.maps) throw new Error("Google Maps no disponible");
    if (!container.isConnected) return null; // el conductor pudo haber navegado a otra vista mientras cargaba
    const centroMapa = puntoInicial || centro || { lat: -34.6, lng: -64.0 }; // sin nada elegido: centro geográfico aproximado de Argentina
    const zoomInicial = puntoInicial ? 16 : centro ? 13 : 5;
    container.innerHTML = "";
    const mapa = new google.maps.Map(container, {
      center: centroMapa,
      zoom: zoomInicial,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    const geocoder = new google.maps.Geocoder();
    let marker = puntoInicial ? new google.maps.Marker({ position: puntoInicial, map: mapa, draggable: true }) : null;

    function nombreDireccionDesdeGeocode(resultado, lat, lng) {
      if (!resultado) return { nombre: `Punto en el mapa (${lat.toFixed(5)}, ${lng.toFixed(5)})`, direccion: "" };
      const direccion = resultado.formatted_address || "";
      const nombre = (direccion.split(",")[0] || direccion || "Punto en el mapa").trim();
      return { nombre, direccion };
    }

    function atarDrag(m) {
      m.addListener("dragend", () => {
        const pos = m.getPosition();
        moverA(pos.lat(), pos.lng());
      });
    }

    async function moverA(lat, lng) {
      if (!marker) {
        marker = new google.maps.Marker({ position: { lat, lng }, map: mapa, draggable: true });
        atarDrag(marker);
      } else {
        marker.setPosition({ lat, lng });
      }
      mapa.panTo({ lat, lng });
      let nombre, direccion;
      try {
        const { results } = await geocoder.geocode({ location: { lat, lng } });
        ({ nombre, direccion } = nombreDireccionDesdeGeocode(results && results[0], lat, lng));
      } catch {
        ({ nombre, direccion } = nombreDireccionDesdeGeocode(null, lat, lng));
      }
      onCambiar({ nombre, direccion, lat, lng });
    }

    if (marker) atarDrag(marker);
    mapa.addListener("click", (e) => moverA(e.latLng.lat(), e.latLng.lng()));

    return {
      moverPin(punto) {
        if (!punto) {
          if (marker) {
            marker.setMap(null);
            marker = null;
          }
          return;
        }
        if (!marker) {
          marker = new google.maps.Marker({ position: { lat: punto.lat, lng: punto.lng }, map: mapa, draggable: true });
          atarDrag(marker);
        } else {
          marker.setPosition({ lat: punto.lat, lng: punto.lng });
        }
        mapa.panTo({ lat: punto.lat, lng: punto.lng });
        mapa.setZoom(16);
      },
    };
  } catch {
    // Sin API de JavaScript de Google Maps disponible ahora mismo: el caller cae al iframe de
    // siempre (mapaEmbedHtml), que no depende de esta API y siempre funciona.
    return null;
  }
}

// Conecta cada tarjeta puntoEncuentroEditarHtml() dentro de `root`: monta el mapa interactivo (o
// cae al iframe de siempre si Google Maps no está disponible), conecta el buscador de texto con el
// endpoint /api/lugares/buscar como alternativa, y guarda la selección en el objeto
// `puntosEncuentro` (mutado in-place, keyeado por nombre de ciudad) para que el caller lo lea al
// armar el payload de publicar().
function wirePuntosEncuentro(root, puntosEncuentro) {
  root.querySelectorAll(".punto-encuentro-editar").forEach((card) => {
    const ciudad = card.getAttribute("data-ciudad");
    const input = card.querySelector(".pe-buscar-input");
    const btn = card.querySelector(".pe-buscar-btn");
    const resultados = card.querySelector(".pe-resultados");
    const mapaDiv = card.querySelector(".pe-mapa-interactivo");
    const seleccionadoDiv = card.querySelector(".pe-seleccionado");
    let moverPin = null; // se completa si el mapa interactivo se monta con éxito (ver más abajo)

    function sinMapaInteractivoHtml(punto) {
      // Fallback que no depende de la API de JavaScript de Maps — funciona siempre.
      return punto ? mapaEmbedHtml(punto.lat, punto.lng, 220) : `<p class="muted" style="font-size:.85em;padding:8px">El mapa interactivo no está disponible ahora — usá el buscador de abajo para elegir el lugar.</p>`;
    }

    function mostrarSeleccionado(punto) {
      seleccionadoDiv.innerHTML = punto
        ? `${puntoEncuentroInfoHtml(punto)}<button type="button" class="btn btn-outline danger pe-quitar-btn" style="margin-top:4px;padding:4px 10px;font-size:.85em">Quitar</button>`
        : "";
      const quitarBtn = seleccionadoDiv.querySelector(".pe-quitar-btn");
      if (quitarBtn) {
        quitarBtn.addEventListener("click", () => {
          delete puntosEncuentro[ciudad];
          mostrarSeleccionado(null);
          if (moverPin) moverPin(null);
          else mapaDiv.innerHTML = sinMapaInteractivoHtml(null);
        });
      }
    }
    mostrarSeleccionado(puntosEncuentro[ciudad]);

    const centroLat = Number(card.dataset.centroLat);
    const centroLng = Number(card.dataset.centroLng);
    const centroInicial = !Number.isNaN(centroLat) && !Number.isNaN(centroLng) ? { lat: centroLat, lng: centroLng } : null;

    montarMapaInteractivo(mapaDiv, centroInicial, puntosEncuentro[ciudad] || null, (punto) => {
      puntosEncuentro[ciudad] = punto;
      mostrarSeleccionado(punto);
      resultados.innerHTML = "";
      input.value = "";
    }).then((api) => {
      if (api) moverPin = api.moverPin;
      else mapaDiv.innerHTML = sinMapaInteractivoHtml(puntosEncuentro[ciudad] || null);
    });

    async function buscar() {
      const q = input.value.trim();
      if (!q) return;
      resultados.innerHTML = `<p class="muted">Buscando...</p>`;
      try {
        const { resultados: lugares } = await Api.get(`/api/lugares/buscar?q=${encodeURIComponent(q)}`);
        if (!lugares.length) {
          resultados.innerHTML = `<p class="muted">No encontramos nada con ese nombre. Probá con otra búsqueda (ej. agregá la ciudad o la ruta).</p>`;
          return;
        }
        resultados.innerHTML = lugares
          .map(
            (l, i) => `<div class="pe-resultado-item" data-idx="${i}" style="padding:8px;border:1px solid var(--border);border-radius:6px;margin-top:4px;cursor:pointer">
              <div style="font-weight:600">${escapeHtml(l.nombre)}</div>
              <div class="muted" style="font-size:.9em">${escapeHtml(l.direccion || "")}</div>
            </div>`
          )
          .join("");
        resultados.querySelectorAll(".pe-resultado-item").forEach((el) => {
          el.addEventListener("click", () => {
            const punto = lugares[Number(el.getAttribute("data-idx"))];
            puntosEncuentro[ciudad] = punto;
            mostrarSeleccionado(punto);
            if (moverPin) moverPin(punto);
            else mapaDiv.innerHTML = sinMapaInteractivoHtml(punto);
            resultados.innerHTML = "";
            input.value = "";
          });
        });
      } catch (err) {
        resultados.innerHTML = `<p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
      }
    }
    btn.addEventListener("click", buscar);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        buscar();
      }
    });
  });
}

// Checklist de ciudades DETECTADAS AUTOMÁTICAMENTE en la ruta real entre origen y destino (20 ago
// 2026, a pedido del usuario: "NO QUIERO QUE EL CHOFER TENGA QUE AGREGAR LA CIUDAD INTERMEDIA, QUE
// LO TOME DE GOOGLE MAPS SOLO LA APLICACION, SEGUN LA RUTA QUE ELIJA EL CHOFER"). `ciudades` es el
// array {nombre, lat, lng} que devolvió GET /api/lugares/ruta (server/maps.js ciudadesEnRuta), ya
// en el orden real en que se encuentran yendo de origen a destino. Todas arrancan tildadas — el
// conductor puede destildar las que no quiera que aparezcan en las búsquedas de otros pasajeros
// (ver wireCiudadesRutaChecklist), pero nunca tiene que escribir ni buscar nada a mano.
function ciudadesRutaChecklistHtml(ciudades) {
  if (!ciudades.length) {
    return `<p class="muted" style="font-size:0.85rem">No detectamos ninguna localidad en el camino directo entre estas dos ciudades (puede ser un viaje corto, o pasar por zona rural) — está bien, se puede publicar igual.</p>`;
  }
  return `<div class="ciudades-ruta-checklist">
    ${ciudades
      .map(
        (c, i) => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer">
          <input type="checkbox" class="ciudad-ruta-check" data-idx="${i}" checked>
          <span>${escapeHtml(c.nombre)}</span>
        </label>`
      )
      .join("")}
  </div>`;
}

// Ata los checkboxes de ciudadesRutaChecklistHtml() dentro de `root` — cada vez que el conductor
// tilda/destilda una, llama a `onChange` con el array (subconjunto de `ciudades`, mismo orden) de
// las que quedaron tildadas.
function wireCiudadesRutaChecklist(root, ciudades, onChange) {
  root.querySelectorAll(".ciudad-ruta-check").forEach((chk) => {
    chk.addEventListener("change", () => {
      const seleccionadas = [...root.querySelectorAll(".ciudad-ruta-check")]
        .filter((c) => c.checked)
        .map((c) => ciudades[Number(c.dataset.idx)]);
      onChange(seleccionadas);
    });
  });
}

// Selector de "qué camino real vas a hacer" cuando Google Directions encontró más de una ruta
// distinta entre origen y destino — a pedido del usuario (21 ago 2026: "que lo elija el chofer",
// ej. Pehuajó → La Plata por Chivilcoy/Luján/Moreno O por Bolívar/Saladillo/Lobos/Roque Pérez).
// `rutas` es el array { resumen, distanciaKm, ciudades } que devuelve GET /api/lugares/ruta (ver
// server/maps.js ciudadesEnRuta); `idxSeleccionada` es el índice tildado por defecto. El precio del
// viaje NUNCA depende de cuál se elija acá (eso sigue siendo Distance Matrix API aparte) — esto
// solo decide qué localidades intermedias se ofrecen para tildar/destildar.
function rutaSelectorHtml(rutas, idxSeleccionada) {
  return `<div class="ruta-selector" style="margin:6px 0">
    <small class="hint">Google encontró más de un camino real entre estas dos ciudades — elegí el que realmente vas a hacer:</small>
    ${rutas
      .map(
        (r, i) => `<label style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;cursor:pointer">
          <input type="radio" name="ruta-elegida" class="ruta-elegida-radio" value="${i}" ${i === idxSeleccionada ? "checked" : ""}>
          <span>${escapeHtml(r.resumen)}${typeof r.distanciaKm === "number" ? ` <span class="muted">· ${r.distanciaKm} km</span>` : ""}</span>
        </label>`
      )
      .join("")}
  </div>`;
}

// Ata los radios de rutaSelectorHtml() dentro de `root` — llama a `onChange(idx)` con el índice de
// `rutas` recién elegido cada vez que el conductor cambia de opción.
function wireRutaSelector(root, onChange) {
  root.querySelectorAll(".ruta-elegida-radio").forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) onChange(Number(radio.value));
    });
  });
}

function renderUploadField(name, label, hint) {
  return `
    <div class="field">
      <label>${label}</label>
      <div class="upload-field" data-upload="${name}">
        <input type="file" accept="image/*" id="file-${name}" data-upload-input="${name}">
        <label for="file-${name}" class="upload-label" data-upload-label="${name}">📷 Subir foto / Sacar foto</label>
        <div class="muted upload-filename" data-upload-filename="${name}"></div>
      </div>
      <input type="hidden" name="${name}" data-upload-hidden="${name}">
      ${hint ? `<small class="hint">${hint}</small>` : ""}
    </div>`;
}

// Redimensiona/comprime una imagen en el navegador ANTES de subirla — dos motivos: (1) las
// funciones de Vercel (plan Hobby) rechazan requests de más de 4.5 MB, y una foto de cámara sin
// comprimir (DNI, selfie) puede pesar bastante más que eso; (2) ahorra datos móviles y espacio de
// storage. Si por lo que sea la compresión falla (formato raro, navegador viejo), se sube el
// archivo original tal cual — mejor eso que bloquear la subida.
async function comprimirImagen(file, maxDim = 1600, calidad = 0.82) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  try {
    let ancho, alto, fuente;
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      ancho = bitmap.width;
      alto = bitmap.height;
      fuente = bitmap;
    } else {
      const url = URL.createObjectURL(file);
      fuente = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      ancho = fuente.naturalWidth;
      alto = fuente.naturalHeight;
      URL.revokeObjectURL(url);
    }
    if (!ancho || !alto) return file;
    const escala = Math.min(1, maxDim / Math.max(ancho, alto));
    const w = Math.max(1, Math.round(ancho * escala));
    const h = Math.max(1, Math.round(alto * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(fuente, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", calidad));
    return blob || file;
  } catch (e) {
    return file;
  }
}

// Sube el archivo (ya comprimido) al storage real (server/blob.js → Vercel Blob) y devuelve el
// valor que hay que guardar en el campo correspondiente — reemplaza lo que antes era "solo guardar
// el nombre del archivo elegido". Para foto_perfil/vehiculo_foto el servidor sube el archivo como
// público y devuelve la URL completa (para mostrarla directo en un <img> a la otra persona del
// viaje); para el resto (DNI, selfie, licencia, comprobantes) sube como privado y devuelve solo el
// pathname, que hace falta ver con sesión de admin (Api.verDocumento).
async function subirArchivo(campo, blobOFile) {
  const tipo = blobOFile.type || "image/jpeg";
  const resp = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Upload-Content-Type": tipo,
      "X-Upload-Campo": campo,
    },
    body: blobOFile,
  });
  let data = null;
  try {
    data = await resp.json();
  } catch (e) {
    data = null;
  }
  if (!resp.ok) throw new Error((data && data.error) || `Error ${resp.status} al subir el archivo`);
  return data.valor;
}

function wireUploads(root = document) {
  root.querySelectorAll("[data-upload-input]").forEach((input) => {
    input.addEventListener("change", async () => {
      const name = input.dataset.uploadInput;
      const wrapper = root.querySelector(`[data-upload="${name}"]`);
      const hidden = root.querySelector(`[data-upload-hidden="${name}"]`);
      const filenameEl = root.querySelector(`[data-upload-filename="${name}"]`);
      if (!input.files || !input.files[0]) return;
      const original = input.files[0];
      wrapper.classList.remove("filled");
      hidden.value = "";
      filenameEl.textContent = "⏳ Subiendo…";
      try {
        const comprimida = await comprimirImagen(original);
        const valor = await subirArchivo(name, comprimida);
        wrapper.classList.add("filled");
        hidden.value = valor;
        filenameEl.textContent = "✅ " + original.name;
      } catch (err) {
        wrapper.classList.remove("filled");
        hidden.value = "";
        filenameEl.textContent = "❌ No se pudo subir: " + err.message;
        input.value = "";
      }
    });
  });
}

function renderNavSession() {
  const nav = document.getElementById("nav-session");
  const user = Session.get();
  if (!user) {
    nav.innerHTML = `<a href="#/login" class="btn btn-outline btn-sm">Ingresar</a>`;
    return;
  }
  const rolLabel = user.rol === "conductor" ? "🚗 Conductor" : user.rol === "pasajero" ? "🧳 Pasajero" : "🛠️ Admin";
  nav.innerHTML = `
    <a href="#/mis-viajes" class="chip-user">${rolLabel}: ${escapeHtml(user.nombre)}</a>
    <button class="btn-logout" id="btn-logout">Salir</button>`;
  document.getElementById("btn-logout").addEventListener("click", () => {
    Session.clear();
    location.hash = "#/";
    renderNavSession();
  });
}
