// views.js — Renderizado de cada pantalla de la app. Cada view recibe el <main id="app">
// y los parámetros de ruta, hace sus fetch a la API y pinta el HTML correspondiente.

const CIUDADES_CORREDOR = [
  "La Plata", "Chascomús", "Rauch", "Tandil", "Balcarce", "Necochea",
  "Luján", "Mercedes", "Chivilcoy", "Bragado", "9 de Julio",
  "Carlos Casares", "Pehuajó", "Trenque Lauquen", "Santa Rosa",
  "Saladillo", "Bolívar", "General Alvear",
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
    <section class="hero">
      <h1>Compartí el auto. <br>Compartí los gastos.</h1>
      <p class="sub">Conectamos conductores y pasajeros que viajan hacia el mismo destino.</p>
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
      ⚖️ Ruta Compartida es una plataforma de intermediación entre particulares. <strong>No prestamos el servicio de transporte</strong> —
      solo conectamos a quienes ya hacen el viaje. <a href="#/terminos" style="color:#fff;text-decoration:underline">Conocé los Términos y Condiciones →</a>
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
          <p>Pagás en la app solo la comisión de Ruta Compartida; el resto se lo transferís directo al conductor por transferencia o QR. Al llegar, ambos se califican.</p>
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
      Este precio lo calcula el sistema automáticamente según la ciudad de destino — el conductor no puede modificarlo.
      <a href="#/reglas-de-la-ruta">Ver el detalle completo →</a></p>`,
    },
    {
      titulo: "¿Qué pasa si cancelo mi reserva?",
      html: `<p>La regla es simple: cancelando con <strong>24 hs o más</strong> de anticipación a la salida no se te cobra nada (o se te
      reembolsa el 100% si ya habías pagado la comisión). Cancelando con <strong>menos de 24 hs</strong>, no corresponde reembolso de la
      comisión ya pagada. Si todavía no pagaste, cancelar nunca tiene costo. Si cancela el conductor, siempre te devolvemos el 100%.
      <a href="#/reglas-de-la-ruta">Ver el detalle completo →</a></p>`,
    },
    {
      titulo: "Validación de este conductor",
      html: `<p>Revisamos manualmente su DNI, licencia de conducir, cédula del vehículo, seguro y constancia de VTV vigente (con su fecha
      de vencimiento) antes de habilitarlo a publicar viajes. Esto es una verificación documental que busca reducir riesgos, no una
      garantía de que no vaya a ocurrir un problema ni una certificación sobre su conducta futura. Coordiná el encuentro en un lugar
      público y compartí tu viaje con alguien de confianza. <a href="#/terminos">Ver los Términos y Condiciones completos →</a></p>`,
    },
    {
      titulo: "Lo que NO cubre Ruta Compartida",
      html: `<p>No somos responsables por accidentes, siniestros, conductas entre usuarios, demoras, o el estado mecánico real del vehículo.
      Esa responsabilidad es del conductor y de quien corresponda según las circunstancias. <a href="#/terminos">Leer el encuadre legal completo →</a></p>`,
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
            <div class="muted" style="font-size:0.8rem;margin-top:4px">🔒 Vas a ver el auto, la foto y el teléfono del conductor una vez que acepte tu reserva.</div>
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
        <div id="comision-preview" class="info-box" style="margin-bottom:14px">Calculando la comisión…</div>
        <div class="info-box" style="margin-bottom:14px">
          📌 <strong>Política de cancelación:</strong> con 24 hs o más de anticipación a la salida, cancelás sin costo (o con reembolso
          total si ya pagaste). Con menos de 24 hs, no hay reembolso de la comisión ya pagada.
          <a href="#/reglas-de-la-ruta">Ver más</a>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Solicitar reserva</button>
        <p class="muted" style="margin-top:8px">El conductor tiene que aceptar tu solicitud antes de que se habilite el pago.</p>
      </form>`;

    const selectAsientos = app.querySelector('[name="asientos_reservados"]');
    async function actualizarComisionPreview() {
      const asientos = Number(selectAsientos.value) || 1;
      const cont = app.querySelector("#comision-preview");
      try {
        const desglose = await Api.post(`/api/viajes/${viaje.id}/desglose-reserva`, { asientos_reservados: asientos });
        cont.innerHTML = `
          <div class="price-breakdown" style="border-top:none;padding-top:0">
            <div class="row"><span>Costo compartido del viaje (${asientos} asiento(s))</span><span>${fmtMoney(desglose.montoTotal)}</span></div>
            <div class="row total"><span>Comisión de Ruta Compartida a pagar (${desglose.comisionPct}%, mín. ${fmtMoney(desglose.comisionMinima)})</span><span>${fmtMoney(desglose.comisionPlataforma)}</span></div>
          </div>
          <p class="muted" style="margin:6px 0 0">El resto (${fmtMoney(desglose.montoConductor)}) se lo transferís directamente al
          conductor al momento de viajar — la plataforma no lo cobra.</p>`;
      } catch (err) {
        cont.innerHTML = `<span style="color:var(--danger)">${escapeHtml(err.message)}</span>`;
      }
    }
    selectAsientos.addEventListener("change", actualizarComisionPreview);
    actualizarComisionPreview();

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
      <div class="info-box">Revisamos manualmente la documentación de cada perfil antes de habilitarlo, como parte de nuestro proceso de
      validación. Te avisamos por WhatsApp en menos de 24 hs cuando estés habilitado para publicar viajes.</div>
    </div></div>`;
    return;
  }

  app.innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <h2>Publicá tu viaje</h2>
        <p class="muted">La distancia, los peajes y el precio se calculan automáticamente según las ciudades — nadie los puede editar,
        ni siquiera vos, para que el precio nunca se aparte del costo real del trayecto.</p>
        <div id="publicar-error"></div>
        <form id="form-publicar">
          <div class="field">
            <label>Punto de partida exacto</label>
            <input type="text" name="origen_direccion" placeholder="Ej: Terminal de Ómnibus, La Plata" required>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Salgo de</label>
              ${selectCiudades("origen_ciudad", "La Plata", "", true)}
            </div>
            <div class="field">
              <label>Voy a</label>
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
          <div class="field">
            <label>Asientos a ofrecer</label>
            <select name="asientos_totales">
              <option value="1">1</option><option value="2">2</option><option value="3" selected>3 (recomendado)</option>
              <option value="4">4 (completa el auto)</option>
            </select>
          </div>

          <div id="precio-preview" class="info-box" style="margin-bottom:16px">Elegí origen y destino para ver el precio calculado.</div>

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
          <button class="btn btn-primary btn-block" type="submit" id="btn-publicar" disabled>Publicá tu viaje</button>
        </form>
      </div>
    </div>
  `;
  wireChips(app);

  const form = app.querySelector("#form-publicar");
  const btnPublicar = app.querySelector("#btn-publicar");

  function ciudadesElegidas() {
    const origen_ciudad = form.querySelector('[name="origen_ciudad"]').value;
    const destino_ciudad = form.querySelector('[name="destino_ciudad"]').value;
    if (!origen_ciudad || !destino_ciudad) return null;
    if (origen_ciudad === destino_ciudad) return null;
    return { origen_ciudad, destino_ciudad };
  }

  async function actualizarPreview() {
    const origen_ciudad = form.querySelector('[name="origen_ciudad"]').value;
    const destino_ciudad = form.querySelector('[name="destino_ciudad"]').value;
    const ciudades = ciudadesElegidas();
    btnPublicar.disabled = true;
    if (origen_ciudad && destino_ciudad && origen_ciudad === destino_ciudad) {
      app.querySelector("#precio-preview").innerHTML = `<span style="color:var(--danger)">El origen y el destino no pueden ser la misma ciudad.</span>`;
      return;
    }
    if (!ciudades) return;
    const fd = new FormData(form);
    try {
      const calc = await Api.post("/api/pricing/calcular", {
        ...ciudades,
        asientos_totales: Number(fd.get("asientos_totales")) || 3,
      });
      app.querySelector("#precio-preview").innerHTML = `
        <div class="price-breakdown" style="border-top:none;padding-top:0">
          <div class="row"><span>Distancia (${escapeHtml(calc.origenCiudad)} ↔ ${escapeHtml(calc.destinoCiudad)})</span><span>${calc.distanciaKm} km</span></div>
          <div class="row"><span>Peajes estimados</span><span>${fmtMoney(calc.peajesEstimados)}</span></div>
          <div class="row"><span>Costo combustible (nafta a ${fmtMoney(calc.precioNaftaUsado)}/L)</span><span>${fmtMoney(calc.costoCombustible)}</span></div>
          <div class="row"><span>Techo Operativo del viaje (C.T.O.)</span><span>${fmtMoney(calc.ctoTotal)}</span></div>
          <div class="row total"><span>Precio final por asiento</span><span>${fmtMoney(calc.precioSugerido)}</span></div>
        </div>
        <p class="muted" style="margin:6px 0 0">Este precio sale automático del cálculo — no se puede modificar.</p>`;
      btnPublicar.disabled = false;
    } catch (err) {
      app.querySelector("#precio-preview").innerHTML = `<span style="color:var(--danger)">${escapeHtml(err.message)}</span>`;
    }
  }
  ["origen_ciudad", "destino_ciudad", "asientos_totales"].forEach((n) => {
    form.querySelectorAll(`[name="${n}"]`).forEach((el) => el.addEventListener("change", actualizarPreview));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ciudades = ciudadesElegidas();
    if (!ciudades) return;
    const fd = new FormData(form);
    const payload = {
      conductor_id: user.id,
      origen_direccion: fd.get("origen_direccion"),
      ...ciudades,
      ciudades_intermedias: (fd.get("ciudades_intermedias") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      fecha_salida: fd.get("fecha_salida"),
      hora_salida: fd.get("hora_salida"),
      hora_llegada_estimada: fd.get("hora_llegada_estimada") || null,
      asientos_totales: Number(fd.get("asientos_totales")) || 3,
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
    return `<a href="https://wa.me/5492396629101" target="_blank" rel="noopener" class="muted" style="display:inline-flex;gap:6px;align-items:center;margin-top:10px">💬 ¿Dudas con el registro? Escribinos</a>`;
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
          <div class="field-row">
            <div class="field"><label>Contraseña</label><input type="password" id="f-password" autocomplete="new-password"></div>
            <div class="field"><label>Repetir contraseña</label><input type="password" id="f-password2" autocomplete="new-password"></div>
          </div>
          <small class="hint">Mínimo 8 caracteres. La vas a usar para ingresar a tu cuenta.</small>
        `;
      } else if (step === 2) {
        titulo = "Validación de documentos";
        subtitulo = "Paso 2: documentación";
        bodyHtml = `
          ${renderUploadField("doc_dni_frente", "DNI (frente)", "Botón de subir foto o sacar foto.")}
          ${renderUploadField("doc_dni_dorso", "DNI (dorso)")}
          ${renderUploadField("doc_selfie", "Selfie de validación", "Sacate una foto sosteniendo tu DNI al lado de tu cara. La revisa manualmente nuestro equipo, no usamos reconocimiento facial automático.")}
          ${renderUploadField("doc_licencia", "Licencia de conducir")}
          ${renderUploadField("doc_cedula", "Cédula verde / azul")}
          ${renderUploadField("doc_seguro", "Seguro vigente", "Subí una captura o foto de la tarjeta de seguro que te pide la caminera en cualquier control de ruta.")}
          ${renderUploadField("doc_vtv", "Constancia de VTV vigente", "Subí una foto de la oblea o el comprobante de la Verificación Técnica Vehicular (no alcanza con declararlo).")}
          <div class="field">
            <label>Fecha de vencimiento de la VTV</label>
            <input type="date" id="f-vtv-vencimiento" value="${escapeHtml(data.vtv_vencimiento || "")}">
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="f-reglas" ${data.acepta_reglas ? "checked" : ""}>
            <label for="f-reglas">Leí y acepto los <a href="#/terminos" target="_blank">Términos y Condiciones</a>, las
              <a href="#/reglas-de-la-ruta" target="_blank">Reglas de la Ruta</a> y la
              <a href="#/privacidad" target="_blank">Política de Privacidad</a> de Ruta Compartida.</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="f-seguro-carpooling" ${data.declara_seguro_carpooling ? "checked" : ""}>
            <label for="f-seguro-carpooling">Confirmo que verifiqué con mi compañía de seguros que mi póliza cubre el transporte de pasajeros a cambio de una contribución a los gastos (carpooling), o que voy a verificarlo antes de mi primer viaje.</label>
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
          ${renderUploadField("doc_dni_frente", "DNI (frente)", "Es parte de la verificación de identidad que hacemos con cada usuario.")}
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
          <div class="field-row">
            <div class="field"><label>Contraseña</label><input type="password" id="f-password" autocomplete="new-password"></div>
            <div class="field"><label>Repetir contraseña</label><input type="password" id="f-password2" autocomplete="new-password"></div>
          </div>
          <small class="hint">Mínimo 8 caracteres. La vas a usar para ingresar a tu cuenta.</small>
          <div class="field" style="margin-top:16px">
            <label>Alias de Mercado Pago (o CBU/CVU) — opcional</label>
            <input type="text" id="f-pasajero-alias" placeholder="Ej: sofia.pasajera.mp" value="${escapeHtml(data.alias_cobro || "")}">
            <small class="hint">Lo usamos únicamente si alguna vez hay que reembolsarte algo (por ejemplo, si el conductor reporta que
            no viajaste por un error, o si cancelás con derecho a reembolso). Podés completarlo después desde tu perfil.</small>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="f-reglas" ${data.acepta_reglas ? "checked" : ""}>
            <label for="f-reglas">Leí y acepto los <a href="#/terminos" target="_blank">Términos y Condiciones</a>, las
              <a href="#/reglas-de-la-ruta" target="_blank">Reglas de la Ruta</a> y la
              <a href="#/privacidad" target="_blank">Política de Privacidad</a> de Ruta Compartida.</label>
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
          ${step === totalSteps ? `<p class="muted" style="margin-top:10px">Revisamos manualmente la documentación de cada perfil antes de habilitarlo. Te avisamos por WhatsApp en menos de 24 hs.</p>${ayudaWsp()}` : ayudaWsp()}
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
          password: q("#f-password")?.value, password2: q("#f-password2")?.value,
        });
      } else if (step === 2) {
        Object.assign(data, {
          doc_dni_frente: getUpload("doc_dni_frente") || data.doc_dni_frente,
          doc_dni_dorso: getUpload("doc_dni_dorso") || data.doc_dni_dorso,
          doc_selfie: getUpload("doc_selfie") || data.doc_selfie,
          doc_licencia: getUpload("doc_licencia") || data.doc_licencia,
          doc_cedula: getUpload("doc_cedula") || data.doc_cedula,
          doc_seguro: getUpload("doc_seguro") || data.doc_seguro,
          doc_vtv: getUpload("doc_vtv") || data.doc_vtv,
          vtv_vencimiento: q("#f-vtv-vencimiento")?.value,
          acepta_reglas: q("#f-reglas")?.checked,
          declara_seguro_carpooling: q("#f-seguro-carpooling")?.checked,
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
          password: q("#f-password")?.value, password2: q("#f-password2")?.value,
          alias_cobro: q("#f-pasajero-alias")?.value,
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
      if (!data.password || data.password.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
      if (data.password !== data.password2) errores.push("Las contraseñas no coinciden.");
    }
    if (rol === "conductor" && step === 2) {
      if (!data.doc_dni_frente || !data.doc_dni_dorso) errores.push("Subí ambas fotos del DNI.");
      if (!data.doc_selfie) errores.push("Subí la selfie de validación.");
      if (!data.doc_licencia || !data.doc_cedula || !data.doc_seguro) errores.push("Faltan documentos del vehículo.");
      if (!data.doc_vtv) errores.push("Subí la foto de la oblea o constancia de tu VTV vigente.");
      if (!data.vtv_vencimiento) errores.push("Indicá la fecha de vencimiento de tu VTV.");
      else if (new Date(data.vtv_vencimiento) < new Date(new Date().toDateString())) {
        errores.push("La fecha de vencimiento de tu VTV ya pasó.");
      }
      if (!data.acepta_reglas) errores.push("Tenés que aceptar los Términos y Condiciones, las Reglas de la Ruta y la Política de Privacidad.");
      if (!data.declara_seguro_carpooling) errores.push("Tenés que confirmar la verificación de tu seguro para carpooling.");
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
      if (!data.password || data.password.length < 8) errores.push("La contraseña debe tener al menos 8 caracteres.");
      if (data.password !== data.password2) errores.push("Las contraseñas no coinciden.");
      if (!data.acepta_reglas) errores.push("Tenés que aceptar los Términos y Condiciones, las Reglas de la Ruta y la Política de Privacidad.");
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
// LOGIN
// ---------------------------------------------------------------------------
function viewLogin(app) {
  app.innerHTML = `
    <div class="container-narrow">
      <div class="card">
        <h2>Ingresar</h2>
        <p class="muted">Ingresá con tu email y tu contraseña.</p>
        <div id="login-error"></div>
        <form id="form-login">
          <div class="field"><label>Email</label><input type="email" name="email" required autocomplete="username"></div>
          <div class="field"><label>Contraseña</label><input type="password" name="password" required autocomplete="current-password"></div>
          <button class="btn btn-primary btn-block" type="submit">Ingresar</button>
        </form>
        <p class="muted" style="margin-top:14px">¿No tenés cuenta? <a href="#/registro/pasajero">Creá tu perfil de pasajero</a> o
        <a href="#/registro/conductor">de conductor</a>.</p>
        <p class="muted" style="margin-top:6px">¿Olvidaste tu contraseña? <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">Escribinos por WhatsApp</a> y te la restablecemos.</p>
      </div>
    </div>`;

  async function doLogin(email, password) {
    try {
      const usuario = await Api.post("/api/usuarios/login", { email, password });
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
    const fd = new FormData(e.target);
    doLogin(fd.get("email"), fd.get("password"));
  });
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
        // Orden de prioridad por hora de reserva: como la API ya devuelve las reservas ordenadas
        // por created_at ASC, la posición en la cola de las "pendiente" es simplemente su orden
        // de aparición entre ellas — se la mostramos al conductor para que sepa a quién le toca.
        let posicion = 0;
        solicitudesEl.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:10px">
          ${reservas.map((r) => renderSolicitudRow(r, r.estado === "pendiente" ? ++posicion : null)).join("")}
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
            ${r.pagado ? '<div class="muted" style="font-size:0.75rem">✅ Comisión pagada</div>' : ""}
            ${
              r.estado === "cancelada" && typeof r.reembolso_aplica === "boolean"
                ? `<div class="muted" style="font-size:0.75rem">${r.reembolso_aplica ? "💸 Con reembolso" : "🚫 Sin reembolso (< 24 hs)"}</div>`
                : ""
            }
          </div>
        </div>
        ${
          ["aceptada", "completada"].includes(r.estado)
            ? `<div class="info-box" style="margin-top:10px;display:flex;gap:10px;align-items:flex-start">
                <div class="avatar">${iniciales(r.conductor_nombre, r.conductor_apellido)}</div>
                <div>
                  <strong>${escapeHtml(r.conductor_nombre || "")} ${escapeHtml(r.conductor_apellido || "")}</strong>
                  ${r.conductor_rating_count ? `<div class="muted" style="font-size:0.8rem">★ ${r.conductor_rating_promedio} (${r.conductor_rating_count} viajes)</div>` : ""}
                  <div class="muted" style="font-size:0.8rem">📞 ${escapeHtml(r.conductor_telefono || "sin cargar")}</div>
                  <div class="muted" style="font-size:0.8rem">🚗 ${escapeHtml(r.conductor_vehiculo_marca || "")} ${escapeHtml(r.conductor_vehiculo_modelo || "")}${r.conductor_vehiculo_color ? " · " + escapeHtml(r.conductor_vehiculo_color) : ""}</div>
                  ${r.conductor_bio ? `<p class="muted" style="font-size:0.8rem;margin-top:4px">"${escapeHtml(r.conductor_bio)}"</p>` : ""}
                </div>
              </div>`
            : ""
        }
        ${
          r.pagado
            ? `<div class="info-box" style="margin-top:10px">Todavía le debés <strong>${fmtMoney(r.monto_conductor)}</strong> a ${escapeHtml(r.conductor_nombre || "el conductor")} ${escapeHtml(r.conductor_apellido || "")} — coordinen el medio de pago (efectivo, transferencia, etc.) directamente al momento de viajar.</div>`
            : ""
        }
        ${
          r.estado === "aceptada" && r.pagado
            ? `<div class="info-box" style="margin-top:10px">⏳ Después de la fecha del viaje, el conductor tiene que confirmar si viajaste — ahí se habilita la calificación.</div>`
            : ""
        }
        ${
          r.estado === "completada" && r.asistio === false
            ? `<div class="error-box" style="margin-top:10px">🚫 El conductor reportó que no viajaste. Según nuestra política, la comisión que ya pagaste ${r.reembolso_manual_realizado ? "ya fue reembolsada" : "queda pendiente de reembolso manual por parte del equipo de Ruta Compartida"}. Si esto es un error, <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">escribinos por WhatsApp</a>.</div>`
            : ""
        }
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${r.estado === "aceptada" && !r.pagado ? `<a href="#/reserva/${r.id}/pagar" class="btn btn-primary btn-sm">Pagar comisión ahora</a>` : ""}
          ${["pendiente", "aceptada"].includes(r.estado) ? `<button class="btn btn-outline danger btn-sm" data-cancelar-reserva="${r.id}" data-fecha-salida="${r.fecha_salida}" data-hora-salida="${r.hora_salida}" data-pagado="${r.pagado ? "1" : "0"}">Cancelar reserva</button>` : ""}
          ${r.estado === "completada" && r.asistio === true ? `<a href="#/calificar/${r.id}" class="btn btn-outline btn-sm">Calificar viaje</a>` : ""}
        </div>
      </div>`
      )
      .join("");
    app.querySelectorAll("[data-cancelar-reserva]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(mensajeConfirmacionCancelacion(btn.dataset.fechaSalida, btn.dataset.horaSalida, btn.dataset.pagado === "1"))) return;
        try {
          const resp = await Api.patch(`/api/reservas/${btn.dataset.cancelarReserva}`, { estado: "cancelada" });
          toast(resp.mensaje || "Reserva cancelada", "success");
          viewMisViajes(app);
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });
  }
}

function renderSolicitudRow(r, posicion) {
  // Orden de prioridad por reserva/hora: si hay una solicitud "pendiente" más vieja todavía sin
  // resolver para este mismo viaje, el servidor no deja aceptar esta — se lo marcamos acá para
  // que el conductor no se encuentre con el error recién al hacer clic.
  const bloqueadaPorOrden = r.estado === "pendiente" && posicion > 1;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;flex-wrap:wrap;gap:8px" data-reserva-row="${r.id}">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="avatar">${iniciales(r.nombre, r.apellido)}</div>
        <div>
          <strong>${escapeHtml(r.nombre)} ${escapeHtml(r.apellido)}</strong>
          ${r.estado === "pendiente" ? `<span class="badge" style="margin-left:6px">#${posicion} en la cola</span>` : ""}
          ${Number(r.no_show_count) > 0 ? `<span class="badge orange" style="margin-left:4px">⚠️ ${r.no_show_count} inasistencia(s) previa(s)</span>` : ""}
          <div class="muted">${r.asientos_reservados} asiento(s) · costo del viaje ${fmtMoney(r.monto_total)} ${r.rating_count ? `· ★ ${r.rating_promedio}` : ""}</div>
          ${
            r.pagado
              ? `<div class="muted" style="font-size:0.8rem">✅ Ya pagó la comisión de la plataforma. Te tiene que transferir <strong>${fmtMoney(r.monto_conductor)}</strong> directamente a tu alias al momento del viaje.</div>`
              : r.estado === "aceptada"
                ? `<div class="muted" style="font-size:0.8rem">Todavía no pagó la comisión de la plataforma.</div>`
                : ""
          }
          ${
            r.estado === "completada" && r.asistio === false
              ? `<div class="muted" style="font-size:0.8rem">🚫 Reportaste que no viajó. La comisión que pagó ${r.reembolso_manual_realizado ? "ya fue reembolsada por el admin." : "está pendiente de reembolso manual por el admin."}</div>`
              : ""
          }
          ${
            bloqueadaPorOrden
              ? `<div class="muted" style="font-size:0.8rem">Resolvé primero la solicitud #1 (orden de prioridad por hora de reserva).</div>`
              : ""
          }
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="status-pill ${r.estado}">${r.estado}</span>
        ${
          r.estado === "pendiente"
            ? `<button class="btn btn-teal btn-sm" data-aceptar="${r.id}" ${bloqueadaPorOrden ? "disabled" : ""}>Aceptar</button><button class="btn btn-outline danger btn-sm" data-rechazar="${r.id}">Rechazar</button>`
            : ""
        }
        ${
          r.estado === "aceptada" && r.pagado
            ? `<button class="btn btn-teal btn-sm" data-asistio-si="${r.id}">✅ Viajó</button><button class="btn btn-outline danger btn-sm" data-asistio-no="${r.id}">❌ No se presentó</button>`
            : ""
        }
        ${r.estado === "completada" && r.asistio === true ? `<a href="#/calificar/${r.id}" class="btn btn-outline btn-sm">Calificar</a>` : ""}
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
  app.querySelectorAll("[data-asistio-si]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Confirmás que el pasajero viajó? Esto habilita las calificaciones y suma a las estadísticas.")) return;
      try {
        const user = Session.get();
        const resp = await Api.patch(`/api/reservas/${btn.dataset.asistioSi}/asistencia`, { asistio: true, conductor_id: user.id });
        toast(resp.mensaje, "success");
        viewMisViajes(document.getElementById("app"));
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );
  app.querySelectorAll("[data-asistio-no]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Confirmás que el pasajero NO se presentó? La comisión que ya pagó no se le devuelve automáticamente — le avisamos al admin para que la reembolse a mano.")) return;
      try {
        const user = Session.get();
        const resp = await Api.patch(`/api/reservas/${btn.dataset.asistioNo}/asistencia`, { asistio: false, conductor_id: user.id });
        toast(resp.mensaje, "info");
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
          <div class="row"><span>Costo compartido del viaje</span><span>${fmtMoney(reserva.monto_total)}</span></div>
          <div class="row total"><span>Pagás ahora (comisión Ruta Compartida)</span><span>${fmtMoney(reserva.comision_plataforma)}</span></div>
        </div>
        <div class="info-box" style="margin-top:14px">
          Ruta Compartida solo cobra su comisión de intermediación y validación (${fmtMoney(reserva.comision_plataforma)}).
          El resto — <strong>${fmtMoney(reserva.monto_conductor)}</strong> — se lo transferís o pagás vos directamente al conductor
          ${reserva.conductor_nombre ? `(${escapeHtml(reserva.conductor_nombre)} ${escapeHtml(reserva.conductor_apellido || "")})` : ""},
          coordinando el medio de pago entre ustedes al momento de viajar.
        </div>
        <button class="btn btn-primary btn-block" id="btn-pagar" style="margin-top:16px">💳 Pagar comisión de ${fmtMoney(reserva.comision_plataforma)} (simulado)</button>
        <p class="muted" style="margin-top:10px;text-align:center">Este es un pago simulado del prototipo — en producción se integraría un medio de pago real para cobrar solo la comisión. Recordá transferirle al conductor su parte por separado.</p>
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
        <p>Cómo funciona un viaje en la práctica: quién puede sumarse, cómo se publica y se reserva, cómo se calcula el precio y qué
        pasa si hay que cancelar. Para el encuadre legal completo (qué es la plataforma, responsabilidades, etc.), mirá los
        <a href="#/terminos">Términos y Condiciones</a>. Para saber qué hacemos con tus datos, mirá la
        <a href="#/privacidad">Política de Privacidad</a>.</p>
      </div>
      ${renderAccordion(REGLAS_SECTIONS, "reglas")}
      <div class="info-box" style="margin-top:20px">
        ¿Tenés dudas puntuales? <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">Escribinos por WhatsApp</a> o mirá
        las <a href="#/ayuda">preguntas frecuentes</a>.
      </div>
    </div>`;
  wireAccordions(app);
}

function viewTerminos(app) {
  app.innerHTML = `
    <div class="container-narrow">
      <div class="section-title" style="text-align:left">
        <h1>Términos y Condiciones</h1>
        <p>Qué es Ruta Compartida, qué hace y qué no hace la plataforma, y cómo se reparten las responsabilidades entre conductor,
        pasajero y la plataforma. Para los detalles prácticos del día a día (precios, cancelaciones), mirá las
        <a href="#/reglas-de-la-ruta">Reglas de la Ruta</a>.</p>
      </div>
      ${renderAccordion(TERMINOS_SECTIONS, "terminos")}
      <div class="info-box" style="margin-top:20px">
        Este documento es una descripción del funcionamiento de la plataforma y no reemplaza el asesoramiento de un profesional legal
        ante una situación puntual. ¿Dudas? <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">Escribinos por
        WhatsApp</a>.
      </div>
    </div>`;
  wireAccordions(app);
}

function viewPrivacidad(app) {
  app.innerHTML = `
    <div class="container-narrow">
      <div class="section-title" style="text-align:left">
        <h1>Política de Privacidad</h1>
        <p>Qué datos recopilamos (DNI, selfie de validación, documentación del vehículo, teléfono y demás), para qué los usamos, con
        quién se comparten y cómo ejercer tus derechos sobre ellos.</p>
      </div>
      ${renderAccordion(PRIVACIDAD_SECTIONS, "privacidad")}
      <div class="info-box" style="margin-top:20px">
        ¿Querés acceder, corregir o eliminar tus datos? <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">Escribinos
        por WhatsApp</a>.
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
        ¿No encontraste tu respuesta? <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">💬 Escribinos por WhatsApp</a>
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
      <p>Esta sección es solo para el equipo de Ruta Compartida.</p>
      <a href="#/login" class="btn btn-teal">Ingresar como admin</a>
    </div></div>`;
    return;
  }

  app.innerHTML = `<div class="container"><p class="muted">Cargando panel…</p></div>`;
  let pendientes, config, stats, reembolsos, cuentasPendientes, usuarios;
  try {
    [pendientes, config, stats, reembolsos, cuentasPendientes, usuarios] = await Promise.all([
      Api.get("/api/admin/pendientes"),
      Api.get("/api/admin/config"),
      Api.get("/api/admin/estadisticas"),
      Api.get("/api/admin/reembolsos-pendientes"),
      Api.get("/api/admin/cuenta-corriente-pendientes"),
      Api.get("/api/admin/usuarios"),
    ]);
  } catch (e) {
    if (e.status === 403) {
      Session.clear();
      app.innerHTML = `<div class="container-narrow"><div class="card">
        <h2>Panel de administración</h2>
        <p>Tu sesión de administrador venció o no es válida. Iniciá sesión de nuevo.</p>
        <a href="#/login" class="btn btn-teal">Ingresar como admin</a>
      </div></div>`;
      return;
    }
    app.innerHTML = `<div class="container-narrow"><div class="card">
      <h2>Panel de administración</h2>
      <p>No se pudo cargar el panel: ${escapeHtml(e.message || "error desconocido")}</p>
    </div></div>`;
    return;
  }
  const distancias = config.distancias_corredor || {};

  app.innerHTML = `
    <div class="container">
      <div class="section-title" style="text-align:left"><h1>Panel de administración</h1></div>

      <div class="card" style="margin-bottom:20px">
        <h3>Estadísticas</h3>
        <div class="grid-2" style="gap:14px">
          <div class="info-box"><strong>${stats.viajesCompletados}</strong><br><span class="muted">viajes completados (pasajero confirmado)</span></div>
          <div class="info-box"><strong>${stats.pasajerosTrasladados}</strong><br><span class="muted">asientos trasladados</span></div>
          <div class="info-box"><strong>${fmtMoney(stats.comisionFacturada)}</strong><br><span class="muted">comisión facturada (acumulada, se cobra siempre)</span></div>
          <div class="info-box"><strong>${stats.conductoresAprobados} / ${stats.pasajerosAprobados}</strong><br><span class="muted">conductores / pasajeros aprobados</span></div>
          <div class="info-box"><strong>${stats.noShows}</strong><br><span class="muted">inasistencias reportadas (total)</span></div>
          <div class="info-box"><strong>${stats.reembolsosPendientesCount} · ${fmtMoney(stats.reembolsosPendientesMonto)}</strong><br><span class="muted">reembolsos manuales pendientes</span></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <h3>Reembolsos manuales pendientes (${reembolsos.filter((r) => !r.reembolso_manual_realizado).length})</h3>
        <p class="muted">Reservas donde el conductor reportó que el pasajero no viajó. La comisión se cobró igual — transferíle esto a
        mano al pasajero y marcalo como reembolsado.</p>
        ${
          reembolsos.filter((r) => !r.reembolso_manual_realizado).length === 0
            ? `<p class="muted">No hay reembolsos pendientes. 🎉</p>`
            : `<table class="admin-table"><thead><tr><th>Pasajero</th><th>Viaje</th><th>Monto</th><th>Alias</th><th>Reportado</th><th>Acción</th></tr></thead><tbody>
              ${reembolsos
                .filter((r) => !r.reembolso_manual_realizado)
                .map(
                  (r) => `<tr>
                <td>${escapeHtml(r.pasajero_nombre)} ${escapeHtml(r.pasajero_apellido)}<br><span class="muted" style="font-size:0.78rem">${escapeHtml(r.pasajero_email || "")}</span></td>
                <td>${escapeHtml(r.origen_ciudad)} → ${escapeHtml(r.destino_ciudad)}<br><span class="muted" style="font-size:0.78rem">${fmtFecha(r.fecha_salida)}</span></td>
                <td>${fmtMoney(r.comision_plataforma)}</td>
                <td>${r.pasajero_alias ? escapeHtml(r.pasajero_alias) : '<span class="muted">sin alias</span>'}</td>
                <td class="muted" style="font-size:0.78rem">${r.asistio_reportado_at ? fmtFecha(r.asistio_reportado_at.slice(0, 10)) : "-"}</td>
                <td><button class="btn btn-teal btn-sm" data-marcar-reembolsado="${r.id}">Ya reembolsé</button></td>
              </tr>`
                )
                .join("")}
            </tbody></table>`
        }
      </div>

      <div class="card" style="margin-bottom:20px">
        <h3>Cuenta corriente — pagos de conductores por confirmar (${cuentasPendientes.length})</h3>
        <p class="muted">Pagos que un conductor informó para saldar la deuda de su cuenta corriente (por cancelar viajes con reservas
        ya pagadas). Ojo: por ahora el "comprobante" es solo el nombre del archivo que subió, no la foto en sí — pedile que te la
        mande por WhatsApp si necesitás verla antes de confirmar.</p>
        ${
          cuentasPendientes.length === 0
            ? `<p class="muted">No hay pagos pendientes de confirmar. 🎉</p>`
            : `<table class="admin-table"><thead><tr><th>Conductor</th><th>Monto informado</th><th>Comprobante</th><th>Deuda actual</th><th>Informado</th><th>Acción</th></tr></thead><tbody>
              ${cuentasPendientes
                .map(
                  (m) => `<tr>
                <td>${escapeHtml(m.nombre)} ${escapeHtml(m.apellido)}</td>
                <td>${fmtMoney(m.monto)}</td>
                <td class="muted" style="font-size:0.78rem">${escapeHtml(m.comprobante || "-")}</td>
                <td>${fmtMoney(m.saldo_deudor)}</td>
                <td class="muted" style="font-size:0.78rem">${m.created_at ? fmtFecha(m.created_at.slice(0, 10)) : "-"}</td>
                <td><button class="btn btn-teal btn-sm" data-confirmar-pago-cuenta="${m.id}">Confirmar recibido</button></td>
              </tr>`
                )
                .join("")}
            </tbody></table>`
        }
      </div>

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
                <td>
                  ${[u.doc_dni_frente && "DNI", u.doc_selfie && "Selfie", u.doc_licencia && "Licencia", u.doc_seguro && "Seguro"].filter(Boolean).join(", ") || "-"}
                  ${
                    u.rol === "conductor"
                      ? u.doc_vtv
                        ? `<br><span style="${u.vtv_vencimiento && new Date(u.vtv_vencimiento) < new Date(new Date().toDateString()) ? "color:#b00020;font-weight:600" : ""}">VTV: ${u.vtv_vencimiento ? "vence " + fmtFecha(u.vtv_vencimiento) : "sin fecha"}</span>`
                        : `<br><span style="color:#b00020;font-weight:600">Sin constancia de VTV</span>`
                      : ""
                  }
                </td>
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

      <div class="card" style="margin-bottom:20px">
        <h3>Todos los usuarios (${usuarios.length})</h3>
        <p class="muted">Todavía no hay un "olvidé mi contraseña" self-service (el email a los usuarios necesitaría verificar un
        dominio propio en Resend) — mientras tanto, si alguien queda afuera de su cuenta, buscalo acá y restablecele la contraseña.
        Le pasás la temporal por WhatsApp; se la muestra una sola vez, no queda guardada en ningún lado.</p>
        <div class="field" style="margin-bottom:10px">
          <input type="text" id="buscar-usuario" placeholder="Buscar por nombre o email...">
        </div>
        <table class="admin-table">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Email</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody id="tabla-usuarios">
            ${usuarios
              .map(
                (u) => `<tr data-usuario-fila="${u.id}" data-usuario-busqueda="${escapeHtml((u.nombre + " " + u.apellido + " " + u.email).toLowerCase())}">
              <td>${escapeHtml(u.nombre)} ${escapeHtml(u.apellido)}</td>
              <td>${u.rol}</td>
              <td>${escapeHtml(u.email)}</td>
              <td><span class="status-pill ${u.estado_validacion}">${u.rol === "admin" ? "-" : u.estado_validacion}</span></td>
              <td><button class="btn btn-outline btn-sm" data-resetear-password="${u.id}">Restablecer contraseña</button></td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>Valores de referencia (actualización quincenal/mensual)</h3>
        <p class="muted">Estos valores alimentan el algoritmo de cálculo de precio (Reglas de la Ruta, punto 3).</p>
        <form id="form-config" class="grid-2">
          <div class="field"><label>Precio nafta súper ($/litro)</label><input type="number" name="precio_nafta_super" value="${config.precio_nafta_super}"></div>
          <div class="field"><label>Comisión de la plataforma (%)</label><input type="number" name="comision_plataforma_pct" value="${config.comision_plataforma_pct}"></div>
          <div class="field"><label>Comisión mínima ($)</label><input type="number" name="comision_minima" value="${config.comision_minima}"></div>
          <div class="field"><label>Consumo de referencia (litros/100km)</label><input type="number" name="consumo_litros_100km" value="${config.consumo_litros_100km}"></div>
          <div class="field"><label>Piso mínimo por asiento ($/km)</label><input type="number" name="precio_minimo_por_km" value="${config.precio_minimo_por_km}"></div>
          <div class="field"><label>Piso mínimo base ($, trayectos cortos)</label><input type="number" name="precio_minimo_base" value="${config.precio_minimo_base}"></div>
          <div class="field"><label>Penalización cancelación (menos de 24 hs, $)</label><input type="number" name="penalizacion_cancelacion_menos24hs" value="${config.penalizacion_cancelacion_menos24hs}"></div>
          <div class="field"><label>Penalización cancelación (24 hs o más, $)</label><input type="number" name="penalizacion_cancelacion_mas24hs" value="${config.penalizacion_cancelacion_mas24hs}"></div>
          <div class="field"><label>Tope de deuda para bloquear publicar ($)</label><input type="number" name="tope_saldo_deudor" value="${config.tope_saldo_deudor}"></div>
          <div class="field" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">Guardar valores</button></div>
        </form>
      </div>

      <div class="card" style="margin-top:20px">
        <h3>Distancias del corredor (desde La Plata)</h3>
        <p class="muted">Km y peajes estimados por ruta — de acá sale automáticamente el precio de cada viaje publicado, nadie los puede
        tocar manualmente. Son valores de referencia, no de un mapa real: revisalos y corregilos con lo que sepas de cada ruta.</p>
        <form id="form-distancias">
          <table class="admin-table">
            <thead><tr><th>Ciudad</th><th>Km desde La Plata</th><th>Peaje estimado ($)</th></tr></thead>
            <tbody>
              ${Object.keys(distancias)
                .map(
                  (ciudad) => `<tr>
                <td>${escapeHtml(ciudad)}</td>
                <td><input type="number" min="1" data-distancia-km="${escapeHtml(ciudad)}" value="${distancias[ciudad].km}"></td>
                <td><input type="number" min="0" data-distancia-peaje="${escapeHtml(ciudad)}" value="${distancias[ciudad].peaje}"></td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table>
          <button class="btn btn-primary" type="submit" style="margin-top:10px">Guardar distancias</button>
        </form>
      </div>
    </div>`;

  app.querySelectorAll("[data-marcar-reembolsado]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Confirmás que ya le transferiste el reembolso a mano a este pasajero?")) return;
      try {
        await Api.patch(`/api/admin/reembolsos/${btn.dataset.marcarReembolsado}/marcar-reembolsado`);
        toast("Marcado como reembolsado", "success");
        viewAdmin(app);
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );
  app.querySelectorAll("[data-confirmar-pago-cuenta]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Confirmás que recibiste esta transferencia? Se va a descontar de la deuda del conductor.")) return;
      try {
        await Api.patch(`/api/admin/cuenta-corriente/${btn.dataset.confirmarPagoCuenta}/confirmar`);
        toast("Pago confirmado y descontado", "success");
        viewAdmin(app);
      } catch (err) {
        toast(err.message, "error");
      }
    })
  );
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
  app.querySelector("#buscar-usuario").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    app.querySelectorAll("[data-usuario-fila]").forEach((fila) => {
      fila.style.display = fila.dataset.usuarioBusqueda.includes(q) ? "" : "none";
    });
  });
  app.querySelectorAll("[data-resetear-password]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("¿Restablecer la contraseña de este usuario? La actual deja de servir al instante.")) return;
      try {
        const resultado = await Api.post(`/api/admin/usuarios/${btn.dataset.resetearPassword}/resetear-password`, {});
        alert(`${resultado.mensaje}\n\nContraseña temporal: ${resultado.passwordTemporal}`);
      } catch (err) {
        toast(err.message, "error");
      }
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
  app.querySelector("#form-distancias").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevasDistancias = {};
    app.querySelectorAll("[data-distancia-km]").forEach((input) => {
      const ciudad = input.dataset.distanciaKm;
      nuevasDistancias[ciudad] = nuevasDistancias[ciudad] || {};
      nuevasDistancias[ciudad].km = Number(input.value);
    });
    app.querySelectorAll("[data-distancia-peaje]").forEach((input) => {
      const ciudad = input.dataset.distanciaPeaje;
      nuevasDistancias[ciudad] = nuevasDistancias[ciudad] || {};
      nuevasDistancias[ciudad].peaje = Number(input.value);
    });
    try {
      await Api.patch("/api/admin/config", { distancias_corredor: nuevasDistancias });
      toast("Distancias actualizadas", "success");
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
  // El token de admin es solo de sesión (no vive en la base) — el endpoint de usuarios no lo
  // devuelve, así que hay que preservarlo a mano o se perdería cada vez que se refresca el perfil.
  if (user.adminToken) fresco.adminToken = user.adminToken;
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
        ${
          fresco.rol === "pasajero"
            ? `<div class="field" style="margin-top:10px">
                <label>Alias de Mercado Pago (o CBU/CVU) para reembolsos</label>
                <div class="field-row">
                  <input type="text" id="f-perfil-alias" placeholder="Ej: sofia.pasajera.mp" value="${escapeHtml(fresco.alias_cobro || "")}">
                  <button class="btn btn-outline" id="btn-guardar-alias">Guardar</button>
                </div>
                <small class="hint">Lo usamos solo si alguna vez hay que reembolsarte algo (inasistencia mal reportada, cancelación con
                derecho a reembolso, etc.).</small>
              </div>`
            : ""
        }
        ${
          fresco.rol === "pasajero" && Number(fresco.no_show_count) > 0
            ? `<div class="info-box" style="margin-top:10px">⚠️ Tenés ${fresco.no_show_count} inasistencia(s) reportada(s) por conductores. Si creés que alguna está mal reportada, <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">escribinos por WhatsApp</a>.</div>`
            : ""
        }
        ${fresco.rol === "conductor" ? `<div id="cuenta-corriente-wrap"></div>` : ""}
        <div class="field" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
          <label>Cambiar contraseña</label>
          <div class="field-row">
            <input type="password" id="f-perfil-password" placeholder="Nueva contraseña" autocomplete="new-password">
            <input type="password" id="f-perfil-password2" placeholder="Repetir nueva contraseña" autocomplete="new-password">
          </div>
          <button class="btn btn-outline" id="btn-guardar-password" style="margin-top:8px">Actualizar contraseña</button>
          <small class="hint">Mínimo 8 caracteres.</small>
        </div>
        <a href="#/mis-viajes" class="btn btn-teal" style="margin-top:10px">Ir a ${fresco.rol === "conductor" ? "mis viajes publicados" : "mis reservas"}</a>
      </div>
    </div>`;
  if (fresco.rol === "conductor") renderCuentaCorriente(app, fresco);
  const btnAlias = app.querySelector("#btn-guardar-alias");
  if (btnAlias) {
    btnAlias.addEventListener("click", async () => {
      try {
        const alias = app.querySelector("#f-perfil-alias").value;
        const actualizado = await Api.patch(`/api/usuarios/${fresco.id}`, { alias_cobro: alias });
        if (fresco.adminToken) actualizado.adminToken = fresco.adminToken;
        Session.set(actualizado);
        toast("Alias actualizado", "success");
      } catch (err) {
        toast(err.message, "error");
      }
    });
  }
  app.querySelector("#btn-guardar-password").addEventListener("click", async () => {
    const p1 = app.querySelector("#f-perfil-password").value;
    const p2 = app.querySelector("#f-perfil-password2").value;
    if (!p1 || p1.length < 8) return toast("La contraseña debe tener al menos 8 caracteres.", "error");
    if (p1 !== p2) return toast("Las contraseñas no coinciden.", "error");
    try {
      await Api.patch(`/api/usuarios/${fresco.id}`, { password: p1 });
      app.querySelector("#f-perfil-password").value = "";
      app.querySelector("#f-perfil-password2").value = "";
      toast("Contraseña actualizada", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

// Cuenta corriente del conductor (deuda por cancelaciones con reservas ya pagadas — ver
// server/routes/viajes.js). Se carga aparte del resto del perfil porque es una llamada extra a
// la API; así el perfil no se demora esperándola.
async function renderCuentaCorriente(app, fresco) {
  const wrap = app.querySelector("#cuenta-corriente-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<p class="muted" style="margin-top:16px">Cargando cuenta corriente…</p>`;
  let cuenta;
  try {
    cuenta = await Api.get(`/api/usuarios/${fresco.id}/cuenta-corriente`);
  } catch (err) {
    wrap.innerHTML = `<div class="error-box" style="margin-top:16px">No se pudo cargar tu cuenta corriente: ${escapeHtml(err.message)}</div>`;
    return;
  }
  const tieneDeuda = cuenta.saldoDeudor > 0;
  const pendientes = cuenta.movimientos.filter((m) => m.tipo === "credito_pago" && m.estado === "pendiente_revision");
  wrap.innerHTML = `
    <div class="field" style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
      <label>Cuenta corriente</label>
      ${
        tieneDeuda
          ? `<div class="error-box">Tenés una deuda de ${fmtMoney(cuenta.saldoDeudor)}. Se genera cuando cancelás un viaje que ya
             tenía reservas pagadas (compensa la comisión de Mercado Pago que la plataforma pierde al reembolsarle esa comisión al
             pasajero). Por encima de cierto monto no vas a poder publicar viajes nuevos hasta regularizarla.</div>`
          : `<p class="muted">No tenés deuda pendiente en tu cuenta corriente.</p>`
      }
      ${
        pendientes.length
          ? `<p class="muted" style="margin-top:8px">Tenés ${pendientes.length} pago(s) informado(s) esperando que el equipo lo confirme.</p>`
          : ""
      }
      ${
        tieneDeuda
          ? `<form id="form-pago-cuenta" style="margin-top:10px">
              <div class="field">
                <label>Monto que transferiste</label>
                <input type="number" min="1" id="f-pago-monto" placeholder="Ej: 3000" required>
              </div>
              ${renderUploadField("comprobante", "Comprobante de la transferencia")}
              <button class="btn btn-outline" type="submit" style="margin-top:8px">Informar pago</button>
              <small class="hint">Transferí el monto al alias/CBU de Ruta Compartida (te lo pasamos por WhatsApp) e informá acá el
              pago — lo confirmamos y lo descontamos de tu deuda.</small>
            </form>`
          : ""
      }
    </div>`;
  wireUploads(wrap);
  const form = wrap.querySelector("#form-pago-cuenta");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const monto = wrap.querySelector("#f-pago-monto").value;
      const comprobante = wrap.querySelector('[data-upload-hidden="comprobante"]').value;
      if (!comprobante) return toast("Subí el comprobante de la transferencia.", "error");
      try {
        await Api.post(`/api/usuarios/${fresco.id}/cuenta-corriente/pagos`, { monto, comprobante });
        toast("Pago informado. Te avisamos cuando lo confirmemos.", "success");
        renderCuentaCorriente(app, fresco);
      } catch (err) {
        toast(err.message, "error");
      }
    });
  }
}
