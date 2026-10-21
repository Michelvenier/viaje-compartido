// api/routes/busquedas.js — "Busco viaje" (15 sep 2026, a pedido explícito del usuario): flujo
// INVERSO al de "reservas" — acá el PASAJERO publica que busca viaje (solo ciudades + fecha exacta
// o rango, sin elegir punto de encuentro) y son los CONDUCTORES los que ofrecen un viaje puntual
// suyo (uno ya publicado, o uno nuevo que publican para esto). El pasajero ve todas las ofertas
// recibidas y elige una — ver DB.js para el esquema completo y la decisión de concurrencia (varios
// conductores pueden ofrecer a la vez, elegida por el usuario vía AskUserQuestion).
//
// Reutiliza a propósito el motor de precios/reservas que ya existe: cuando el pasajero ACEPTA una
// oferta, se crea una fila normal en "reservas" (estado 'aceptada' directo, ya que la aceptación
// del pasajero es la confirmación mutua — el conductor ya había ofrecido ESE viaje puntual) — así
// todo lo que viene después (pagar la comisión, que se destapen los datos del conductor, reportar
// asistencia, calificar) sigue exactamente el mismo camino ya construido en reservas.js, sin
// duplicar nada de esa lógica acá.
"use strict";

const db = require("../db");
const pricing = require("../pricing");
const corredor = require("../corredor");
const { filaReserva } = require("./reservas");
const { newId, nowIso, ok, created, badRequest, notFound, forbidden, readBody } = require("../helpers");

// ---------------------------------------------------------------------------
// Lado PASAJERO: publicar una búsqueda, ver las propias (con sus ofertas), cancelar.
// ---------------------------------------------------------------------------

async function crear(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!body.pasajero_id) return badRequest(res, "Falta pasajero_id.");
  if (!body.origen_ciudad || !body.destino_ciudad) {
    return badRequest(res, "Elegí origen y destino.");
  }
  if (body.origen_ciudad === body.destino_ciudad) {
    return badRequest(res, "El origen y el destino no pueden ser la misma ciudad.");
  }
  if (!body.fecha_desde) return badRequest(res, "Falta la fecha (exacta, o el inicio del rango).");
  const fechaHasta = body.fecha_hasta || body.fecha_desde;
  if (fechaHasta < body.fecha_desde) {
    return badRequest(res, "La fecha final del rango no puede ser anterior a la fecha inicial.");
  }
  // Solo fechas futuras (mismo criterio simple que otras validaciones de fecha del proyecto, sin
  // horas de por medio — alcanza con no dejar publicar una búsqueda ya vencida de entrada).
  const hoy = new Date().toISOString().slice(0, 10);
  if (fechaHasta < hoy) {
    return badRequest(res, "Esa fecha ya pasó — elegí una fecha de hoy en adelante.");
  }

  const pasajero = await db.get("SELECT * FROM usuarios WHERE id = ?", [body.pasajero_id]);
  // Mismo criterio que reservas.crear() (rol dual, 07 sep 2026): cualquier cuenta validada no-admin
  // puede buscar viaje como pasajero, sea que se haya registrado como conductor o no.
  if (!pasajero || pasajero.rol === "admin") return badRequest(res, "El usuario no puede publicar una búsqueda.");
  if (pasajero.estado_validacion !== "aprobado") {
    return forbidden(
      res,
      "Tu perfil todavía está en revisión. Te avisamos por WhatsApp en menos de 24 hs cuando estés habilitado."
    );
  }

  const asientos = Math.max(1, Number(body.asientos_necesarios) || 1);
  const id = newId("bus");
  await db.run(
    `INSERT INTO busquedas_pasajero (id, pasajero_id, origen_ciudad, destino_ciudad, fecha_desde, fecha_hasta, asientos_necesarios, estado, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, pasajero.id, body.origen_ciudad, body.destino_ciudad, body.fecha_desde, fechaHasta, asientos, "abierta", nowIso()]
  );

  const row = await db.get("SELECT * FROM busquedas_pasajero WHERE id = ?", [id]);
  created(res, { busqueda: row, mensaje: "¡Listo! Tu búsqueda ya está publicada — te va a aparecer acá apenas algún conductor te ofrezca un viaje." });
}

// Trae, para cada búsqueda del pasajero (cualquier estado), las ofertas que recibió — con los datos
// del conductor y del viaje que ofreció, para que el pasajero pueda comparar y elegir. A propósito
// NO trae el teléfono del conductor acá (ver CAMPOS_CONDUCTOR_COMPLETOS en reservas.js): eso sigue
// destapándose recién cuando el pasajero acepta Y paga la comisión, igual que en el resto de la app
// — antes de eso alcanza con nombre, rating y los datos del viaje para decidir.
async function misBusquedas(req, res, params) {
  const busquedas = await db.all(
    "SELECT * FROM busquedas_pasajero WHERE pasajero_id = ? ORDER BY created_at DESC",
    [params.id]
  );
  if (busquedas.length === 0) return ok(res, []);

  const ids = busquedas.map((b) => b.id);
  const placeholders = ids.map(() => "?").join(",");
  const ofertas = await db.all(
    `SELECT o.*, v.origen_ciudad, v.destino_ciudad, v.fecha_salida, v.hora_salida, v.precio_por_asiento,
            u.nombre AS conductor_nombre, u.apellido AS conductor_apellido, u.foto_perfil AS conductor_foto,
            u.rating_promedio AS conductor_rating_promedio, u.rating_count AS conductor_rating_count
     FROM ofertas_conductor o
     JOIN viajes v ON v.id = o.viaje_id
     JOIN usuarios u ON u.id = o.conductor_id
     WHERE o.busqueda_id IN (${placeholders})
     ORDER BY o.created_at ASC`,
    ids
  );
  const ofertasPorBusqueda = {};
  for (const of of ofertas) {
    (ofertasPorBusqueda[of.busqueda_id] = ofertasPorBusqueda[of.busqueda_id] || []).push(of);
  }
  ok(
    res,
    busquedas.map((b) => ({ ...b, ofertas: ofertasPorBusqueda[b.id] || [] }))
  );
}

// El pasajero cancela su propia búsqueda mientras siga abierta — las ofertas pendientes que ya
// había recibido quedan rechazadas automáticamente (no tiene sentido dejarlas colgadas esperando
// una respuesta que ya no va a llegar).
async function cancelar(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const busqueda = await db.get("SELECT * FROM busquedas_pasajero WHERE id = ?", [params.id]);
  if (!busqueda) return notFound(res, "Búsqueda no encontrada");
  if (body.pasajero_id !== busqueda.pasajero_id) {
    return forbidden(res, "Solo el pasajero que publicó esta búsqueda puede cancelarla.");
  }
  if (busqueda.estado !== "abierta") {
    return badRequest(res, "Esta búsqueda ya no está abierta.");
  }
  await db.run("UPDATE busquedas_pasajero SET estado = 'cancelada' WHERE id = ?", [params.id]);
  await db.run(
    "UPDATE ofertas_conductor SET estado = 'rechazada', actualizado_at = ? WHERE busqueda_id = ? AND estado = 'pendiente'",
    [nowIso(), params.id]
  );
  ok(res, { mensaje: "Búsqueda cancelada." });
}

// ---------------------------------------------------------------------------
// Lado CONDUCTOR: ver las búsquedas abiertas de otros pasajeros, ver cuáles de sus propios viajes
// ya publicados le sirven para ofrecer de una, ofrecer, ver/cancelar sus propias ofertas.
// ---------------------------------------------------------------------------

// Búsquedas abiertas de CUALQUIER pasajero, para que cualquier conductor las navegue y ofrezca. A
// propósito no filtra por conductor ni por ruta — mismo criterio que /api/viajes/buscar (el
// conductor decide qué le conviene, no se le pre-filtra nada). No se manda ningún dato de contacto
// del pasajero acá (ni falta hace: el conductor todavía ni ofreció nada).
async function abiertas(req, res) {
  const hoy = new Date().toISOString().slice(0, 10);
  const rows = await db.all(
    `SELECT b.*, u.nombre AS pasajero_nombre, u.apellido AS pasajero_apellido,
            u.rating_promedio AS pasajero_rating_promedio, u.rating_count AS pasajero_rating_count
     FROM busquedas_pasajero b JOIN usuarios u ON u.id = b.pasajero_id
     WHERE b.estado = 'abierta' AND b.fecha_hasta >= ?
     ORDER BY b.fecha_desde ASC`,
    [hoy]
  );
  ok(res, rows);
}

// Viajes YA publicados por este conductor que sirven de una para una búsqueda puntual — para que
// el conductor pueda ofrecer con un solo clic sin tener que publicar de nuevo. Si esto devuelve
// vacío, el frontend manda al conductor a publicar un viaje nuevo (ver #/publicar?desde_busqueda=
// en js/views.js viewPublicar).
//
// FIX 21 oct 2026 (a pedido explícito del usuario: "No importa origen y destino, es un problema de
// la pagina! nbo me deja ofrecer viaje"): hasta ahora esto exigía que `origen_ciudad`/
// `destino_ciudad` del viaje coincidieran EXACTO con los de la búsqueda — un viaje publicado como,
// por ejemplo, "La Plata -> Pehuajó" nunca aparecía para una búsqueda "La Plata -> 9 de Julio",
// aunque 9 de Julio sea una parada intermedia real de ese viaje. El resto de la app (reservas.js,
// viajes.js) ya sabe resolver tramos parciales dentro de la ruta real de un viaje (ver
// server/corredor.js resolverTramo/asientosLibresPorTramoElemental) — acá se usa exactamente la
// misma lógica, en vez de la comparación exacta de ciudades.
//
// SEGUNDO FIX, mismo día (a pedido explícito del usuario, probando con un viaje de prueba que
// coincidía EXACTO en ciudades pero con otra fecha: "no importa fecha ni nada... no tiene que
// coincidir fecha, se lo tendria que poder ofrecer"): hasta acá también se exigía que
// `fecha_salida` del viaje cayera DENTRO del rango que pidió el pasajero — un viaje con la ruta
// exacta pero otro día quedaba afuera. Se saca esa restricción: ahora aparece cualquier viaje
// activo del conductor que sirva para la ruta (completo o tramo), sin importar la fecha — el
// pasajero ve la fecha real de cada oferta (el frontend ya la muestra, ver js/views.js
// abrirOfrecerViaje) y decide si le sirve o no al aceptar.
async function misViajesQueSirven(req, res, params, query) {
  const busqueda = await db.get("SELECT * FROM busquedas_pasajero WHERE id = ?", [params.id]);
  if (!busqueda) return notFound(res, "Búsqueda no encontrada");
  if (!query.conductor_id) return badRequest(res, "Falta conductor_id.");

  const candidatos = await db.all(
    `SELECT * FROM viajes
     WHERE conductor_id = ? AND estado = 'activo'
     ORDER BY fecha_salida ASC`,
    [query.conductor_id]
  );
  if (candidatos.length === 0) return ok(res, []);

  const ids = candidatos.map((v) => v.id);
  const placeholders = ids.map(() => "?").join(",");
  const reservasQueOcupanTodas = await db.all(
    `SELECT viaje_id, tramo_origen_ciudad, tramo_destino_ciudad, asientos_reservados FROM reservas
     WHERE viaje_id IN (${placeholders}) AND estado IN ('pendiente','aceptada','completada')`,
    ids
  );
  const reservasPorViaje = {};
  for (const r of reservasQueOcupanTodas) {
    (reservasPorViaje[r.viaje_id] = reservasPorViaje[r.viaje_id] || []).push(r);
  }

  const rows = [];
  for (const viaje of candidatos) {
    const camino = corredor.caminoDelViaje(viaje);
    const tramo = corredor.resolverTramo(camino, busqueda.origen_ciudad, busqueda.destino_ciudad);
    if (tramo.error) continue; // la búsqueda no es parte de la ruta real de este viaje

    const libresPorTramo = corredor.asientosLibresPorTramoElemental(camino, viaje.asientos_totales, reservasPorViaje[viaje.id] || []);
    const idxOrigen = camino.indexOf(tramo.origen);
    const idxDestino = camino.indexOf(tramo.destino);
    const libres = corredor.minAsientosLibresEnTramo(libresPorTramo, idxOrigen, idxDestino);
    if (libres < busqueda.asientos_necesarios) continue;

    // Precio del TRAMO que realmente le va a ofrecer (no el del viaje completo, si la búsqueda es
    // solo una parte de la ruta) — mismo cálculo que reservas.js crear() / viajes.js
    // desgloseReservaVista(), para que lo que se muestra acá sea lo mismo que se va a cobrar si el
    // pasajero acepta (ver aceptarOferta más abajo).
    let precioPorAsiento = viaje.precio_por_asiento;
    if (!tramo.esCompleto) {
      const calculoTramo = await pricing.calcularPorCiudades(tramo.origen, tramo.destino, viaje.asientos_totales);
      if (!calculoTramo.error) {
        precioPorAsiento = pricing.precioTramoConAjuste(viaje, calculoTramo.precioSugerido);
      }
    }

    rows.push({
      id: viaje.id,
      origen_ciudad: tramo.origen,
      destino_ciudad: tramo.destino,
      fecha_salida: viaje.fecha_salida,
      hora_salida: viaje.hora_salida,
      precio_por_asiento: precioPorAsiento,
      asientos_disponibles: libres,
    });
  }
  ok(res, rows);
}

// El conductor ofrece un viaje puntual suyo (ya publicado, o recién publicado para esto) a una
// búsqueda de un pasajero.
async function ofrecer(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!body.conductor_id || !body.viaje_id) return badRequest(res, "Faltan conductor_id y viaje_id.");

  const busqueda = await db.get("SELECT * FROM busquedas_pasajero WHERE id = ?", [params.id]);
  if (!busqueda) return notFound(res, "Búsqueda no encontrada");
  if (busqueda.estado !== "abierta") return badRequest(res, "Esta búsqueda ya no está abierta.");

  const viaje = await db.get("SELECT * FROM viajes WHERE id = ?", [body.viaje_id]);
  if (!viaje) return notFound(res, "Viaje no encontrado");
  if (viaje.conductor_id !== body.conductor_id) {
    return forbidden(res, "Ese viaje no es tuyo.");
  }
  if (viaje.estado !== "activo") return badRequest(res, "Ese viaje ya no está activo.");
  // FIX 21 oct 2026: antes esto exigía que origen/destino del viaje fueran EXACTOS a los de la
  // búsqueda — ahora acepta cualquier viaje cuya ruta real pase por esas dos ciudades, en el orden
  // correcto (tramo completo o parcial), igual que el resto de la app (ver corredor.resolverTramo
  // y el mismo fix en misViajesQueSirven más arriba).
  const camino = corredor.caminoDelViaje(viaje);
  const tramo = corredor.resolverTramo(camino, busqueda.origen_ciudad, busqueda.destino_ciudad);
  if (tramo.error) {
    return badRequest(res, `Ese viaje no pasa por la ruta que pide la búsqueda (${busqueda.origen_ciudad} → ${busqueda.destino_ciudad}).`);
  }
  // SEGUNDO FIX, mismo día (a pedido explícito del usuario — ver el comentario largo en
  // misViajesQueSirven más arriba): antes acá también se rechazaba si la fecha de salida del viaje
  // no caía dentro del rango pedido por el pasajero. Se saca esa restricción — el conductor puede
  // ofrecer el viaje igual aunque la fecha no coincida; el pasajero ve la fecha real de la oferta y
  // decide si la acepta.

  const yaOfrecio = await db.get(
    "SELECT id FROM ofertas_conductor WHERE busqueda_id = ? AND conductor_id = ? AND estado = 'pendiente'",
    [params.id, body.conductor_id]
  );
  if (yaOfrecio) return badRequest(res, "Ya le ofreciste un viaje a esta búsqueda — esperá a que el pasajero responda.");

  const id = newId("ofr");
  await db.run(
    `INSERT INTO ofertas_conductor (id, busqueda_id, conductor_id, viaje_id, estado, created_at) VALUES (?,?,?,?,?,?)`,
    [id, params.id, body.conductor_id, body.viaje_id, "pendiente", nowIso()]
  );
  created(res, { mensaje: "¡Listo! Le ofreciste el viaje al pasajero — te avisamos si lo acepta." });
}

// Ofertas que hizo un conductor, con su estado — para que sepa si fueron aceptadas/rechazadas o
// siguen esperando respuesta.
async function misOfertas(req, res, params) {
  const rows = await db.all(
    `SELECT o.*, b.origen_ciudad, b.destino_ciudad, b.fecha_desde, b.fecha_hasta, b.asientos_necesarios,
            u.nombre AS pasajero_nombre, u.apellido AS pasajero_apellido
     FROM ofertas_conductor o
     JOIN busquedas_pasajero b ON b.id = o.busqueda_id
     JOIN usuarios u ON u.id = b.pasajero_id
     WHERE o.conductor_id = ?
     ORDER BY o.created_at DESC`,
    [params.id]
  );
  ok(res, rows);
}

async function cancelarOferta(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const oferta = await db.get("SELECT * FROM ofertas_conductor WHERE id = ?", [params.id]);
  if (!oferta) return notFound(res, "Oferta no encontrada");
  if (body.conductor_id !== oferta.conductor_id) return forbidden(res, "Esa oferta no es tuya.");
  if (oferta.estado !== "pendiente") return badRequest(res, "Esa oferta ya no está pendiente.");
  await db.run("UPDATE ofertas_conductor SET estado = 'cancelada', actualizado_at = ? WHERE id = ?", [nowIso(), params.id]);
  ok(res, { mensaje: "Oferta cancelada." });
}

// ---------------------------------------------------------------------------
// El pasajero acepta una oferta puntual — acá se crea la RESERVA real (reutilizando el mismo
// motor de precios/disponibilidad que reservas.crear(), ver el comentario largo al principio del
// archivo) y se cierran automáticamente la búsqueda y las demás ofertas pendientes.
// ---------------------------------------------------------------------------
async function aceptarOferta(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!body.pasajero_id) return badRequest(res, "Falta pasajero_id.");

  const oferta = await db.get("SELECT * FROM ofertas_conductor WHERE id = ?", [params.id]);
  if (!oferta) return notFound(res, "Oferta no encontrada");
  if (oferta.estado !== "pendiente") return badRequest(res, "Esta oferta ya no está pendiente.");

  const busqueda = await db.get("SELECT * FROM busquedas_pasajero WHERE id = ?", [oferta.busqueda_id]);
  if (!busqueda) return notFound(res, "Búsqueda no encontrada");
  if (body.pasajero_id !== busqueda.pasajero_id) {
    return forbidden(res, "Solo el pasajero que publicó esta búsqueda puede aceptar una oferta.");
  }
  if (busqueda.estado !== "abierta") return badRequest(res, "Esta búsqueda ya no está abierta.");

  const viaje = await db.get("SELECT * FROM viajes WHERE id = ?", [oferta.viaje_id]);
  if (!viaje || viaje.estado !== "activo") {
    return badRequest(res, "El viaje que te habían ofrecido ya no está disponible.");
  }

  const pasajero = await db.get("SELECT * FROM usuarios WHERE id = ?", [body.pasajero_id]);
  if (!pasajero || pasajero.rol === "admin") return badRequest(res, "El usuario no puede reservar viajes.");
  if (pasajero.estado_validacion !== "aprobado") {
    return forbidden(res, "Tu perfil todavía está en revisión. Te avisamos por WhatsApp en menos de 24 hs.");
  }
  // Mismo bloqueo por deuda que reservas.crear() — ver el comentario largo ahí.
  const deuda = await db.get(
    `SELECT r.id, r.comision_plataforma, r.comprobante_pago, v.origen_ciudad, v.destino_ciudad, v.fecha_salida
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id
     WHERE r.pasajero_id = ? AND r.estado IN ('aceptada','completada') AND r.pagado = 0
     ORDER BY r.created_at ASC LIMIT 1`,
    [body.pasajero_id]
  );
  if (deuda) {
    return forbidden(
      res,
      `Tenés una comisión pendiente de $${deuda.comision_plataforma} por el viaje ${deuda.origen_ciudad} → ${deuda.destino_ciudad} ` +
        (deuda.comprobante_pago ? "(ya subiste el comprobante, está esperando que el equipo lo confirme)." : "todavía sin pagar.") +
        " Regularizala para poder aceptar esta oferta."
    );
  }

  // Disponibilidad por TRAMO real de la búsqueda dentro de la ruta del viaje (FIX 21 oct 2026 — ver
  // el mismo fix en misViajesQueSirven/ofrecer más arriba: antes esto asumía que la búsqueda era
  // siempre el viaje completo, usando los extremos del viaje en vez de los de la búsqueda) — mismo
  // cálculo que reservas.crear()/cambiarEstado().
  const asientos = busqueda.asientos_necesarios;
  const camino = corredor.caminoDelViaje(viaje);
  const tramo = corredor.resolverTramo(camino, busqueda.origen_ciudad, busqueda.destino_ciudad);
  if (tramo.error) {
    return badRequest(res, "El viaje que te habían ofrecido ya no coincide con la ruta de tu búsqueda.");
  }
  const reservasQueOcupan = await db.all(
    `SELECT tramo_origen_ciudad, tramo_destino_ciudad, asientos_reservados FROM reservas
     WHERE viaje_id = ? AND estado IN ('pendiente','aceptada','completada')`,
    [viaje.id]
  );
  const idxOrigen = camino.indexOf(tramo.origen);
  const idxDestino = camino.indexOf(tramo.destino);
  const libresPorTramo = corredor.asientosLibresPorTramoElemental(camino, viaje.asientos_totales, reservasQueOcupan);
  const libresEnEsteTramo = corredor.minAsientosLibresEnTramo(libresPorTramo, idxOrigen, idxDestino);
  if (asientos > libresEnEsteTramo) {
    return badRequest(
      res,
      libresEnEsteTramo > 0
        ? `El conductor ya solo tiene ${libresEnEsteTramo} asiento(s) libres — pedías ${asientos}.`
        : "El conductor ya no tiene asientos libres para este viaje."
    );
  }

  // El precio, igual que en reservas.crear(): tramo completo -> precio del viaje; tramo parcial ->
  // se recalcula de cero para ESE tramo y se le aplica el mismo % de margen que el conductor eligió
  // para el viaje completo (ver pricing.precioTramoConAjuste), nunca el precio del viaje completo.
  let precioPorAsiento = viaje.precio_por_asiento;
  if (!tramo.esCompleto) {
    const calculoTramo = await pricing.calcularPorCiudades(tramo.origen, tramo.destino, viaje.asientos_totales);
    if (calculoTramo.error) return badRequest(res, calculoTramo.error);
    precioPorAsiento = pricing.precioTramoConAjuste(viaje, calculoTramo.precioSugerido);
  }

  const desglose = await pricing.calcularDesgloseReserva(precioPorAsiento, asientos);
  const id = newId("res");
  await db.run(
    `INSERT INTO reservas (id, viaje_id, pasajero_id, asientos_reservados, tramo_origen_ciudad, tramo_destino_ciudad, estado, monto_total, comision_plataforma, monto_conductor, pagado, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      viaje.id,
      pasajero.id,
      asientos,
      tramo.origen,
      tramo.destino,
      // Se crea directo "aceptada": el conductor ya ofreció ESE viaje puntual, y el pasajero
      // aceptando es la confirmación mutua — a diferencia del flujo de siempre, acá no hace falta
      // un paso extra de "el conductor todavía tiene que aceptar".
      "aceptada",
      desglose.montoTotal,
      desglose.comisionPlataforma,
      desglose.montoConductor,
      0,
      nowIso(),
    ]
  );
  await db.run("UPDATE viajes SET asientos_disponibles = asientos_disponibles - ? WHERE id = ?", [asientos, viaje.id]);

  await db.run("UPDATE ofertas_conductor SET estado = 'aceptada', actualizado_at = ? WHERE id = ?", [nowIso(), oferta.id]);
  // Las demás ofertas pendientes de esta búsqueda quedan rechazadas automáticamente (decisión de
  // concurrencia elegida por el usuario, ver comentario en server/db.js).
  await db.run(
    "UPDATE ofertas_conductor SET estado = 'rechazada', actualizado_at = ? WHERE busqueda_id = ? AND estado = 'pendiente'",
    [nowIso(), busqueda.id]
  );
  await db.run("UPDATE busquedas_pasajero SET estado = 'cerrada' WHERE id = ?", [busqueda.id]);

  const reservaCreada = await db.get("SELECT * FROM reservas WHERE id = ?", [id]);
  created(res, {
    reserva: filaReserva(reservaCreada),
    mensaje: "¡Listo! Aceptaste la oferta. Pagá la comisión desde \"Mis viajes\" para que se destapen los datos del conductor.",
  });
}

module.exports = {
  crear,
  misBusquedas,
  cancelar,
  abiertas,
  misViajesQueSirven,
  ofrecer,
  misOfertas,
  cancelarOferta,
  aceptarOferta,
};
