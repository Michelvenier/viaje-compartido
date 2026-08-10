// api/routes/admin.js — Validación manual de perfiles + configuración de precios (versión async/Postgres).
"use strict";

const db = require("../db");
const { ok, badRequest, notFound, readBody, usuarioPublico } = require("../helpers");

async function pendientes(req, res) {
  const rows = await db.all("SELECT * FROM usuarios WHERE estado_validacion = 'pendiente' ORDER BY created_at ASC");
  ok(res, rows.map(usuarioPublico));
}

async function listarUsuarios(req, res) {
  const rows = await db.all("SELECT * FROM usuarios ORDER BY created_at DESC");
  ok(res, rows.map(usuarioPublico));
}

async function validar(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!["aprobado", "rechazado"].includes(body.estado)) return badRequest(res, "Estado inválido");
  const row = await db.get("SELECT * FROM usuarios WHERE id = ?", [params.id]);
  if (!row) return notFound(res, "Usuario no encontrado");
  await db.run("UPDATE usuarios SET estado_validacion = ?, motivo_rechazo = ? WHERE id = ?", [
    body.estado,
    body.motivo || null,
    params.id,
  ]);
  const actualizado = await db.get("SELECT * FROM usuarios WHERE id = ?", [params.id]);
  ok(res, usuarioPublico(actualizado));
}

async function verConfig(req, res) {
  const rows = await db.all("SELECT * FROM config");
  const config = {};
  rows.forEach((r) => (config[r.clave] = Number(r.valor)));
  ok(res, config);
}

async function actualizarConfig(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const permitidas = [
    "precio_nafta_super",
    "peaje_default_ruta5_226",
    "comision_plataforma_pct",
    "comision_minima",
    "consumo_litros_100km",
    "tolerancia_ajuste_pct",
  ];
  for (const clave of permitidas) {
    if (clave in body) await db.run("UPDATE config SET valor = ? WHERE clave = ?", [String(body[clave]), clave]);
  }
  await verConfig(req, res);
}

// Endpoint protegido de una sola vez para inicializar el esquema y cargar datos de ejemplo
// en la base Postgres recién provisionada (no se puede correr `node data/seed.js` local
// porque la base vive en la nube). Requiere la variable de entorno SEED_SECRET.
async function seed(req, res, params, query) {
  if (!process.env.SEED_SECRET || query.secret !== process.env.SEED_SECRET) {
    return badRequest(res, "Falta o es incorrecto el parámetro ?secret=");
  }
  const { runSeed } = require("../seed-data");
  const resultado = await runSeed();
  ok(res, resultado);
}

module.exports = { pendientes, listarUsuarios, validar, verConfig, actualizarConfig, seed };
