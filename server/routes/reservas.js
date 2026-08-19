// api/routes/reservas.js — Reservas, aceptación/rechazo, pago simulado (versión async/Postgres).
"use strict";

const db = require("../db");
const pricing = require("../pricing");
const { enviarEmailAdmin } = require("../email");
const { newId, nowIso, ok, created, badRequest, notFound, forbidden, readBody, boolFields } = require("../helpers");

// Campos "completos" del conductor (foto, bio, auto, teléfono) que solo deben verse una vez
// que el conductor ACEPTÓ la reserva — antes de eso el pasajero solo vio nombre y valoración
// en el detalle del viaje (ver conConductor() en routes/viajes.js). Esto evita que alguien
// contacte al conductor por fuera de la app antes de confirmar (y pagar la comisión).
const CAMPOS_CONDUCTOR_COMPLETOS = [
  "conductor_foto",
  "conductor_bio",
  "conductor_telefono",
  "conductor_vehiculo_marca",
  "conductor_vehiculo_modelo",
  "conductor_vehiculo_color",
  "conductor_rating_promedio",
  "conductor_rating_count",
];

function filaReserva(row) {
  if (!row) return row;
  const copy = boolFields(row, ["pagado", "reembolso_manual_realizado"]);
  // "reembolso_aplica" y "asistio" quedan null hasta que corresponda (cancelación / reporte del
  // conductor) — a diferencia de "pagado", acá null significa "todavía no aplica" y no debe
  // convertirse en `false`.
  for (const campo of ["reembolso_aplica", "asistio"]) {
    if (copy[campo] !== null && copy[campo] !== undefined) copy[campo] = !!copy[campo];
  }
  const confirmada = ["aceptada", "completada"].includes(copy.estado);
  if (!confirmada) {
    for (const campo of CAMPOS_CONDUCTOR_COMPLETOS) delete copy[campo];
  }
  return copy;
}

// Política de cancelación (24 hs binarias, ver Reglas de la Ruta 2.5 y api/routes/reservas.js):
// si al momento de cancelar faltan 24 hs o más para la salida del viaje, corresponde reembolso
// total (o directamente no se cobra nada, si todavía no había pagado la comisión). Si faltan
// menos de 24 hs, no corresponde reembolso de lo ya pagado. Usa el mismo límite de 24 hs que la
// penalización a la cuenta corriente del conductor (ver pricing.faltanMenosDe24Hs).
function calcularReembolsoAplica(viaje) {
  return !pricing.faltanMenosDe24Hs(viaje);
}

async function crear(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!body.viaje_id || !body.pasajero_id) return badRequest(res, "Faltan viaje_id y pasajero_id");

  const viaje = await db.get("SELECT * FROM viajes WHERE id = ?", [body.viaje_id]);
  if (!viaje) return notFound(res, "Viaje no encontrado");
  if (viaje.estado !== "activo") return badRequest(res, "Este viaje ya no está disponible.");

  const pasajero = await db.get("SELECT * FROM usuarios WHERE id = ?", [body.pasajero_id]);
  if (!pasajero || pasajero.rol !== "pasajero") return badRequest(res, "El usuario no es un pasajero registrado.");
  if (pasajero.estado_validacion !== "aprobado") {
    return forbidden(
      res,
      "Tu perfil todavía está en revisión. Te avisamos por WhatsApp en menos de 24 hs cuando estés habilitado para reservar."
    );
  }

  // Bloqueo por deuda (a pedido del usuario, 19 ago 2026): si el pasajero ya tiene una reserva
  // aceptada/completada sin pagar la comisión (haya declarado un comprobante o no — recién se
  // considera "saldada" cuando el admin la confirma), no puede reservar otro viaje hasta
  // regularizar esa deuda. Evita que alguien acumule reservas nuevas mientras debe comisiones
  // anteriores.
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
        (deuda.comprobante_pago
          ? "(ya subiste el comprobante, está esperando que el equipo lo confirme)."
          : "todavía sin pagar.") +
        " Regularizala para poder reservar otro viaje."
    );
  }

  const asientos = Math.max(1, Number(body.asientos_reservados) || 1);
  if (asientos > viaje.asientos_disponibles) {
    return badRequest(res, `Solo quedan ${viaje.asientos_disponibles} asiento(s) disponibles en este viaje.`);
  }

  const desglose = await pricing.calcularDesgloseReserva(viaje.precio_por_asiento, asientos);
  const id = newId("res");
  await db.run(
    `INSERT INTO reservas (id, viaje_id, pasajero_id, asientos_reservados, estado, monto_total, comision_plataforma, monto_conductor, pagado, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, viaje.id, pasajero.id, asientos, "pendiente", desglose.montoTotal, desglose.comisionPlataforma, desglose.montoConductor, 0, nowIso()]
  );

  const row = await db.get("SELECT * FROM reservas WHERE id = ?", [id]);
  created(res, {
    reserva: filaReserva(row),
    mensaje: "Solicitud enviada. El conductor tiene que aceptarla para confirmar tu lugar.",
  });
}

const SELECT_CONDUCTOR_RESERVA = `
  u.nombre AS conductor_nombre, u.apellido AS conductor_apellido, u.alias_cobro AS conductor_alias,
  u.foto_perfil AS conductor_foto, u.bio AS conductor_bio, u.telefono AS conductor_telefono,
  u.vehiculo_marca AS conductor_vehiculo_marca, u.vehiculo_modelo AS conductor_vehiculo_modelo,
  u.vehiculo_color AS conductor_vehiculo_color, u.rating_promedio AS conductor_rating_promedio,
  u.rating_count AS conductor_rating_count`;

async function obtener(req, res, params) {
  const row = await db.get(
    `SELECT r.*, v.origen_ciudad, v.destino_ciudad, v.fecha_salida, v.hora_salida, v.conductor_id, v.precio_por_asiento,
            ${SELECT_CONDUCTOR_RESERVA}
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id JOIN usuarios u ON u.id = v.conductor_id WHERE r.id = ?`,
    [params.id]
  );
  if (!row) return notFound(res, "Reserva no encontrada");
  ok(res, filaReserva(row));
}

async function porPasajero(req, res, params) {
  const rows = await db.all(
    `SELECT r.*, v.origen_ciudad, v.destino_ciudad, v.fecha_salida, v.hora_salida, v.conductor_id,
            ${SELECT_CONDUCTOR_RESERVA}
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id JOIN usuarios u ON u.id = v.conductor_id
     WHERE r.pasajero_id = ? ORDER BY r.created_at DESC`,
    [params.pasajeroId]
  );
  ok(res, rows.map(filaReserva));
}

async function porViaje(req, res, params) {
  const rows = await db.all(
    `SELECT r.*, u.nombre, u.apellido, u.foto_perfil, u.rating_promedio, u.rating_count, u.telefono, u.no_show_count
     FROM reservas r JOIN usuarios u ON u.id = r.pasajero_id
     WHERE r.viaje_id = ? ORDER BY r.created_at ASC`,
    [params.viajeId]
  );
  ok(res, rows.map(filaReserva));
}

async function cambiarEstado(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const reserva = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  if (!reserva) return notFound(res, "Reserva no encontrada");

  // "completada" ya NO se pide acá: ahora la marca exclusivamente el conductor reportando si el
  // pasajero viajó o no, vía PATCH /api/reservas/:id/asistencia (ver reportarAsistencia más abajo)
  // — así siempre queda registrado ese dato, no solo un "completado" genérico.
  const permitidos = ["aceptada", "rechazada", "cancelada"];
  if (!permitidos.includes(body.estado)) return badRequest(res, "Estado inválido");

  if (body.estado === "cancelada" && ["cancelada", "rechazada", "completada"].includes(reserva.estado)) {
    return badRequest(res, "Esta reserva ya no se puede cancelar.");
  }

  if (body.estado === "aceptada" && reserva.estado === "pendiente") {
    // Orden de prioridad: por reserva, por hora — el conductor tiene que resolver (aceptar o
    // rechazar) las solicitudes pendientes en el orden en que llegaron. No puede aceptar una más
    // nueva mientras haya una más vieja todavía sin resolver para el mismo viaje.
    const anterior = await db.get(
      `SELECT id FROM reservas WHERE viaje_id = ? AND estado = 'pendiente' AND created_at < ? ORDER BY created_at ASC LIMIT 1`,
      [reserva.viaje_id, reserva.created_at]
    );
    if (anterior) {
      return badRequest(
        res,
        "Hay una solicitud anterior todavía pendiente para este viaje. El orden de prioridad es por hora de reserva — resolvé esa primero (aceptala o rechazala)."
      );
    }
    const viaje = await db.get("SELECT * FROM viajes WHERE id = ?", [reserva.viaje_id]);
    if (viaje.asientos_disponibles < reserva.asientos_reservados) {
      return badRequest(res, "Ya no quedan suficientes asientos disponibles.");
    }
    await db.run("UPDATE viajes SET asientos_disponibles = asientos_disponibles - ? WHERE id = ?", [
      reserva.asientos_reservados,
      viaje.id,
    ]);
  }

  if ((body.estado === "rechazada" || body.estado === "cancelada") && reserva.estado === "aceptada") {
    await db.run("UPDATE viajes SET asientos_disponibles = asientos_disponibles + ? WHERE id = ?", [
      reserva.asientos_reservados,
      reserva.viaje_id,
    ]);
  }

  // Política de cancelación (Reglas de la Ruta 2.5): 24 hs o más antes de la salida -> reembolso
  // total (o directamente no se cobra nada, si todavía no había pagado). Menos de 24 hs -> no
  // corresponde reembolso de la comisión ya pagada. Esto se calcula UNA sola vez, en el momento
  // de la cancelación, y queda guardado — nunca se recalcula después.
  let mensaje;
  if (body.estado === "cancelada") {
    const viaje = await db.get("SELECT fecha_salida, hora_salida FROM viajes WHERE id = ?", [reserva.viaje_id]);
    const reembolsoAplica = calcularReembolsoAplica(viaje);
    await db.run("UPDATE reservas SET estado = ?, actualizado_at = ?, reembolso_aplica = ? WHERE id = ?", [
      body.estado,
      nowIso(),
      reembolsoAplica ? 1 : 0,
      params.id,
    ]);
    if (!reserva.pagado) {
      mensaje = "Reserva cancelada. Como todavía no habías pagado la comisión, no se te cobra nada.";
    } else if (reembolsoAplica) {
      mensaje = "Reserva cancelada con 24 hs o más de anticipación: se te reembolsa el 100% de la comisión pagada.";
    } else {
      mensaje =
        "Reserva cancelada con menos de 24 hs de anticipación: según la política de cancelación, no corresponde reembolso de la comisión ya pagada.";
    }
  } else {
    await db.run("UPDATE reservas SET estado = ?, actualizado_at = ? WHERE id = ?", [body.estado, nowIso(), params.id]);
  }

  const actualizado = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  ok(res, { ...filaReserva(actualizado), mensaje });
}

// El pasajero declara que ya pagó la comisión de la plataforma, adjuntando un comprobante — esto
// YA NO marca "pagado = 1" directo (era un pago simulado instantáneo antes): queda declarado, y
// recién el admin lo confirma desde el panel (ver server/routes/admin.js confirmarPagoReserva),
// mismo patrón que la cuenta corriente de los conductores (declararPagoCuenta/confirmarPagoCuenta).
// Así "pagado" siempre significa "el equipo confirmó que efectivamente entró la plata", no solo
// "el pasajero dice que pagó".
async function pagar(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!body.comprobante) return badRequest(res, "Subí el comprobante del pago de la comisión.");

  const reserva = await db.get(
    `SELECT r.*, v.conductor_id, u.nombre AS conductor_nombre, u.apellido AS conductor_apellido
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id JOIN usuarios u ON u.id = v.conductor_id WHERE r.id = ?`,
    [params.id]
  );
  if (!reserva) return notFound(res, "Reserva no encontrada");
  if (reserva.estado !== "aceptada") {
    return badRequest(res, "Solo se puede pagar una reserva ya aceptada por el conductor.");
  }
  if (reserva.pagado) return badRequest(res, "Esta reserva ya está pagada y confirmada.");

  await db.run("UPDATE reservas SET comprobante_pago = ?, actualizado_at = ? WHERE id = ?", [
    body.comprobante,
    nowIso(),
    params.id,
  ]);
  const actualizado = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  ok(res, {
    reserva: filaReserva(actualizado),
    mensaje:
      `Comprobante recibido. Queda pendiente de que el equipo de Ruta Compartida confirme el pago de la comisión ($${reserva.comision_plataforma}). ` +
      `Aparte, no te olvides que le debés $${reserva.monto_conductor} al conductor por el viaje en sí — coordinen el medio de pago directamente al momento de viajar.`,
  });
}

// El CONDUCTOR (nunca el pasajero) reporta si el pasajero efectivamente viajó o no — esto es lo
// que ahora marca la reserva como "completada" (reemplaza el viejo botón genérico de "marcar como
// completado"). Como la comisión se cobra siempre al aceptar y pagar, sin importar si el viaje se
// termina haciendo, si el pasajero NO viajó el reembolso de esa comisión lo procesa el admin a
// mano — por eso se manda un email de aviso y se deja todo guardado (reembolso_manual_realizado,
// no_show_count del pasajero) para que quede como una cola de pendientes, no se pierda nada.
async function reportarAsistencia(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (typeof body.asistio !== "boolean") {
    return badRequest(res, "Falta indicar si el pasajero viajó o no (asistio: true/false).");
  }
  if (!body.conductor_id) return badRequest(res, "Falta conductor_id.");

  const reserva = await db.get(
    `SELECT r.*, v.conductor_id, v.origen_ciudad, v.destino_ciudad, v.fecha_salida, v.hora_salida,
            u.nombre AS pasajero_nombre, u.apellido AS pasajero_apellido, u.alias_cobro AS pasajero_alias, u.email AS pasajero_email
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id JOIN usuarios u ON u.id = r.pasajero_id WHERE r.id = ?`,
    [params.id]
  );
  if (!reserva) return notFound(res, "Reserva no encontrada");
  if (body.conductor_id !== reserva.conductor_id) {
    return forbidden(res, "Solo el conductor de este viaje puede reportar si el pasajero viajó o no.");
  }
  if (reserva.estado !== "aceptada") {
    return badRequest(res, "Solo se puede reportar la asistencia de una reserva aceptada.");
  }
  if (!reserva.pagado) {
    return badRequest(res, "Todavía falta que el pasajero pague la comisión de la plataforma.");
  }

  await db.run(
    "UPDATE reservas SET estado = 'completada', asistio = ?, asistio_reportado_at = ?, actualizado_at = ? WHERE id = ?",
    [body.asistio ? 1 : 0, nowIso(), nowIso(), params.id]
  );

  let emailEnviado = false;
  if (!body.asistio) {
    await db.run("UPDATE usuarios SET no_show_count = no_show_count + 1 WHERE id = ?", [reserva.pasajero_id]);
    const resultado = await enviarEmailAdmin({
      asunto: `Ruta Compartida — pasajero no viajó, reembolso manual pendiente`,
      texto:
        `El conductor reportó que el pasajero NO viajó en esta reserva.\n\n` +
        `Pasajero: ${reserva.pasajero_nombre} ${reserva.pasajero_apellido} (${reserva.pasajero_email})\n` +
        `Viaje: ${reserva.origen_ciudad} → ${reserva.destino_ciudad}, ${reserva.fecha_salida} ${reserva.hora_salida}\n\n` +
        `Se le debe reembolsar la comisión ya pagada: $${reserva.comision_plataforma}\n` +
        `Alias / CBU para transferirle: ${reserva.pasajero_alias || "(no cargó un alias — contactalo por WhatsApp para pedírselo)"}\n\n` +
        `Marcá esta reserva como "reembolsado" en el panel de administración una vez que hagas la transferencia manual.`,
    });
    emailEnviado = resultado.enviado;
  }

  const actualizado = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  ok(res, {
    ...filaReserva(actualizado),
    emailEnviado,
    mensaje: body.asistio
      ? "¡Listo! Viaje confirmado. Ya se pueden calificar mutuamente."
      : "Reportado. Como el pasajero no viajó, la comisión que ya pagó queda pendiente de un reembolso manual — se avisó al admin por email.",
  });
}

module.exports = { crear, obtener, porPasajero, porViaje, cambiarEstado, pagar, reportarAsistencia };
