// api/routes/reservas.js — Reservas, aceptación/rechazo, pago simulado (versión async/Postgres).
"use strict";

const db = require("../db");
const pricing = require("../pricing");
const { newId, nowIso, ok, created, badRequest, notFound, forbidden, readBody, boolFields } = require("../helpers");

function filaReserva(row) {
  if (!row) return row;
  return boolFields(row, ["pagado"]);
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

async function obtener(req, res, params) {
  const row = await db.get(
    `SELECT r.*, v.origen_ciudad, v.destino_ciudad, v.fecha_salida, v.hora_salida, v.conductor_id, v.precio_por_asiento
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id WHERE r.id = ?`,
    [params.id]
  );
  if (!row) return notFound(res, "Reserva no encontrada");
  ok(res, filaReserva(row));
}

async function porPasajero(req, res, params) {
  const rows = await db.all(
    `SELECT r.*, v.origen_ciudad, v.destino_ciudad, v.fecha_salida, v.hora_salida, v.conductor_id
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id
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

  await db.run("UPDATE reservas SET estado = ?, actualizado_at = ? WHERE id = ?", [body.estado, nowIso(), params.id]);
  const actualizado = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  ok(res, filaReserva(actualizado));
}

async function pagar(req, res, params) {
  const reserva = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  if (!reserva) return notFound(res, "Reserva no encontrada");
  if (reserva.estado !== "aceptada") {
    return badRequest(res, "Solo se puede pagar una reserva ya aceptada por el conductor.");
  }
  await db.run("UPDATE reservas SET pagado = 1, actualizado_at = ? WHERE id = ?", [nowIso(), params.id]);
  const actualizado = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  ok(res, {
    reserva: filaReserva(actualizado),
    mensaje: "Pago simulado registrado. El monto queda retenido por la plataforma hasta que se complete el viaje.",
  });
}

module.exports = { crear, obtener, porPasajero, porViaje, cambiarEstado, pagar };
