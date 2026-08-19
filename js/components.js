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
// "pathname" que hay que guardar en el campo correspondiente — reemplaza lo que antes era "solo
// guardar el nombre del archivo elegido".
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
  return data.pathname;
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
        const pathname = await subirArchivo(name, comprimida);
        wrapper.classList.add("filled");
        hidden.value = pathname;
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
