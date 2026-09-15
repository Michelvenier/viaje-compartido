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

// Viajes YA publicados por este conductor que sirven de una para una búsqueda puntual (mismas
// ciudades, activo, y la fecha de salida cae dentro del rango pedido) — para que el conductor
// pueda ofrecer con un solo clic sin tener que publicar de nuevo. Si esto devuelve vacío, el
// frontend manda al conductor a publicar un viaje nuevo (ver #/publicar?desde_busqueda= en
// js/views.js viewPublicar).
async function misViajesQueSirven(req, res, params, query) {
  const busqueda = await db.get("SELECT * FROM busquedas_pasajero WHERE id = ?", [params.id]);
  if (!busqueda) return notFound(res, "Búsqueda no encontrada");
  if (!query.conductor_id) return badRequest(res, "Falta conductor_id.");
  const rows = await db.all(
    `SELECT id, origen_ciudad, destino_ciudad, fecha_salida, hora_salida, precio_por_asiento, asientos_disponibles
     FROM viajes
     WHERE conductor_id = ? AND estado = 'activo' AND origen_ciudad = ? AND destino_ciudad = ?
       AND fecha_salida BETWEEN ? AND ? AND asientos_disponibles >= ?
     ORDER BY fecha_salida ASC`,
    [query.conductor_id, busqueda.origen_ciudad, busqueda.destino_ciudad, busqueda.fecha_desde, busqueda.fecha_hasta, busqueda.asientos_necesarios]
  );
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
  // Mismas ciudades exactas que pidió el pasajero — evita confusión (el pasajero armó la búsqueda
  // esperando esa ruta puntual); si el conductor hace un camino parecido pero no exacto, que
  // publique/ofrezca desde la búsqueda real, no desde acá.
  if (viaje.origen_ciudad !== busqueda.origen_ciudad || viaje.destino_ciudad !== busqueda.destino_ciudad) {
    return badRequest(res, `Ese viaje es ${viaje.origen_ciudad} → ${viaje.destino_ciudad}, pero la búsqueda pide ${busqueda.origen_ciudad} → ${busqueda.destino_ciudad}.`);
  }
  if (viaje.fecha_salida < busqueda.fecha_desde || viaje.fecha_salida > busqueda.fecha_hasta) {
    return badRequest(res, `Ese viaje sale el ${viaje.fecha_salida}, fuera del rango que pidió el pasajero (${busqueda.fecha_desde} a ${busqueda.fecha_hasta}).`);
  }

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

  // Disponibilidad por tramo (tramo completo siempre acá — "Busco viaje" es solo ciudad origen/
  // destino, sin tramos parciales, a diferencia de una reserva armada a mano desde la búsqueda de
  // viajes) — mismo cálculo que reservas.crear()/cambiarEstado().
  const asientos = busqueda.asientos_necesarios;
  const camino = corredor.caminoDelViaje(viaje);
  const reservasQueOcupan = await db.all(
    `SELECT tramo_origen_ciudad, tramo_destino_ciudad, asientos_reservados FROM reservas
     WHERE viaje_id = ? AND estado IN ('pendiente','aceptada','completada')`,
    [viaje.id]
  );
  const idxOrigen = camino.indexOf(viaje.origen_ciudad);
  const idxDestino = camino.indexOf(viaje.destino_ciudad);
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

  const desglose = await pricing.calcularDesgloseReserva(viaje.precio_por_asiento, asientos);
  const id = newId("res");
  await db.run(
    `INSERT INTO reservas (id, viaje_id, pasajero_id, asientos_reservados, tramo_origen_ciudad, tramo_destino_ciudad, estado, monto_total, comision_plataforma, monto_conductor, pagado, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      viaje.id,
      pasajero.id,
      asientos,
      viaje.origen_ciudad,
      viaje.destino_ciudad,
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
