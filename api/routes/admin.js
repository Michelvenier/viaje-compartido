// api/routes/admin.js — Validación manual de perfiles + configuración de precios (versión async/Postgres).
"use strict";

const db = require("../db");
const { ok, badRequest, notFound, forbidden, readBody, usuarioPublico, newId, nowIso, hashPassword } = require("../helpers");

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

// "distancias_corredor" guarda un JSON (ciudad -> {km, peaje}), no un número — se trata aparte.
const CLAVES_JSON = ["distancias_corredor"];

async function verConfig(req, res) {
  const rows = await db.all("SELECT * FROM config");
  const config = {};
  rows.forEach((r) => (config[r.clave] = CLAVES_JSON.includes(r.clave) ? JSON.parse(r.valor) : Number(r.valor)));
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
    "comision_plataforma_pct",
    "comision_minima",
    "consumo_litros_100km",
    "tolerancia_ajuste_pct",
    "precio_minimo_por_km",
    "precio_minimo_base",
    "distancias_corredor",
  ];
  for (const clave of permitidas) {
    if (!(clave in body)) continue;
    const valor = CLAVES_JSON.includes(clave) ? JSON.stringify(body[clave]) : String(body[clave]);
    await db.run("UPDATE config SET valor = ? WHERE clave = ?", [valor, clave]);
  }
  await verConfig(req, res);
}

// Estadísticas agregadas del negocio: viajes completados, pasajeros trasladados y comisión
// facturada. Se calculan al vuelo con SQL en vez de mantener contadores aparte, para no
// desincronizarse nunca de la fuente real (viajes y reservas).
async function estadisticas(req, res) {
  const [viajesCompletados, pasajeros, comisiones, totalConductores, totalPasajeros] = await Promise.all([
    db.get(`SELECT COUNT(*) AS c FROM reservas WHERE estado = 'completada'`),
    db.get(`SELECT COALESCE(SUM(asientos_reservados), 0) AS c FROM reservas WHERE estado = 'completada'`),
    db.get(`SELECT COALESCE(SUM(comision_plataforma), 0) AS c FROM reservas WHERE pagado = 1`),
    db.get(`SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'conductor' AND estado_validacion = 'aprobado'`),
    db.get(`SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'pasajero' AND estado_validacion = 'aprobado'`),
  ]);
  ok(res, {
    viajesCompletados: Number(viajesCompletados.c),
    pasajerosTrasladados: Number(pasajeros.c),
    comisionFacturada: Number(comisiones.c),
    conductoresAprobados: Number(totalConductores.c),
    pasajerosAprobados: Number(totalPasajeros.c),
  });
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

// Único punto para crear o resetear la contraseña de la cuenta admin. Protegido por la
// variable de entorno ADMIN_SETUP_SECRET (se define solo en el panel de Vercel, nunca en
// el código/git). Es la ÚNICA forma de que una cuenta con rol "admin" quede con una
// contraseña utilizable — así nadie puede "convertirse" en admin por otra vía.
async function configurarAdmin(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!process.env.ADMIN_SETUP_SECRET) {
    return badRequest(
      res,
      "El servidor no tiene configurada la variable de entorno ADMIN_SETUP_SECRET. Agregala en Vercel (Settings → Environment Variables) antes de usar este endpoint."
    );
  }
  if (body.secret !== process.env.ADMIN_SETUP_SECRET) {
    return forbidden(res, "Secret incorrecto.");
  }
  if (!body.password || String(body.password).length < 10) {
    return badRequest(res, "La contraseña del admin debe tener al menos 10 caracteres.");
  }

  const email = body.email || "admin@rutacompartida.com.ar";
  const hash = hashPassword(body.password);
  const existente = await db.get("SELECT id FROM usuarios WHERE email = ?", [email]);

  if (existente) {
    await db.run("UPDATE usuarios SET password = ?, rol = 'admin', estado_validacion = 'aprobado' WHERE email = ?", [
      hash,
      email,
    ]);
  } else {
    const id = newId("usr");
    await db.run(
      `INSERT INTO usuarios (id, rol, nombre, apellido, email, password, estado_validacion, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [id, "admin", body.nombre || "Admin", body.apellido || "Ruta Compartida", email, hash, "aprobado", nowIso()]
    );
  }

  ok(res, { mensaje: `Listo. Ya podés ingresar como administrador con el email "${email}" y la contraseña que elegiste.` });
}

module.exports = { pendientes, listarUsuarios, validar, verConfig, actualizarConfig, estadisticas, seed, configurarAdmin };
