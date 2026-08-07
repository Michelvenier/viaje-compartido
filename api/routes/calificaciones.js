// api/routes/calificaciones.js — Calificaciones mutuas post-viaje (versión async/Postgres).
"use strict";

const db = require("../db");
const { newId, nowIso, ok, created, badRequest, notFound, readBody } = require("../helpers");

async function crear(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const requeridos = ["reserva_id", "autor_id", "destinatario_id", "puntuacion"];
  for (const campo of requeridos) {
    if (!body[campo]) return badRequest(res, `Falta el campo obligatorio: ${campo}`);
  }
  const reserva = await db.get("SELECT * FROM reservas WHERE id = ?", [body.reserva_id]);
  if (!reserva) return notFound(res, "Reserva no encontrada");

  const id = newId("cal");
  await db.run(
    `INSERT INTO calificaciones (id, reserva_id, autor_id, destinatario_id, puntuacion, manejo, comodidad, comentario, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      body.reserva_id,
      body.autor_id,
      body.destinatario_id,
      Number(body.puntuacion),
      body.manejo ? Number(body.manejo) : null,
      body.comodidad ? Number(body.comodidad) : null,
      body.comentario || null,
      nowIso(),
    ]
  );

  const agg = await db.get(
    "SELECT AVG(puntuacion) AS promedio, COUNT(*) AS cantidad FROM calificaciones WHERE destinatario_id = ?",
    [body.destinatario_id]
  );
  await db.run("UPDATE usuarios SET rating_promedio = ?, rating_count = ? WHERE id = ?", [
    Math.round((Number(agg.promedio) || 0) * 10) / 10,
    Number(agg.cantidad),
    body.destinatario_id,
  ]);

  const row = await db.get("SELECT * FROM calificaciones WHERE id = ?", [id]);
  created(res, row);
}

async function porUsuario(req, res, params) {
  const rows = await db.all("SELECT * FROM calificaciones WHERE destinatario_id = ? ORDER BY created_at DESC", [
    params.usuarioId,
  ]);
  ok(res, rows);
}

module.exports = { crear, porUsuario };
