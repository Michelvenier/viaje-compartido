// api/routes/reservas.js — Reservas, aceptación/rechazo, pago simulado (versión async/Postgres).
"use strict";

const db = require("../db");
const pricing = require("../pricing");
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
  const copy = boolFields(row, ["pagado"]);
  // "reembolso_aplica" queda null hasta que la reserva se cancela — a diferencia de "pagado",
  // acá null significa "todavía no aplica" y no debe convertirse en `false`.
  if (copy.reembolso_aplica !== null && copy.reembolso_aplica !== undefined) {
    copy.reembolso_aplica = !!copy.reembolso_aplica;
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
// menos de 24 hs, no corresponde reembolso de lo ya pagado.
function calcularReembolsoAplica(viaje) {
  const salida = new Date(`${viaje.fecha_salida}T${viaje.hora_salida}:00`);
  if (Number.isNaN(salida.getTime())) return true; // si no se puede determinar la fecha, no penalizamos al pasajero
  const msHastaSalida = salida.getTime() - Date.now();
  return msHastaSalida >= 24 * 60 * 60 * 1000;
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
    `SELECT r.*, u.nombre, u.apellido, u.foto_perfil, u.rating_promedio, u.rating_count, u.telefono
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

  const permitidos = ["aceptada", "rechazada", "cancelada", "completada"];
  if (!permitidos.includes(body.estado)) return badRequest(res, "Estado inválido");

  // El viaje se marca "completado" recién cuando ya se aceptó Y se pagó la comisión — antes de
  // eso no hay nada que confirmar. Marcarlo como completado habilita las calificaciones y suma a
  // las estadísticas del negocio (ver /api/admin/estadisticas).
  if (body.estado === "completada") {
    if (reserva.estado !== "aceptada") {
      return badRequest(res, "Solo se puede marcar como completado un viaje con una reserva aceptada.");
    }
    if (!reserva.pagado) {
      return badRequest(res, "Todavía falta pagar la comisión de la plataforma para poder marcar el viaje como completado.");
    }
  }

  if (body.estado === "cancelada" && ["cancelada", "rechazada", "completada"].includes(reserva.estado)) {
    return badRequest(res, "Esta reserva ya no se puede cancelar.");
  }

  if (body.estado === "aceptada" && reserva.estado === "pendiente") {
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

async function pagar(req, res, params) {
  const reserva = await db.get(
    `SELECT r.*, v.conductor_id, u.nombre AS conductor_nombre, u.apellido AS conductor_apellido, u.alias_cobro AS conductor_alias
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id JOIN usuarios u ON u.id = v.conductor_id WHERE r.id = ?`,
    [params.id]
  );
  if (!reserva) return notFound(res, "Reserva no encontrada");
  if (reserva.estado !== "aceptada") {
    return badRequest(res, "Solo se puede pagar una reserva ya aceptada por el conductor.");
  }
  await db.run("UPDATE reservas SET pagado = 1, actualizado_at = ? WHERE id = ?", [nowIso(), params.id]);
  const actualizado = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  ok(res, {
    reserva: filaReserva(actualizado),
    mensaje: `Pago de la comisión de Ruta Compartida registrado ($${reserva.comision_plataforma}). Todavía le debés al conductor ` +
      `$${reserva.monto_conductor} por el viaje en sí — transferíselos por transferencia o QR de Mercado Pago a su alias "${reserva.conductor_alias || "sin alias cargado"}" ` +
      `al momento de viajar.`,
  });
}

module.exports = { crear, obtener, porPasajero, porViaje, cambiarEstado, pagar };
