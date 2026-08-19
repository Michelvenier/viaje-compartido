// components.js — piezas de UI reutilizables (acordeones, chips, tarjetas de viaje, estrellas).

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
          <div class="avatar">${iniciales(c.nombre, c.apellido)}</div>
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
// server/routes/lugares.js, para que la key de Google nunca llegue al navegador) + mapa de solo
// lectura embebido SIN key (parámetro "output=embed"), a pedido del usuario (19 ago 2026): "que
// seleccione el punto de encuentro en google maps y que le aparezca al usuario los puntos de
// encuentro... Todo esto igual a blablacar y que se seleccione y vea todo en google map".
//
// Por qué no hay un mapa "de verdad" con pin arrastrable: eso requiere la API de JavaScript de
// Google Maps, que sí necesita una key visible en el navegador — el usuario pidió explícitamente
// evitar exponer una key ahí. Este enfoque (buscar por texto en el servidor + mostrar el resultado
// en un iframe embebido de solo lectura) da la misma experiencia de elegir y ver el lugar en
// Google Maps, sin ese riesgo.
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

// Tarjeta EDITABLE de "punto de encuentro" (para cuando el conductor está publicando un viaje):
// buscador de texto + lista de resultados + previsualización del lugar elegido, para una ciudad
// puntual del camino (origen, destino, o una de las intermedias). `ciudad` es la clave exacta que
// después se usa en viaje.puntos_encuentro; `seleccionado` es el punto ya elegido para esa ciudad
// en esta sesión de edición, si hay (se preserva al re-renderizar el contenedor completo, ver
// js/views.js viewPublicar → renderPuntosEncuentroContainer).
function puntoEncuentroEditarHtml(ciudad, seleccionado) {
  return `<div class="punto-encuentro-editar" data-ciudad="${escapeHtml(ciudad)}" style="margin-top:10px;padding:10px;border:1px solid var(--border);border-radius:8px">
    <label style="font-weight:600">📍 Punto de encuentro en ${escapeHtml(ciudad)} <span class="muted" style="font-weight:400">(opcional)</span></label>
    <small class="hint">Buscá un lugar puntual — una estación de servicio, terminal, plaza, entrada a la ciudad, etc. — igual que en BlaBlaCar. Si no elegís nada, queda solo el nombre de la ciudad.</small>
    <div class="field-row" style="margin-top:6px">
      <input type="text" class="pe-buscar-input" placeholder="Ej: YPF Ruta 5, ${escapeHtml(ciudad)}" style="flex:1">
      <button type="button" class="btn btn-outline pe-buscar-btn">Buscar</button>
    </div>
    <div class="pe-resultados"></div>
    <div class="pe-seleccionado">${
      seleccionado
        ? `${puntoEncuentroVerHtml(seleccionado)}<button type="button" class="btn btn-outline danger pe-quitar-btn" style="margin-top:4px;padding:4px 10px;font-size:.85em">Quitar</button>`
        : ""
    }</div>
  </div>`;
}

// Conecta el buscador de cada tarjeta puntoEncuentroEditarHtml() dentro de `root` con el endpoint
// /api/lugares/buscar, y guarda la selección en el objeto `puntosEncuentro` (mutado in-place,
// keyeado por nombre de ciudad) para que el caller lo lea al armar el payload de publicar().
function wirePuntosEncuentro(root, puntosEncuentro) {
  root.querySelectorAll(".punto-encuentro-editar").forEach((card) => {
    const ciudad = card.getAttribute("data-ciudad");
    const input = card.querySelector(".pe-buscar-input");
    const btn = card.querySelector(".pe-buscar-btn");
    const resultados = card.querySelector(".pe-resultados");
    const seleccionadoDiv = card.querySelector(".pe-seleccionado");

    function mostrarSeleccionado(punto) {
      seleccionadoDiv.innerHTML = punto
        ? `${puntoEncuentroVerHtml(punto)}<button type="button" class="btn btn-outline danger pe-quitar-btn" style="margin-top:4px;padding:4px 10px;font-size:.85em">Quitar</button>`
        : "";
      const quitarBtn = seleccionadoDiv.querySelector(".pe-quitar-btn");
      if (quitarBtn) {
        quitarBtn.addEventListener("click", () => {
          delete puntosEncuentro[ciudad];
          mostrarSeleccionado(null);
        });
      }
    }
    mostrarSeleccionado(puntosEncuentro[ciudad]);

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
