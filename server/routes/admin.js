// api/routes/admin.js — Validación manual de perfiles + configuración de precios (versión async/Postgres).
"use strict";

const db = require("../db");
const { ok, badRequest, notFound, forbidden, readBody, usuarioPublico, boolFields, newId, nowIso, hashPassword } = require("../helpers");
const { DISTANCIAS_DEFAULT } = require("../corredor");

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
  // Si se agregó una ciudad nueva al código (server/corredor.js) después de que esta base ya
  // tenía su propia fila de "distancias_corredor" guardada, esa ciudad nueva no aparece sola en
  // la base (el INSERT inicial solo corre una vez, con ON CONFLICT DO NOTHING). Para que el panel
  // de admin siempre muestre TODAS las ciudades habilitadas (y el admin pueda revisar/corregir el
  // km y peaje estimado de las nuevas apenas entra, sin que nadie tenga que tocar la base a mano),
  // acá se completa con el valor de referencia del código cualquier ciudad que falte. Ni bien el
  // admin aprieta "Guardar distancias" una vez, esto queda persistido en la base tal cual.
  config.distancias_corredor = { ...DISTANCIAS_DEFAULT, ...(config.distancias_corredor || {}) };
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
    "penalizacion_cancelacion_menos24hs",
    "penalizacion_cancelacion_mas24hs",
    "tope_saldo_deudor",
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
//
// "viajesCompletados"/"pasajerosTrasladados" cuentan SOLO reservas donde el conductor confirmó
// que el pasajero realmente viajó (asistio = 1) — no alcanza con "completada", porque una reserva
// también queda "completada" cuando el pasajero NO se presentó. "comisionFacturada" en cambio
// suma TODO lo pagado sin importar la asistencia: la comisión se cobra igual, haya viajado o no.
async function estadisticas(req, res) {
  const [viajesCompletados, pasajeros, comisiones, totalConductores, totalPasajeros, noShows, reembolsosPendientes] =
    await Promise.all([
      db.get(`SELECT COUNT(*) AS c FROM reservas WHERE estado = 'completada' AND asistio = 1`),
      db.get(`SELECT COALESCE(SUM(asientos_reservados), 0) AS c FROM reservas WHERE estado = 'completada' AND asistio = 1`),
      db.get(`SELECT COALESCE(SUM(comision_plataforma), 0) AS c FROM reservas WHERE pagado = 1`),
      db.get(`SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'conductor' AND estado_validacion = 'aprobado'`),
      db.get(`SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'pasajero' AND estado_validacion = 'aprobado'`),
      db.get(`SELECT COUNT(*) AS c FROM reservas WHERE asistio = 0`),
      db.get(
        `SELECT COUNT(*) AS c, COALESCE(SUM(comision_plataforma), 0) AS monto FROM reservas WHERE asistio = 0 AND (reembolso_manual_realizado IS NULL OR reembolso_manual_realizado = 0)`
      ),
    ]);
  ok(res, {
    viajesCompletados: Number(viajesCompletados.c),
    pasajerosTrasladados: Number(pasajeros.c),
    comisionFacturada: Number(comisiones.c),
    conductoresAprobados: Number(totalConductores.c),
    pasajerosAprobados: Number(totalPasajeros.c),
    noShows: Number(noShows.c),
    reembolsosPendientesCount: Number(reembolsosPendientes.c),
    reembolsosPendientesMonto: Number(reembolsosPendientes.monto),
  });
}

// Cola de reembolsos manuales: reservas donde el pasajero no viajó y todavía no se le hizo la
// devolución de la comisión a mano. Pensado para que el admin tenga toda la información junta
// (a quién, cuánto, a qué alias) sin tener que ir a buscarla al email o a la base a mano.
async function reembolsosPendientes(req, res) {
  const rows = await db.all(
    `SELECT r.id, r.comision_plataforma, r.asistio_reportado_at, r.reembolso_manual_realizado,
            v.origen_ciudad, v.destino_ciudad, v.fecha_salida, v.hora_salida,
            u.nombre AS pasajero_nombre, u.apellido AS pasajero_apellido, u.alias_cobro AS pasajero_alias, u.email AS pasajero_email
     FROM reservas r JOIN viajes v ON v.id = r.viaje_id JOIN usuarios u ON u.id = r.pasajero_id
     WHERE r.asistio = 0
     ORDER BY r.asistio_reportado_at DESC`
  );
  ok(res, rows.map((r) => boolFields(r, ["reembolso_manual_realizado"])));
}

async function marcarReembolsado(req, res, params) {
  const row = await db.get("SELECT * FROM reservas WHERE id = ?", [params.id]);
  if (!row) return notFound(res, "Reserva no encontrada");
  if (row.asistio !== 0) return badRequest(res, "Esta reserva no corresponde a una inasistencia.");
  await db.run("UPDATE reservas SET reembolso_manual_realizado = 1 WHERE id = ?", [params.id]);
  ok(res, { mensaje: "Marcado como reembolsado." });
}

// Cola de pagos de cuenta corriente declarados por conductores (deuda por cancelaciones con
// reservas ya pagadas) que todavía no confirmó el admin — mismo patrón que reembolsosPendientes:
// toda la info junta para no tener que ir a buscarla a la base a mano.
async function cuentaCorrientePendientes(req, res) {
  const rows = await db.all(
    `SELECT m.id, m.monto, m.comprobante, m.created_at, u.id AS conductor_id, u.nombre, u.apellido, u.saldo_deudor
     FROM movimientos_cuenta m JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.tipo = 'credito_pago' AND m.estado = 'pendiente_revision'
     ORDER BY m.created_at ASC`
  );
  ok(res, rows);
}

// El admin confirma que efectivamente recibió la transferencia declarada — recién acá se
// descuenta el saldo deudor del conductor (nunca antes, con solo la declaración del conductor).
async function confirmarPagoCuenta(req, res, params) {
  const mov = await db.get("SELECT * FROM movimientos_cuenta WHERE id = ?", [params.id]);
  if (!mov) return notFound(res, "Movimiento no encontrado");
  if (mov.tipo !== "credito_pago" || mov.estado !== "pendiente_revision") {
    return badRequest(res, "Este movimiento no es un pago pendiente de confirmar.");
  }
  await db.run("UPDATE movimientos_cuenta SET estado = 'confirmado', confirmado_at = ? WHERE id = ?", [nowIso(), params.id]);
  await db.run("UPDATE usuarios SET saldo_deudor = GREATEST(COALESCE(saldo_deudor, 0) - ?, 0) WHERE id = ?", [
    mov.monto,
    mov.usuario_id,
  ]);
  const actualizado = await db.get("SELECT saldo_deudor FROM usuarios WHERE id = ?", [mov.usuario_id]);
  ok(res, { mensaje: "Pago confirmado y descontado de la cuenta corriente.", saldoDeudor: Number(actualizado.saldo_deudor || 0) });
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
  if (!body.password || String(body.password).length < 9) {
    return badRequest(res, "La contraseña del admin debe tener al menos 9 caracteres.");
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

module.exports = {
  pendientes,
  listarUsuarios,
  validar,
  verConfig,
  actualizarConfig,
  estadisticas,
  reembolsosPendientes,
  marcarReembolsado,
  cuentaCorrientePendientes,
  confirmarPagoCuenta,
  seed,
  configurarAdmin,
};
