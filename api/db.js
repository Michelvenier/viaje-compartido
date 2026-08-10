// api/db.js — Capa de datos para el despliegue en Vercel, usando Postgres (pg)
// en vez de node:sqlite (que no persiste en funciones serverless).
//
// Expone la misma API de "prepare(sql).get/.all/.run(...params)" que usaba la
// versión local con node:sqlite, para minimizar cambios en las rutas: internamente
// traduce los placeholders "?" de SQLite a "$1, $2, ..." de Postgres y ejecuta
// la consulta contra un Pool reutilizado entre invocaciones (mientras la instancia
// de la función esté "caliente").
"use strict";

const { Pool } = require("pg");

let _pool = null;
function getPool() {
  if (!_pool) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
    if (!connectionString) {
      throw new Error(
        "No se encontró la variable de entorno POSTGRES_URL / DATABASE_URL. Agregá una base Postgres desde el panel de Vercel (Storage → Postgres) y volvé a desplegar."
      );
    }
    _pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return _pool;
}

// Convierte "SELECT * FROM t WHERE a = ? AND b = ?" -> "... WHERE a = $1 AND b = $2"
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function run(sql, params = []) {
  const res = await getPool().query(toPgSql(sql), params);
  return { changes: res.rowCount, rows: res.rows };
}
async function get(sql, params = []) {
  const res = await getPool().query(toPgSql(sql), params);
  return res.rows[0];
}
async function all(sql, params = []) {
  const res = await getPool().query(toPgSql(sql), params);
  return res.rows;
}

// Shim de compatibilidad: mismo estilo de llamada que la versión con node:sqlite,
// pero ahora devuelve Promesas (hay que usar `await` en cada llamada).
function prepare(sql) {
  return {
    get: (...params) => get(sql, params),
    all: (...params) => all(sql, params),
    run: (...params) => run(sql, params),
  };
}

async function exec(sql) {
  await getPool().query(sql);
}

async function initSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      rol TEXT NOT NULL CHECK (rol IN ('conductor','pasajero','admin')),
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      edad INTEGER,
      dni TEXT,
      telefono TEXT,
      email TEXT UNIQUE,
      domicilio TEXT,
      foto_perfil TEXT,
      bio TEXT,
      pref_fuma INTEGER DEFAULT 0,
      pref_mascotas INTEGER DEFAULT 0,
      pref_musica TEXT,
      pref_charla TEXT,
      pref_equipaje TEXT,
      estado_validacion TEXT DEFAULT 'pendiente' CHECK (estado_validacion IN ('pendiente','aprobado','rechazado')),
      motivo_rechazo TEXT,
      doc_dni_frente TEXT,
      doc_dni_dorso TEXT,
      doc_selfie TEXT,
      doc_licencia TEXT,
      doc_cedula TEXT,
      doc_seguro TEXT,
      doc_vtv_declarada INTEGER DEFAULT 0,
      vehiculo_marca TEXT,
      vehiculo_modelo TEXT,
      vehiculo_color TEXT,
      vehiculo_patente TEXT,
      vehiculo_foto TEXT,
      vehiculo_asientos INTEGER DEFAULT 3,
      alias_cobro TEXT,
      rating_promedio REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      password TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS viajes (
      id TEXT PRIMARY KEY,
      conductor_id TEXT NOT NULL REFERENCES usuarios(id),
      origen_direccion TEXT NOT NULL,
      origen_ciudad TEXT NOT NULL,
      destino_ciudad TEXT NOT NULL,
      ciudades_intermedias TEXT DEFAULT '[]',
      fecha_salida TEXT NOT NULL,
      hora_salida TEXT NOT NULL,
      hora_llegada_estimada TEXT,
      distancia_km REAL NOT NULL,
      peajes_estimados REAL NOT NULL DEFAULT 0,
      precio_nafta_usado REAL NOT NULL,
      litros_estimados REAL NOT NULL,
      costo_combustible REAL NOT NULL,
      cto_total REAL NOT NULL,
      divisor_precio INTEGER NOT NULL,
      precio_sugerido REAL NOT NULL,
      precio_por_asiento REAL NOT NULL,
      asientos_totales INTEGER NOT NULL,
      asientos_disponibles INTEGER NOT NULL,
      permite_mascotas INTEGER DEFAULT 0,
      permite_equipaje_grande INTEGER DEFAULT 0,
      permite_fumar INTEGER DEFAULT 0,
      pref_charla TEXT DEFAULT 'indistinto',
      pref_musica TEXT DEFAULT 'indistinto',
      estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','completado','cancelado')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      viaje_id TEXT NOT NULL REFERENCES viajes(id),
      pasajero_id TEXT NOT NULL REFERENCES usuarios(id),
      asientos_reservados INTEGER NOT NULL DEFAULT 1,
      estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada','completada')),
      monto_total REAL NOT NULL,
      comision_plataforma REAL NOT NULL,
      monto_conductor REAL NOT NULL,
      pagado INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      actualizado_at TEXT
    );

    CREATE TABLE IF NOT EXISTS calificaciones (
      id TEXT PRIMARY KEY,
      reserva_id TEXT NOT NULL REFERENCES reservas(id),
      autor_id TEXT NOT NULL REFERENCES usuarios(id),
      destinatario_id TEXT NOT NULL REFERENCES usuarios(id),
      puntuacion INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
      manejo INTEGER,
      comodidad INTEGER,
      comentario TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    -- Migración: si la tabla usuarios ya existía de antes (creada con un esquema viejo),
    -- esto agrega la columna nueva sin borrar nada de lo que ya había.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS alias_cobro TEXT;
  `);

  const defaults = [
    ["precio_nafta_super", "1450"],
    ["peaje_default_ruta5_226", "3200"],
    ["comision_plataforma_pct", "10"],
    ["comision_minima", "2000"],
    ["consumo_litros_100km", "10"],
    ["tolerancia_ajuste_pct", "15"],
  ];
  for (const [clave, valor] of defaults) {
    await run(`INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO NOTHING`, [clave, valor]);
  }
}

module.exports = { prepare, run, get, all, exec, initSchema, getPool };
