// views.js — Renderizado de cada pantalla de la app. Cada view recibe el <main id="app">
// y los parámetros de ruta, hace sus fetch a la API y pinta el HTML correspondiente.

const CIUDADES_CORREDOR = [
  "La Plata", "Chascomús", "Rauch", "Tandil", "Balcarce", "Necochea",
  "Luján", "Mercedes", "Chivilcoy", "Bragado", "9 de Julio",
  "Carlos Casares", "Pehuajó", "Trenque Lauquen", "Santa Rosa",
];

// Menú desplegable real con todas las ciudades del corredor. Se usa tanto para
// "Salgo de" como para "Voy a" (las mismas opciones en los dos, para poder
// armar el viaje en cualquier sentido, incluyendo ida o vuelta a La Plata).
function selectCiudades(name, selected, placeholder, required) {
  const opciones = CIUDADES_CORREDOR.map(
    (c) => `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`
  ).join("");
  const vacio = placeholder ? `<option value="" ${!selected ? "selected" : ""}>${placeholder}</option>` : "";
  return `<select name="${name}" ${required ? "required" : ""}>${vacio}${opciones}</select>`;
}

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------
function viewHome(app) {
  app.innerHTML = `
    <div class="demo-banner">🚧 Prototipo funcional de demostración — los pagos y validaciones están simulados. Los datos se guardan en la base local del servidor.</div>
    <section class="hero">
      <h1>Compartí el auto. <br>Compartí los gastos.</h1>
      <p class="sub">Conectamos conductores y pasajeros que ya hacen el mismo camino entre La Plata y las localidades de la Ruta 5 y la Ruta 226.</p>
      <form class="search-box" id="home-search-form">
        <div class="field" style="margin-bottom:0">
          <label>Salgo de</label>
          ${selectCiudades("origen", "La Plata", "", true)}
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Voy a</label>
          ${selectCiudades("destino", "", "Elegí destino", true)}
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Fecha</label>
          <input type="date" name="fecha">
        </div>
        <button type="submit" class="btn btn-primary">Buscar</button>
      </form>
    </section>
    <div class="disclaimer-strip">
      ⚖️ Viaje Compartido es una plataforma de intermediación entre particulares. <strong>No prestamos el servicio de transporte</strong> —
      solo conectamos a quienes ya hacen el viaje. <a href="#/reglas-de-la-ruta" style="color:#dff5f2">Conocé las Reglas de la Ruta →</a>
    </div>

    <div class="container">
      <div class="section-title">
        <h2>¿Cómo funciona?</h2>
        <p>Tan simple como publicar o buscar un viaje.</p>
      </div>
      <div class="how-it-works">
        <div class="how-step card">
          <div class="num">1</div>
          <h3>Publicá o buscá</h3>
          <p>El conductor publica su trayecto con horarios y preferencias. El pasajero busca por origen, destino y fecha.</p>
        </div>
        <div class="how-step card">
          <div class="num">2</div>
          <h3>Reservá y confirmá</h3>
          <p>El pasajero solicita su lugar, el conductor acepta y se habilita el contacto para coordinar el encuentro.</p>
        </div>
        <div class="how-step card">
          <div class="num">3</div>
          <h3>Viajá y calificá</h3>
          <p>Se paga dentro de la app. Al llegar, ambos se califican para seguir construyendo una comunidad confiable.</p>
        </div>
      </div>

      <div class="section-title">
        <h2>Sumate a la comunidad</h2>
      </div>
      <div class="grid-2">
        <div class="card">
          <h3>🚗 Soy conductor</h3>
          <p>Ya hacés ese viaje. Compartí tus asientos libres y recuperá parte del gasto de nafta y peajes — nunca más de eso.</p>
          <a href="#/registro/conductor" class="btn btn-teal btn-block">Registrarme como conductor</a>
        </div>
        <div class="card">
          <h3>🧳 Soy pasajero</h3>
          <p>Buscá viajes a tu destino, elegí el que más te guste según precio y preferencias, y viajá más barato.</p>
          <a href="#/registro/pasajero" class="btn btn-primary btn-block">Registrarme como pasajero</a>
        </div>
      </div>
    </div>
  `;
  app.querySelector("#home-search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const params = new URLSearchParams();
    if (fd.get("origen")) params.set("origen", fd.get("origen"));
    if (fd.get("destino")) params.set("destino", fd.get("destino"));
    if (fd.get("fecha")) params.set("fecha", fd.get("fecha"));
    location.hash = `#/buscar?${params.toString()}`;
  });
}

// ---------------------------------------------------------------------------
// BUSCAR / RESULTADOS
// ---------------------------------------------------------------------------
async function viewBuscar(app, params, query) {
  app.innerHTML = `
    <div class="container">
      <div class="card" style="margin-bottom:20px">
        <form class="grid-3" id="buscar-form" style="align-items:end">
          <div class="field" style="margin-bottom:0">
            <label>Salgo de</label>
            ${selectCiudades("origen", query.origen || "", "Cualquier origen")}
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Voy a</label>
            ${selectCiudades("destino", query.destino || "", "Cualquier destino")}
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Fecha</label>
            <input type="date" name="fecha" value="${escapeHtml(query.fecha || "")}">
          </div>
          <div class="field" style="margin-bottom:0;grid-column:1/-1">
            <button class="btn btn-primary" type="submit">Actualizar búsqueda</button>
          </div>
        </form>
      </div>
      <div id="resultados-lista"><p class="muted">Buscando viajes…</p></div>
    </div>
  `;
  app.querySelector("#buscar-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const p = new URLSearchParams();
    ["origen", "destino", "fecha"].forEach((k) => fd.get(k) && p.set(k, fd.get(k)));
    location.hash = `#/buscar?${p.toString()}`;
  });

  const qs = new URLSearchParams();
  if (query.origen) qs.set("origen", query.origen);
  if (query.destino) qs.set("destino", query.destino);
  if (query.fecha) qs.set("fecha", query.fecha);

  try {
    const viajes = await Api.get(`/api/viajes?${qs.toString()}`);
    const cont = app.querySelector("#resultados-lista");
    if (viajes.length === 0) {
      cont.innerHTML = `<div class="empty-state"><div class="big">🚗💨</div><p>No encontramos viajes con esos filtros todavía.</p>
        <p class="muted">Probá con otra fecha, o <a href="#/registro/conductor">publicá el tuyo</a> si vos hacés ese camino.</p></div>`;
      return;
    }
    cont.innerHTML = `<p class="muted">${viajes.length} viaje(s) encontrados</p>` + viajes.map(renderTripCard).join("");
    cont.querySelectorAll(".trip-card").forEach((card) => {
      card.addEventListener("click", () => (location.hash = `#/viaje/${card.dataset.viajeId}`));
    });
  } catch (err) {
    app.querySelector("#resultados-lista").innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// DETALLE DE VIAJE
// ---------------------------------------------------------------------------
async function viewDetalle(app, params) {
  app.innerHTML = `<div class="container"><p class="muted">Cargando viaje…</p></div>`;
  let viaje;
  try {
    viaje = await Api.get(`/api/viajes/${params.id}`);
  } catch (err) {
    app.innerHTML = `<div class="container"><div class="error-box">${escapeHtml(err.message)}</div></div>`;
    return;
  }
  const c = viaje.conductor || {};
  const user = Session.get();
  const intermedias = (viaje.ciudades_intermedias || []).join(" · ");

  const infoAccordions = [
    {
      titulo: "¿Cómo se calculó este precio?",
      html: `<p>Distancia estimada: <strong>${viaje.distancia_km} km</strong>. Nafta usada como referencia: <strong>${fmtMoney(viaje.precio_nafta_usado)}/litro</strong>.
      Costo de combustible: <strong>${fmtMoney(viaje.costo_combustible)}</strong> + peajes <strong>${fmtMoney(viaje.peajes_estimados)}</strong> =
      Techo Operativo de <strong>${fmtMoney(viaje.cto_total)}</strong>, dividido entre ${viaje.divisor_precio} (conductor + asientos ofrecidos).
      El conductor puede ajustar hasta un 15% sobre ese valor, nunca más. <a href="#/reglas-de-la-ruta">Ver el detalle completo →</a></p>`,
    },
    {
      titulo: "¿Qué pasa si cancelo mi reserva?",
      html: `<p>Con más de 24 hs de anticipación recuperás el 100%. Dentro de las 24 hs previas, el 50% (salvo dentro de los 30 minutos de
      haber reservado, ahí es 100%). Si cancela el conductor, siempre te devolvemos el 100%.</p>`,
    },
    {
      titulo: "Validación de este conductor",
      html: `<p>Verificamos manualmente su DNI, licencia de conducir, cédula del vehículo, seguro vigente y declaración jurada de VTV antes
      de habilitarlo a publicar viajes. Esto reduce riesgos, pero no sustituye tu propio criterio: coordiná el encuentro en un lugar público
      y compartí tu viaje con alguien de confianza.</p>`,
    },
    {
      titulo: "Lo que NO cubre Viaje Compartido",
      html: `<p>No somos responsables por accidentes, siniestros, conductas entre usuarios, demoras, o el estado mecánico real del vehículo.
      Esa responsabilidad es del conductor y su seguro. <a href="#/reglas-de-la-ruta">Leer el encuadre legal completo →</a></p>`,
    },
  ];

  app.innerHTML = `
    <div class="container-narrow">
      <div class="card" style="margin-bottom:16px">
        <div class="trip-route" style="font-size:1.3rem">${escapeHtml(viaje.origen_ciudad)} <span class="arrow">→</span> ${escapeHtml(viaje.destino_ciudad)}</div>
        <p class="muted">${escapeHtml(viaje.origen_direccion)}${intermedias ? " · Pasa por: " + escapeHtml(intermedias) : ""}</p>
        <div class="trip-meta" style="margin:10px 0">
          <span>📅 ${fmtFecha(viaje.fecha_salida)}</span>
          <span>🕒 Salida ${viaje.hora_salida}${viaje.hora_llegada_estimada ? " · Llegada aprox. " + viaje.hora_llegada_estimada : ""}</span>
        </div>
        <div class="tag-row">
          ${viaje.permite_mascotas ? '<span class="tag">🐾 Acepta mascotas</span>' : '<span class="tag">🚫🐾 No mascotas</span>'}
          ${viaje.permite_equipaje_grande ? '<span class="tag">🧳 Acepta equipaje grande</span>' : '<span class="tag">🎒 Solo mochila</span>'}
          ${viaje.permite_fumar ? '<span class="tag">🚬 Se puede fumar</span>' : '<span class="tag">🚭 No fumadores</span>'}
          <span class="tag">${viaje.pref_charla === "silencio" ? "🤫 Prefiere silencio" : "💬 Le gusta charlar"}</span>
          <span class="tag">${viaje.pref_musica === "no" ? "🔇 Sin música" : "🎵 Con música"}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <div class="avatar lg">${iniciales(c.nombre, c.apellido)}</div>
          <div>
            <strong>${escapeHtml(c.nombre || "")} ${escapeHtml((c.apellido || "")[0] || "")}.</strong>
            <div class="muted">${c.rating_count ? `★ ${c.rating_promedio} (${c.rating_count} viajes)` : "Todavía sin calificaciones"}</div>
            <div class="muted">${escapeHtml(c.vehiculo_marca || "")} ${escapeHtml(c.vehiculo_modelo || "")} ${c.vehiculo_color ? "· " + escapeHtml(c.vehiculo_color) : ""}</div>
            ${c.bio ? `<p style="margin-top:6px">"${escapeHtml(c.bio)}"</p>` : ""}
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="price-breakdown" style="border-top:none;padding-top:0">
          <div class="row total"><span>Precio por asiento</span><span>${fmtMoney(viaje.precio_por_asiento)}</span></div>
        </div>
        <div id="reserva-zona" style="margin-top:14px"></div>
      </div>

      <div class="card">
        <h3>Todo lo que necesitás saber</h3>
        ${renderAccordion(infoAccordions, "detalle")}
      </div>
    </div>
  `;
  wireAccordions(app);

  const zona = app.querySelector("#reserva-zona");
  if (viaje.estado !== "activo" || viaje.asientos_disponibles < 1) {
    zona.innerHTML = `<div class="info-box">Este viaje ya no tiene asientos disponibles.</div>`;
  } else if (!user) {
    zona.innerHTML = `<div class="info-box">Para reservar necesitás <a href="#/login">iniciar sesión</a> o <a href="#/registro/pasajero">crear tu perfil de pasajero</a>.</div>`;
  } else if (user.id === viaje.conductor_id) {
    zona.innerHTML = `<div class="info-box">Este es tu viaje publicado. Gestioná las solicitudes desde <a href="#/mis-viajes">Mis viajes</a>.</div>`;
  } else if (user.rol !== "pasajero") {
    zona.innerHTML = `<div class="info-box">Solo los perfiles de pasajero pueden reservar un lugar.</div>`;
  } else if (user.estado_validacion !== "aprobado") {
    zona.innerHTML = `<div class="info-box">Tu perfil todavía está en revisión manual. Te avisamos por WhatsApp en menos de 24 hs.</div>`;
  } else {
    zona.innerHTML = `
      <form id="form-reserva">
        <div class="field-row">
          <div class="field">
            <label>Asientos a reservar</label>
            <select name="asientos_reservados">
              ${Array.from({ length: viaje.asientos_disponibles }, (_, i) => i + 1)
                .map((n) => `<option value="${n}">${n}</option>`)
                .join("")}
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Solicitar reserva</button>
        <p class="muted" style="margin-top:8px">El conductor tiene que aceptar tu solicitud antes de que se habilite el pago.</p>
      </form>`;
    app.querySelector("#form-reserva").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await Api.post("/api/reservas", {
          viaje_id: viaje.id,
          pasajero_id: user.id,
          asientos_reservados: Number(fd.get("asientos_reservados")),
        });
        toast("¡Solicitud enviada! Te avisamos cuando el conductor responda.", "success");
        location.hash = "#/mis-viajes";
      } catch (err) {
        toast(err.message, "error");
      }
    });
  }
}

// ---------------------------------------------------------------------------
// PUBLICAR VIAJE (conductor)
// ---------------------------------------------------------------------------
function viewPublicar(app) {
  const user = Session.get();
  if (!user || user.rol !== "conductor") {
    app.innerHTML = `<div class="container-narrow"><div class="card">
      <h2>Publicá tu viaje</h2>
      <p>Para publicar un viaje necesitás un perfil de conductor validado.</p>
      <a href="#/registro/conductor" class="btn btn-teal">Registrarme como conductor</a>
      ${!user ? `<p class="muted" style="margin-top:10px">¿Ya tenés cuenta? <a href="#/login">Iniciá sesión</a></p>` : ""}
    </div></div>`;
    return;
  }
  if (user.estado_validacion !== "aprobado") {
    app.innerHTML = `<div class="container-narrow"><div class="card">
      <h2>Tu perfil está en revisión</h2>
      <div class="info-box">Revisamos cada perfil manualmente para tu seguridad y la de la comunidad. Te avisamos por WhatsApp en menos
      de 24 hs cuando estés habilitado para publicar viajes.</div>
    </div></div>`;
    return;
  }

  app.innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <h2>Publicá tu viaje</h2>
        <p class="muted">Completá los datos del trayecto. Calculamos el precio sugerido según nafta y peajes — vos podés ajustarlo hasta un 15%.</p>
        <div id="publicar-error"></div>
        <form id="form-publicar">
          <div class="field">
            <label>Punto de partida exacto</label>
            <input type="text" name="origen_direccion" placeholder="Ej: Terminal de Ómnibus, La Plata" required>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Ciudad de origen</label>
              ${selectCiudades("origen_ciudad", "La Plata", "", true)}
            </div>
            <div class="field">
              <label>Ciudad de destino</label>
              ${selectCiudades("destino_ciudad", "", "Elegí destino", true)}
            </div>
          </div>
          <div class="field">
            <label>Ciudades intermedias</label>
            <input type="text" name="ciudades_intermedias" placeholder="Separadas por coma. Ej: Chascomús, Rauch">
            <small class="hint">Así tu viaje aparece en búsquedas de gente que hace solo un tramo del camino.</small>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Fecha de salida</label>
              <input type="date" name="fecha_salida" required>
            </div>
            <div class="field">
              <label>Horario de salida</label>
              <input type="time" name="hora_salida" required>
            </div>
            <div class="field">
              <label>Llegada aproximada</label>
              <input type="time" name="hora_llegada_estimada">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Distancia estimada (km)</label>
              <input type="number" name="distancia_km" min="1" step="1" required>
            </div>
            <div class="field">
              <label>Peajes estimados ($)</label>
              <input type="number" name="peajes_estimados" min="0" step="1" value="0">
            </div>
            <div class="field">
              <label>Asientos a ofrecer</label>
              <select name="asientos_totales">
                <option value="1">1</option><option value="2">2</option><option value="3" selected>3 (recomendado)</option>
                <option value="4">4 (completa el auto)</option>
              </select>
            </div>
          </div>

          <div id="precio-preview" class="info-box" style="margin-bottom:16px">Completá distancia y peajes para ver el precio sugerido.</div>

          <div class="field">
            <label>Precio final por asiento</label>
            <input type="number" name="precio_por_asiento" min="0" step="1" placeholder="Se completa automáticamente">
            <small class="hint" id="precio-hint">Podés ajustarlo hasta un 15% sobre el sugerido, sin superar el Techo Operativo del viaje.</small>
          </div>

          <div class="field">
            <label>Atributos de convivencia y carga</label>
            <div class="checkbox-row"><input type="checkbox" name="permite_mascotas" id="chk-mascotas"><label for="chk-mascotas">¿Permite mascotas?</label></div>
            <div class="checkbox-row"><input type="checkbox" name="permite_equipaje_grande" id="chk-equipaje"><label for="chk-equipaje">¿Permite equipaje grande?</label></div>
            <div class="checkbox-row"><input type="checkbox" name="permite_fumar" id="chk-fumar"><label for="chk-fumar">¿Permite fumar?</label></div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>¿Charla o silencio?</label>
              ${renderChips("pref_charla", [{ value: "charla", label: "💬 Charla" }, { value: "silencio", label: "🤫 Silencio" }, { value: "indistinto", label: "🤷 Indistinto" }], "indistinto")}
            </div>
            <div class="field">
              <label>¿Música sí o no?</label>
              ${renderChips("pref_musica", [{ value: "si", label: "🎵 Sí" }, { value: "no", label: "🔇 No" }, { value: "indistinto", label: "🤷 Indistinto" }], "indistinto")}
            </div>
          </div>
          <button class="btn btn-primary btn-block" type="submit">Publicar viaje</button>
        </form>
      </div>
    </div>
  `;
  wireChips(app);

  const form = app.querySelector("#form-publicar");
  let ultimoCalculo = null;

  async function actualizarPreview() {
    const fd = new FormData(form);
    const distancia = Number(fd.get("distancia_km"));
    if (!distancia) return;
    try {
      const calc = await Api.post("/api/pricing/calcular", {
        distancia_km: distancia,
        peajes_estimados: Number(fd.get("peajes_estimados")) || 0,
        asientos_totales: Number(fd.get("asientos_totales")) || 3,
      });
      ultimoCalculo = calc;
      app.querySelector("#precio-preview").innerHTML = `
        <div class="price-breakdown" style="border-top:none;padding-top:0">
          <div class="row"><span>Litros estimados (10L/100km)</span><span>${calc.litrosEstimados} L</span></div>
          <div class="row"><span>Costo combustible (nafta a ${fmtMoney(calc.precioNaftaUsado)}/L)</span><span>${fmtMoney(calc.costoCombustible)}</span></div>
          <div class="row"><span>Techo Operativo del viaje (C.T.O.)</span><span>${fmtMoney(calc.ctoTotal)}</span></div>
          <div class="row total"><span>Precio sugerido por asiento</span><span>${fmtMoney(calc.precioSugerido)}</span></div>
        </div>
        <p class="muted" style="margin:6px 0 0">Rango permitido: ${fmtMoney(calc.precioMinimoSugerido)} — ${fmtMoney(calc.precioMaximoPermitido)}</p>`;
      const precioInput = form.querySelector('[name="precio_por_asiento"]');
      if (!precioInput.value || Number(precioInput.dataset.auto) === 1) {
        precioInput.value = calc.precioSugerido;
        precioInput.dataset.auto = "1";
      }
    } catch (err) {
      app.querySelector("#precio-preview").innerHTML = `<span style="color:var(--danger)">${escapeHtml(err.message)}</span>`;
    }
  }
  ["distancia_km", "peajes_estimados", "asientos_totales"].forEach((n) => {
    form.querySelector(`[name="${n}"]`).addEventListener("input", actualizarPreview);
  });
  form.querySelector('[name="precio_por_asiento"]').addEventListener("input", (e) => {
    e.target.dataset.auto = "0";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      conductor_id: user.id,
      origen_direccion: fd.get("origen_direccion"),
      origen_ciudad: fd.get("origen_ciudad"),
      destino_ciudad: fd.get("destino_ciudad"),
      ciudades_intermedias: (fd.get("ciudades_intermedias") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      fecha_salida: fd.get("fecha_salida"),
      hora_salida: fd.get("hora_salida"),
      hora_llegada_estimada: fd.get("hora_llegada_estimada") || null,
      distancia_km: Number(fd.get("distancia_km")),
      peajes_estimados: Number(fd.get("peajes_estimados")) || 0,
      asientos_totales: Number(fd.get("asientos_totales")) || 3,
      precio_por_asiento: Number(fd.get("precio_por_asiento")) || undefined,
      permite_mascotas: !!fd.get("permite_mascotas"),
      permite_equipaje_grande: !!fd.get("permite_equipaje_grande"),
      permite_fumar: !!fd.get("permite_fumar"),
      pref_charla: fd.get("pref_charla") || "indistinto",
      pref_musica: fd.get("pref_musica") || "indistinto",
    };
    try {
      const viaje = await Api.post("/api/viajes", payload);
      toast("¡Viaje publicado!", "success");
      location.hash = `#/viaje/${viaje.id}`;
    } catch (err) {
      app.querySelector("#publicar-error").innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
    }
  });
}

// ---------------------------------------------------------------------------
// REGISTRO — wizard de 3 pasos para Conductor y Pasajero
// ---------------------------------------------------------------------------
function viewRegistro(app, params) {
  const rol = params.rol === "conductor" ? "conductor" : "pasajero";
  const data = {};
  let step = 1;
  const totalSteps = 3;

  function stepsBarHtml() {
    let bar = '<div class="steps-bar">';
    for (let i = 1; i <= totalSteps; i++) bar += `<div class="step ${i <= step ? "done" : ""}"></div>`;
    bar += "</div>";
    return bar;
  }

  function ayudaWsp() {
    return `<a href="https://wa.me/5490000000000" target="_blank" rel="noopener" class="muted" style="display:inline-flex;gap:6px;align-items:center;margin-top:10px">💬 ¿Dudas con el registro? Escribinos</a>`;
  }

  function render() {
    let titulo, subtitulo, bodyHtml;

    if (rol === "conductor") {
      if (step === 1) {
        titulo = "Completá tu Perfil de Conductor";
        subtitulo = "Paso 1: Lo básico";
        bodyHtml = `
          <div class="field"><label>Nombre y Apellido (como figura en el DNI)</label>
            <div class="field-row">
              <input type="text" id="f-nombre" placeholder="Nombre" value="${escapeHtml(data.nombre || "")}">
              <input type="text" id="f-apellido" placeholder="Apellido" value="${escapeHtml(data.apellido || "")}">
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>Edad</label><input type="number" id="f-edad" min="18" max="99" value="${data.edad || ""}"></div>
            <div class="field"><label>DNI</label><input type="text" id="f-dni" placeholder="Sin puntos" value="${escapeHtml(data.dni || "")}"></div>
          </div>
          ${renderUploadField("foto_perfil", "Foto de perfil", "Subí una foto donde se te vea la cara (¡sonreí, da más confianza!).")}
          <div class="field"><label>Sobre vos</label>
            <textarea id="f-bio" placeholder="¿Mate amargo o dulce? ¿Hablamos de bueyes perdidos o preferís silencio?">${escapeHtml(data.bio || "")}</textarea>
          </div>
          <div class="field-row">
            <div class="field"><label>Celular</label><input type="tel" id="f-telefono" placeholder="221 000 0000" value="${escapeHtml(data.telefono || "")}"></div>
            <div class="field"><label>Email</label><input type="email" id="f-email" value="${escapeHtml(data.email || "")}"></div>
          </div>
          <div class="field"><label>Domicilio de residencia</label><input type="text" id="f-domicilio" value="${escapeHtml(data.domicilio || "")}"></div>
        `;
      } else if (step === 2) {
        titulo = "Tu Seguridad";
        subtitulo = "Paso 2: Lo legal";
        bodyHtml = `
          ${renderUploadField("doc_dni_frente", "DNI (frente)", "Botón de subir foto o sacar foto.")}
          ${renderUploadField("doc_dni_dorso", "DNI (dorso)")}
          ${renderUploadField("doc_selfie", "Selfie de validación", "Sacate una foto sosteniendo tu DNI al lado de tu cara.")}
          ${renderUploadField("doc_licencia", "Licencia de conducir")}
          ${renderUploadField("doc_cedula", "Cédula verde / azul")}
          ${renderUploadField("doc_seguro", "Seguro vigente", "Subí una captura o foto de tu tarjeta de seguro (la que te pide la caminera en la Ruta 5).")}
          <div class="checkbox-row">
            <input type="checkbox" id="f-vtv" ${data.doc_vtv_declarada ? "checked" : ""}>
            <label for="f-vtv">Declaro bajo declaración jurada que mi VTV está vigente.</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="f-reglas" ${data.acepta_reglas ? "checked" : ""}>
            <label for="f-reglas">Leí y acepto las <a href="#/reglas-de-la-ruta" target="_blank">Reglas de la Ruta: cuidamos la comunidad</a>.</label>
          </div>
        `;
      } else {
        titulo = "Tu Máquina";
        subtitulo = "Paso 3: El auto";
        bodyHtml = `
          <div class="field-row">
            <div class="field"><label>Marca</label><input type="text" id="f-marca" placeholder="Ej: Renault" value="${escapeHtml(data.vehiculo_marca || "")}"></div>
            <div class="field"><label>Modelo</label><input type="text" id="f-modelo" placeholder="Ej: Sandero" value="${escapeHtml(data.vehiculo_modelo || "")}"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Color</label><input type="text" id="f-color" value="${escapeHtml(data.vehiculo_color || "")}"></div>
            <div class="field"><label>Patente</label><input type="text" id="f-patente" placeholder="Solo para control interno" value="${escapeHtml(data.vehiculo_patente || "")}"></div>
          </div>
          ${renderUploadField("vehiculo_foto", "Foto del auto", "Para que tus pasajeros te encuentren fácil en la plaza o la estación.")}
          <div class="field"><label>Cantidad de asientos disponibles</label>
            <select id="f-asientos">
              <option value="1" ${data.vehiculo_asientos == 1 ? "selected" : ""}>1</option>
              <option value="2" ${data.vehiculo_asientos == 2 ? "selected" : ""}>2</option>
              <option value="3" ${!data.vehiculo_asientos || data.vehiculo_asientos == 3 ? "selected" : ""}>3 (recomendado, viajan cómodos atrás)</option>
            </select>
          </div>
          <div class="field"><label>Preferencias para tu perfil</label>
            <div class="field-row">
              ${renderChips("pref_charla", [{ value: "charla", label: "💬 Charla" }, { value: "silencio", label: "🤫 Silencio" }], data.pref_charla)}
              ${renderChips("pref_musica", [{ value: "si", label: "🎵 Música sí" }, { value: "no", label: "🔇 Música no" }], data.pref_musica)}
            </div>
            <div class="checkbox-row"><input type="checkbox" id="f-fuma" ${data.pref_fuma ? "checked" : ""}><label for="f-fuma">Fumo en el auto</label></div>
            <div class="checkbox-row"><input type="checkbox" id="f-mascotas" ${data.pref_mascotas ? "checked" : ""}><label for="f-mascotas">Acepto mascotas</label></div>
          </div>
        `;
      }
    } else {
      if (step === 1) {
        titulo = "Creá tu Perfil de Pasajero";
        subtitulo = "Paso 1: Lo básico (identidad)";
        bodyHtml = `
          <div class="field"><label>Nombre y Apellido (como en el DNI)</label>
            <div class="field-row">
              <input type="text" id="f-nombre" placeholder="Nombre" value="${escapeHtml(data.nombre || "")}">
              <input type="text" id="f-apellido" placeholder="Apellido" value="${escapeHtml(data.apellido || "")}">
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>Edad</label><input type="number" id="f-edad" min="16" max="99" value="${data.edad || ""}"></div>
            <div class="field"><label>DNI</label><input type="text" id="f-dni" placeholder="Sin puntos" value="${escapeHtml(data.dni || "")}"></div>
          </div>
          ${renderUploadField("foto_perfil", "Foto de perfil", "Una foto donde se te vea bien la cara (ayuda a que el conductor te reconozca en el punto de encuentro).")}
          ${renderUploadField("doc_dni_frente", "DNI (frente)", "Esto es innegociable por seguridad de la comunidad.")}
          ${renderUploadField("doc_dni_dorso", "DNI (dorso)")}
          ${renderUploadField("doc_selfie", "Selfie de validación", "Para asegurar que sos la persona del DNI.")}
        `;
      } else if (step === 2) {
        titulo = "Confianza y Comunicación";
        subtitulo = "Paso 2";
        bodyHtml = `
          <div class="field"><label>Celular (validado)</label>
            <input type="tel" id="f-telefono" placeholder="221 000 0000" value="${escapeHtml(data.telefono || "")}">
            <small class="hint">Es vital para que el conductor te pueda avisar: "Che, estoy demorado 5 min en la rotonda".</small>
          </div>
          <div class="field"><label>Email</label><input type="email" id="f-email" value="${escapeHtml(data.email || "")}"></div>
          <div class="checkbox-row">
            <input type="checkbox" id="f-reglas" ${data.acepta_reglas ? "checked" : ""}>
            <label for="f-reglas">Leí y acepto las <a href="#/reglas-de-la-ruta" target="_blank">Reglas de la Ruta: cuidamos la comunidad</a>.</label>
          </div>
        `;
      } else {
        titulo = "Preferencias de viaje";
        subtitulo = "Paso 3: el etiquetado";
        bodyHtml = `
          <div class="field"><label>Equipaje</label>
            ${renderChips("pref_equipaje", [{ value: "mochila", label: "🎒 Llevo mochila" }, { value: "valija", label: "🧳 Llevo valija grande" }], data.pref_equipaje)}
          </div>
          <div class="field"><label>Compañía</label>
            ${renderChips("pref_charla", [{ value: "charla", label: "💬 Me gusta charlar" }, { value: "silencio", label: "😴 Prefiero viajar tranquilo" }], data.pref_charla)}
          </div>
          <div class="field"><label>Mascotas</label>
            <div class="checkbox-row"><input type="checkbox" id="f-viaja-mascota" ${data.pref_mascotas ? "checked" : ""}><label for="f-viaja-mascota">¿Viajás con perro/gato? (requiere aprobación del conductor)</label></div>
          </div>
        `;
      }
    }

    app.innerHTML = `
      <div class="container-narrow">
        <div class="card">
          ${stepsBarHtml()}
          <div class="step-title">${subtitulo}</div>
          <h2>${titulo}</h2>
          <div id="registro-error"></div>
          <div id="registro-body">${bodyHtml}</div>
          <div style="display:flex;gap:10px;margin-top:18px">
            ${step > 1 ? `<button class="btn btn-outline" id="btn-atras">Atrás</button>` : ""}
            <button class="btn ${step === totalSteps ? "btn-primary" : "btn-teal"}" id="btn-siguiente" style="flex:1">
              ${step === totalSteps ? "Enviar mi perfil" : "Siguiente"}
            </button>
          </div>
          ${step === totalSteps ? `<p class="muted" style="margin-top:10px">Revisamos cada perfil manualmente para tu seguridad. Te avisamos por WhatsApp en menos de 24 hs cuando estés habilitado.</p>${ayudaWsp()}` : ayudaWsp()}
        </div>
      </div>`;

    wireUploads(app);
    wireChips(app);

    if (step > 1) app.querySelector("#btn-atras").addEventListener("click", () => { guardarPaso(); step--; render(); });
    app.querySelector("#btn-siguiente").addEventListener("click", async () => {
      guardarPaso();
      if (!validarPaso()) return;
      if (step < totalSteps) {
        step++;
        render();
      } else {
        await enviar();
      }
    });
  }

  function guardarPaso() {
    const q = (id) => app.querySelector(id);
    const getUpload = (name) => {
      const el = app.querySelector(`[data-upload-hidden="${name}"]`);
      return el ? el.value : undefined;
    };
    if (rol === "conductor") {
      if (step === 1) {
        Object.assign(data, {
          nombre: q("#f-nombre")?.value, apellido: q("#f-apellido")?.value, edad: q("#f-edad")?.value, dni: q("#f-dni")?.value,
          foto_perfil: getUpload("foto_perfil") || data.foto_perfil, bio: q("#f-bio")?.value,
          telefono: q("#f-telefono")?.value, email: q("#f-email")?.value, domicilio: q("#f-domicilio")?.value,
        });
      } else if (step === 2) {
        Object.assign(data, {
          doc_dni_frente: getUpload("doc_dni_frente") || data.doc_dni_frente,
          doc_dni_dorso: getUpload("doc_dni_dorso") || data.doc_dni_dorso,
          doc_selfie: getUpload("doc_selfie") || data.doc_selfie,
          doc_licencia: getUpload("doc_licencia") || data.doc_licencia,
          doc_cedula: getUpload("doc_cedula") || data.doc_cedula,
          doc_seguro: getUpload("doc_seguro") || data.doc_seguro,
          doc_vtv_declarada: q("#f-vtv")?.checked,
          acepta_reglas: q("#f-reglas")?.checked,
        });
      } else {
        Object.assign(data, {
          vehiculo_marca: q("#f-marca")?.value, vehiculo_modelo: q("#f-modelo")?.value,
          vehiculo_color: q("#f-color")?.value, vehiculo_patente: q("#f-patente")?.value,
          vehiculo_foto: getUpload("vehiculo_foto") || data.vehiculo_foto,
          vehiculo_asientos: Number(q("#f-asientos")?.value) || 3,
          pref_charla: app.querySelector('[name="pref_charla"]')?.value || data.pref_charla,
          pref_musica: app.querySelector('[name="pref_musica"]')?.value || data.pref_musica,
          pref_fuma: q("#f-fuma")?.checked, pref_mascotas: q("#f-mascotas")?.checked,
        });
      }
    } else {
      if (step === 1) {
        Object.assign(data, {
          nombre: q("#f-nombre")?.value, apellido: q("#f-apellido")?.value, edad: q("#f-edad")?.value, dni: q("#f-dni")?.value,
          foto_perfil: getUpload("foto_perfil") || data.foto_perfil,
          doc_dni_frente: getUpload("doc_dni_frente") || data.doc_dni_frente,
          doc_dni_dorso: getUpload("doc_dni_dorso") || data.doc_dni_dorso,
          doc_selfie: getUpload("doc_selfie") || data.doc_selfie,
        });
      } else if (step === 2) {
        Object.assign(data, {
          telefono: q("#f-telefono")?.value, email: q("#f-email")?.value,
          acepta_reglas: q("#f-reglas")?.checked,
        });
      } else {
        Object.assign(data, {
          pref_equipaje: app.querySelector('[name="pref_equipaje"]')?.value || data.pref_equipaje,
          pref_charla: app.querySelector('[name="pref_charla"]')?.value || data.pref_charla,
          pref_mascotas: q("#f-viaja-mascota")?.checked,
        });
      }
    }
  }

  function validarPaso() {
    const errores = [];
    if (rol === "conductor" && step === 1) {
      if (!data.nombre || !data.apellido) errores.push("Completá nombre y apellido.");
      if (!data.dni) errores.push("Ingresá tu DNI.");
      if (!data.telefono) errores.push("Ingresá tu celular.");
      if (!data.email) errores.push("Ingresá tu email.");
    }
    if (rol === "conductor" && step === 2) {
      if (!data.doc_dni_frente || !data.doc_dni_dorso) errores.push("Subí ambas fotos del DNI.");
      if (!data.doc_selfie) errores.push("Subí la selfie de validación.");
      if (!data.doc_licencia || !data.doc_cedula || !data.doc_seguro) errores.push("Faltan documentos del vehículo.");
      if (!data.doc_vtv_declarada) errores.push("Tenés que declarar tu VTV vigente.");
      if (!data.acepta_reglas) errores.push("Tenés que aceptar las Reglas de la Ruta.");
    }
    if (rol === "conductor" && step === 3) {
      if (!data.vehiculo_marca || !data.vehiculo_modelo || !data.vehiculo_patente) errores.push("Completá los datos del vehículo.");
    }
    if (rol === "pasajero" && step === 1) {
      if (!data.nombre || !data.apellido) errores.push("Completá nombre y apellido.");
      if (!data.dni) errores.push("Ingresá tu DNI.");
      if (!data.doc_dni_frente || !data.doc_dni_dorso) errores.push("Subí ambas fotos del DNI.");
      if (!data.doc_selfie) errores.push("Subí la selfie de validación.");
    }
    if (rol === "pasajero" && step === 2) {
      if (!data.telefono) errores.push("Ingresá tu celular.");
      if (!data.email) errores.push("Ingresá tu email.");
      if (!data.acepta_reglas) errores.push("Tenés que aceptar las Reglas de la Ruta.");
    }
    if (errores.length) {
      app.querySelector("#registro-error").innerHTML = `<div class="error-box">${errores.map(escapeHtml).join("<br>")}</div>`;
      return false;
    }
    app.querySelector("#registro-error").innerHTML = "";
    return true;
  }

  async function enviar() {
    try {
      const usuario = await Api.post(`/api/usuarios/${rol}`, data);
      toast(usuario.mensaje, "success");
      Session.set(usuario.usuario);
      renderNavSession();
      location.hash = "#/mis-viajes";
    } catch (err) {
      app.querySelector("#registro-error").innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
    }
  }

  render();
}

// ---------------------------------------------------------------------------
// LOGIN (demo)
// ---------------------------------------------------------------------------
function viewLogin(app) {
  app.innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <h2>Ingresar</h2>
        <p class="muted">Esta es una demo: ingresá el email con el que te registraste.</p>
        <div id="login-error"></div>
        <form id="form-login">
          <div class="field"><label>Email</label><input type="email" name="email" required></div>
          <button class="btn btn-primary btn-block" type="submit">Ingresar</button>
        </form>
        <div class="info-box" style="margin-top:16px">
          <strong>Probar la demo rápido:</strong>
          <div class="demo-login-row">
            <button class="btn btn-outline btn-sm" data-demo="martin.conductor@example.com">🚗 Conductor demo</button>
            <button class="btn btn-outline btn-sm" data-demo="laura.conductora@example.com">🚗 Conductora demo</button>
            <button class="btn btn-outline btn-sm" data-demo="sofia.pasajera@example.com">🧳 Pasajera demo</button>
            <button class="btn btn-outline btn-sm" data-demo="admin@viajecompartido.com.ar">🛠️ Admin demo</button>
          </div>
        </div>
        <p class="muted" style="margin-top:14px">¿No tenés cuenta? <a href="#/registro/pasajero">Creá tu perfil de pasajero</a> o
        <a href="#/registro/conductor">de conductor</a>.</p>
      </div>
    </div>`;

  async function doLogin(email) {
    try {
      const usuario = await Api.post("/api/usuarios/login", { email });
      Session.set(usuario);
      renderNavSession();
      toast(`¡Hola, ${usuario.nombre}!`, "success");
      location.hash = "#/mis-viajes";
    } catch (err) {
      app.querySelector("#login-error").innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`;
    }
  }

  app.querySelector("#form-login").addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin(new FormData(e.target).get("email"));
  });
  app.querySelectorAll("[data-demo]").forEach((btn) => btn.addEventListener("click", () => doLogin(btn.dataset.demo)));
}

// ---------------------------------------------------------------------------
// MIS VIAJES — panel según rol (conductor: viajes publicados + solicitudes; pasajero: reservas)
// ---------------------------------------------------------------------------
async function viewMisViajes(app) {
  const user = Session.get();
  if (!user) {
    location.hash = "#/login";
    return;
  }
  if (user.rol === "admin") {
    location.hash = "#/admin";
    return;
  }

  app.innerHTML = `<div class="container"><p class="muted">Cargando...</p></div>`;

  if (user.rol === "conductor") {
    let viajes;
    try {
      viajes = await Api.get(`/api/viajes/conductor/${user.id}`);
    } catch (err) {
      app.innerHTML = `<div class="container"><div class="error-box">${escapeHtml(err.message)}</div></div>`;
      return;
    }
    app.innerHTML = `
      <div class="container">
        <div class="section-title" style="text-align:left;margin-top:10px">
          <h2>Mis viajes publicados</h2>
        </div>
        <a href="#/publicar" class="btn btn-primary" style="margin-bottom:18px;display:inline-block">+ Publicar nuevo viaje</a>
        <div id="lista-viajes-conductor"></div>
      </div>`;
    const cont = app.querySelector("#lista-viajes-conductor");
    if (viajes.length === 0) {
      cont.innerHTML = `<div class="empty-state"><div class="big">🗺️</div><p>Todavía no publicaste ningún viaje.</p></div>`;
      return;
    }
    for (const viaje of viajes) {
      const bloque = document.createElement("div");
      bloque.className = "card";
      bloque.style.marginBottom = "16px";
      bloque.innerHTML = `
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div class="trip-route">${escapeHtml(viaje.origen_ciudad)} <span class="arrow">→</span> ${escapeHtml(viaje.destino_ciudad)}</div>
            <div class="muted">📅 ${fmtFecha(viaje.fecha_salida)} · 🕒 ${viaje.hora_salida} · 💺 ${viaje.asientos_disponibles}/${viaje.asientos_totales} libres</div>
          </div>
          <div style="text-align:right">
            <span class="status-pill ${viaje.estado}">${viaje.estado}</span>
            <div class="amount" style="font-size:1.1rem">${fmtMoney(viaje.precio_por_asiento)}<span class="muted" style="font-size:0.7rem"> /asiento</span></div>
          </div>
        </div>
        ${viaje.estado === "activo" ? `<button class="btn btn-outline danger btn-sm" data-cancelar-viaje="${viaje.id}" style="margin-top:10px">Cancelar viaje</button>` : ""}
        <div class="solicitudes" data-solicitudes-de="${viaje.id}" style="margin-top:14px"></div>
      `;
      cont.appendChild(bloque);

      const reservas = await Api.get(`/api/reservas/viaje/${viaje.id}`);
      const solicitudesEl = bloque.querySelector(".solicitudes");
      if (reservas.length === 0) {
        solicitudesEl.innerHTML = `<p class="muted">Todavía no recibiste solicitudes para este viaje.</p>`;
      } else {
        solicitudesEl.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:10px">
          ${reservas.map((r) => renderSolicitudRow(r)).join("")}
        </div>`;
      }
    }
    wireSolicitudes(app);
    app.querySelectorAll("[data-cancelar-viaje]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Cancelar este viaje? Los pasajeros con reserva confirmada serán reembolsados en su totalidad.")) return;
        try {
          await Api.del(`/api/viajes/${btn.dataset.cancelarViaje}`);
          toast("Viaje cancelado", "success");
          viewMisViajes(app);
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  } else {
    // Pasajero
    let reservas;
    try {
      reservas = await Api.get(`/api/reservas/pasajero/${user.id}`);
    } catch (err) {
      app.innerHTML = `<div class="container"><div class="error-box">${escapeHtml(err.message)}</div></div>`;
      return;
    }
    app.innerHTML = `
      <div class="container">
        <div class="section-title" style="text-align:left;margin-top:10px"><h2>Mis reservas</h2></div>
        <a href="#/buscar" class="btn btn-primary" style="margin-bottom:18px;display:inline-block">Buscar un viaje</a>
        <div id="lista-reservas-pasajero"></div>
      </div>`;
    const cont = app.querySelector("#lista-reservas-pasajero");
    if (reservas.length === 0) {
      cont.innerHTML = `<div class="empty-state"><div class="big">🧳</div><p>Todavía no reservaste ningún viaje.</p></div>`;
      return;
    }
    cont.innerHTML = reservas
      .map(
        (r) => `
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div class="trip-route">${escapeHtml(r.origen_ciudad)} <span class="arrow">→</span> ${escapeHtml(r.destino_ciudad)}</div>
            <div class="muted">📅 ${fmtFecha(r.fecha_salida)} · 🕒 ${r.hora_salida} · 💺 ${r.asientos_reservados} asiento(s)</div>
          </div>
          <div style="text-align:right">
            <span class="status-pill ${r.estado}">${r.estado}</span>
            <div class="amount" style="font-size:1.1rem">${fmtMoney(r.monto_total)}</div>
            ${r.pagado ? '<div class="muted" style="font-size:0.75rem">✅ Pagado</div>' : ""}
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${r.estado === "aceptada" && !r.pagado ? `<a href="#/reserva/${r.id}/pagar" class="btn btn-primary btn-sm">Pagar ahora</a>` : ""}
          ${["pendiente", "aceptada"].includes(r.estado) ? `<button class="btn btn-outline danger btn-sm" data-cancelar-reserva="${r.id}">Cancelar reserva</button>` : ""}
          ${r.estado === "completada" ? `<a href="#/calificar/${r.id}" class="btn btn-outline btn-sm">Calificar viaje</a>` : ""}
        </div>
      </div>`
      )
      .join("");
    app.querySelectorAll("[data-cancelar-reserva]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await Api.patch(`/api/reservas/${btn.dataset.cancelarReserva}`, { estado: "cancelada" });
          toast("Reserva cancelada", "success");
          viewMisViajes(app);
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  }
}

function renderSolicitudRow(r) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;flex-wrap:wrap;gap:8px" data-reserva-row="${r.id}">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="avatar">${iniciales(r.nombre, r.apellido)}</div>
        <div>
          <strong>${escapeHtml(r.nombre)} ${escapeHtml(r.apellido)}</strong>
          <div class="muted">${r.asientos_reservados} asiento(s) · ${fmtMoney(r.monto_total)} ${r.rating_count ? `· ★ ${r.rating_promedio}` : ""}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="status-pill ${r.estado}">${r.estado}</span>
        ${
          r.estado === "pendiente"
            ? `<button class="btn btn-teal btn-sm" data-aceptar="${r.id}">Aceptar</button><button class="btn btn-outline danger btn-sm" data-rechazar="${r.id}">Rechazar</button>`
            : ""
        }
        ${r.estado === "completada" ? `<a href="#/calificar/${r.id}" class="btn btn-outline btn-sm">Calificar</a>` : ""}
      </div>
    </div>`;
}

function wireSolicitudes(app) {
  app.querySelectorAll("[data-aceptar]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await Api.patch(`/api/reservas/${btn.dataset.aceptar}`, { estado: "aceptada" });
        toast("Reserva aceptada. Ahora podés coordinar con el pasajero.", "success");
        viewMisViajes(document.getElementById("app"));
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );
  app.querySelectorAll("[data-rechazar]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await Api.patch(`/api/reservas/${btn.dataset.rechazar}`, { estado: "rechazada" });
        toast("Reserva rechazada", "info");
        viewMisViajes(document.getElementById("app"));
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );
}

// ---------------------------------------------------------------------------
// PAGAR (simulado)
// ---------------------------------------------------------------------------
async function viewPagar(app, params) {
  app.innerHTML = `<div class="container-narrow"><p class="muted">Cargando reserva…</p></div>`;
  let reserva;
  try {
    reserva = await Api.get(`/api/reservas/${params.id}`);
  } catch (err) {
    app.innerHTML = `<div class="container-narrow"><div class="error-box">${escapeHtml(err.message)}</div></div>`;
    return;
  }
  app.innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <h2>Confirmar pago</h2>
        <p class="muted">${escapeHtml(reserva.origen_ciudad)} → ${escapeHtml(reserva.destino_ciudad)} · ${fmtFecha(reserva.fecha_salida)}</p>
        <div class="price-breakdown">
          <div class="row"><span>Precio por asiento</span><span>${fmtMoney(reserva.precio_por_asiento)}</span></div>
          <div class="row"><span>Asientos reservados</span><span>${reserva.asientos_reservados}</span></div>
          <div class="row total"><span>Total a pagar</span><span>${fmtMoney(reserva.monto_total)}</span></div>
        </div>
        <div class="info-box" style="margin-top:14px">
          De este monto, Viaje Compartido retiene un ${fmtMoney(reserva.comision_plataforma)} (10%) de comisión por intermediación y
          validación. El conductor recibe ${fmtMoney(reserva.monto_conductor)} una vez finalizado el viaje.
        </div>
        <button class="btn btn-primary btn-block" id="btn-pagar" style="margin-top:16px">💳 Pagar ${fmtMoney(reserva.monto_total)} (simulado)</button>
        <p class="muted" style="margin-top:10px;text-align:center">Este es un pago simulado del prototipo — en producción se integraría un medio de pago real.</p>
      </div>
    </div>`;
  app.querySelector("#btn-pagar").addEventListener("click", async () => {
    try {
      await Api.post(`/api/reservas/${reserva.id}/pagar`);
      toast("¡Pago confirmado! Buen viaje 🚗", "success");
      location.hash = "#/mis-viajes";
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ---------------------------------------------------------------------------
// CALIFICAR
// ---------------------------------------------------------------------------
async function viewCalificar(app, params) {
  const user = Session.get();
  app.innerHTML = `<div class="container-narrow"><p class="muted">Cargando…</p></div>`;
  let reserva;
  try {
    reserva = await Api.get(`/api/reservas/${params.id}`);
  } catch (err) {
    app.innerHTML = `<div class="container-narrow"><div class="error-box">${escapeHtml(err.message)}</div></div>`;
    return;
  }
  const destinatarioId = user.id === reserva.pasajero_id ? reserva.conductor_id : reserva.pasajero_id;
  const esCalificaAlConductor = user.id === reserva.pasajero_id;

  app.innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <h2>¿Cómo estuvo el viaje?</h2>
        <p class="muted">${escapeHtml(reserva.origen_ciudad)} → ${escapeHtml(reserva.destino_ciudad)} · ${fmtFecha(reserva.fecha_salida)}</p>
        <form id="form-calificar">
          <div class="field"><label>Puntuación general</label>${renderStarsInput("puntuacion", 5)}</div>
          <div class="field"><label>${esCalificaAlConductor ? "Habilidad de manejo" : "Puntualidad"}</label>${renderStarsInput("manejo", 5)}</div>
          <div class="field"><label>Comodidad del viaje</label>${renderStarsInput("comodidad", 5)}</div>
          <div class="field"><label>Comentario (opcional)</label><textarea name="comentario" placeholder="Contale a la comunidad cómo fue tu experiencia"></textarea></div>
          <button class="btn btn-primary btn-block" type="submit">Enviar calificación</button>
        </form>
      </div>
    </div>`;
  wireStarsInputs(app);
  app.querySelector("#form-calificar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await Api.post("/api/calificaciones", {
        reserva_id: reserva.id,
        autor_id: user.id,
        destinatario_id: destinatarioId,
        puntuacion: Number(fd.get("puntuacion")),
        manejo: Number(fd.get("manejo")),
        comodidad: Number(fd.get("comodidad")),
        comentario: fd.get("comentario"),
      });
      toast("¡Gracias por calificar! Ayudás a que la comunidad sea más confiable.", "success");
      location.hash = "#/mis-viajes";
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ---------------------------------------------------------------------------
// REGLAS DE LA RUTA (legal) + AYUDA (FAQ)
// ---------------------------------------------------------------------------
function viewReglas(app) {
  app.innerHTML = `
    <div class="container-narrow">
      <div class="section-title" style="text-align:left">
        <h1>Reglas de la Ruta</h1>
        <p>Cuidamos la comunidad. Este es el encuadre completo de cómo funciona Viaje Compartido: qué hacemos, qué no hacemos, y qué se
        espera de cada persona que sube al auto.</p>
      </div>
      ${renderAccordion(LEGAL_SECTIONS, "legal")}
      <div class="info-box" style="margin-top:20px">
        ¿Tenés dudas puntuales? <a href="https://wa.me/5490000000000" target="_blank" rel="noopener">Escribinos por WhatsApp</a> o mirá
        las <a href="#/ayuda">preguntas frecuentes</a>.
      </div>
    </div>`;
  wireAccordions(app);
}

function viewAyuda(app) {
  app.innerHTML = `
    <div class="container-narrow">
      <div class="section-title" style="text-align:left">
        <h1>Preguntas frecuentes</h1>
        <p>Todo lo que necesitás saber antes de tu primer viaje compartido.</p>
      </div>
      ${renderAccordion(FAQ_ITEMS, "faq")}
      <div class="info-box" style="margin-top:20px">
        ¿No encontraste tu respuesta? <a href="https://wa.me/5490000000000" target="_blank" rel="noopener">💬 Escribinos por WhatsApp</a>
      </div>
    </div>`;
  wireAccordions(app);
}

// ---------------------------------------------------------------------------
// ADMIN — validación manual de perfiles + configuración de precios de referencia
// ---------------------------------------------------------------------------
async function viewAdmin(app) {
  const user = Session.get();
  if (!user || user.rol !== "admin") {
    app.innerHTML = `<div class="container-narrow"><div class="card">
      <h2>Panel de administración</h2>
      <p>Esta sección es solo para el equipo de Viaje Compartido.</p>
      <a href="#/login" class="btn btn-teal">Ingresar como admin</a>
    </div></div>`;
    return;
  }

  app.innerHTML = `<div class="container"><p class="muted">Cargando panel…</p></div>`;
  const [pendientes, config] = await Promise.all([Api.get("/api/admin/pendientes"), Api.get("/api/admin/config")]);

  app.innerHTML = `
    <div class="container">
      <div class="section-title" style="text-align:left"><h1>Panel de administración</h1></div>

      <div class="card" style="margin-bottom:20px">
        <h3>Validaciones pendientes (${pendientes.length})</h3>
        ${
          pendientes.length === 0
            ? `<p class="muted">No hay perfiles esperando revisión. 🎉</p>`
            : `<table class="admin-table"><thead><tr><th>Nombre</th><th>Rol</th><th>DNI</th><th>Email</th><th>Documentos</th><th>Acción</th></tr></thead><tbody>
              ${pendientes
                .map(
                  (u) => `<tr>
                <td>${escapeHtml(u.nombre)} ${escapeHtml(u.apellido)}</td>
                <td>${u.rol}</td>
                <td>${escapeHtml(u.dni || "-")}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${[u.doc_dni_frente && "DNI", u.doc_selfie && "Selfie", u.doc_licencia && "Licencia", u.doc_seguro && "Seguro"].filter(Boolean).join(", ") || "-"}</td>
                <td>
                  <button class="btn btn-teal btn-sm" data-aprobar="${u.id}">Aprobar</button>
                  <button class="btn btn-outline danger btn-sm" data-rechazar-usuario="${u.id}">Rechazar</button>
                </td>
              </tr>`
                )
                .join("")}
            </tbody></table>`
        }
      </div>

      <div class="card">
        <h3>Valores de referencia (actualización quincenal/mensual)</h3>
        <p class="muted">Estos valores alimentan el algoritmo de cálculo de precio (Reglas de la Ruta, punto 5).</p>
        <form id="form-config" class="grid-2">
          <div class="field"><label>Precio nafta súper ($/litro)</label><input type="number" name="precio_nafta_super" value="${config.precio_nafta_super}"></div>
          <div class="field"><label>Peajes de referencia corredor Ruta 5/226 ($)</label><input type="number" name="peaje_default_ruta5_226" value="${config.peaje_default_ruta5_226}"></div>
          <div class="field"><label>Comisión de la plataforma (%)</label><input type="number" name="comision_plataforma_pct" value="${config.comision_plataforma_pct}"></div>
          <div class="field"><label>Consumo de referencia (litros/100km)</label><input type="number" name="consumo_litros_100km" value="${config.consumo_litros_100km}"></div>
          <div class="field"><label>Tolerancia de ajuste del conductor (%)</label><input type="number" name="tolerancia_ajuste_pct" value="${config.tolerancia_ajuste_pct}"></div>
          <div class="field" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Guardar valores</button></div>
        </form>
      </div>
    </div>`;

  app.querySelectorAll("[data-aprobar]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await Api.patch(`/api/admin/validar/${btn.dataset.aprobar}`, { estado: "aprobado" });
      toast("Perfil aprobado", "success");
      viewAdmin(app);
    })
  );
  app.querySelectorAll("[data-rechazar-usuario]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const motivo = prompt("Motivo del rechazo (se le mostrará al usuario):") || "";
      await Api.patch(`/api/admin/validar/${btn.dataset.rechazarUsuario}`, { estado: "rechazado", motivo });
      toast("Perfil rechazado", "info");
      viewAdmin(app);
    })
  );
  app.querySelector("#form-config").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await Api.patch("/api/admin/config", body);
      toast("Valores actualizados", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// ---------------------------------------------------------------------------
// PERFIL (ver/editar preferencias propias)
// ---------------------------------------------------------------------------
async function viewPerfil(app) {
  const user = Session.get();
  if (!user) {
    location.hash = "#/login";
    return;
  }
  const fresco = await Api.get(`/api/usuarios/${user.id}`);
  Session.set(fresco);
  app.innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <div style="display:flex;gap:14px;align-items:center">
          <div class="avatar lg">${iniciales(fresco.nombre, fresco.apellido)}</div>
          <div>
            <h2 style="margin-bottom:2px">${escapeHtml(fresco.nombre)} ${escapeHtml(fresco.apellido)}</h2>
            <span class="status-pill ${fresco.estado_validacion}">${fresco.estado_validacion}</span>
            ${fresco.rating_count ? ` <span class="stars">★ ${fresco.rating_promedio}</span> <span class="muted">(${fresco.rating_count})</span>` : ""}
          </div>
        </div>
        ${fresco.estado_validacion === "rechazado" && fresco.motivo_rechazo ? `<div class="error-box" style="margin-top:14px">Motivo: ${escapeHtml(fresco.motivo_rechazo)}</div>` : ""}
        <p style="margin-top:14px"><strong>Email:</strong> ${escapeHtml(fresco.email)}<br><strong>Celular:</strong> ${escapeHtml(fresco.telefono || "-")}</p>
        ${fresco.rol === "conductor" ? `<p><strong>Vehículo:</strong> ${escapeHtml(fresco.vehiculo_marca || "")} ${escapeHtml(fresco.vehiculo_modelo || "")} ${fresco.vehiculo_color ? "· " + escapeHtml(fresco.vehiculo_color) : ""}</p>` : ""}
        <a href="#/mis-viajes" class="btn btn-teal" style="margin-top:10px">Ir a ${fresco.rol === "conductor" ? "mis viajes publicados" : "mis reservas"}</a>
      </div>
    </div>`;
}