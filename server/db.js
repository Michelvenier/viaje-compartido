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
const { DISTANCIAS_DEFAULT } = require("./corredor");

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
      doc_vtv TEXT,
      vtv_vencimiento TEXT,
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
    -- esto agrega las columnas nuevas sin borrar nada de lo que ya había.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS alias_cobro TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS doc_vtv TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS vtv_vencimiento TEXT;
    -- "reembolso_aplica" queda nulo hasta que la reserva se cancela; ahí se guarda si correspondía
    -- reembolso (según la regla de las 24 hs, o 1 siempre si canceló el conductor) o no.
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS reembolso_aplica INTEGER;
    -- "asistio" queda nulo hasta que el CONDUCTOR reporta si el pasajero viajó o no (ver
    -- api/routes/reservas.js reportarAsistencia) — null = todavía sin reportar, 1 = viajó,
    -- 0 = no se presentó. La comisión se cobra siempre al pagar, sin importar esto; si no viajó,
    -- el reembolso de la comisión lo procesa el admin a mano (ver reembolso_manual_realizado).
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS asistio INTEGER;
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS asistio_reportado_at TEXT;
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS reembolso_manual_realizado INTEGER DEFAULT 0;
    -- Contador de inasistencias del pasajero (reputación) — se ve tanto en el panel admin como en
    -- la solicitud que recibe cada conductor, para que decida con esa información.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0;
    -- Bloqueo por intentos de login fallidos (fuerza bruta) — aplica a toda cuenta, pero es
    -- la protección principal de la cuenta admin. Ver api/routes/usuarios.js login().
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TEXT;
    -- Cuenta corriente del conductor: se le debita una penalización cuando cancela un viaje que ya
    -- tenía reservas pagadas (porque la plataforma pierde la comisión de Mercado Pago al tener que
    -- reembolsar), y se le acredita cuando el admin confirma que pagó esa deuda a mano. Con más de
    -- $20.000 de saldo deudor no puede publicar viajes nuevos — ver server/routes/viajes.js.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS saldo_deudor NUMERIC DEFAULT 0;
    -- Suspensión de conductores por cancelar viajes seguidos (a pedido del usuario, 14 ago 2026): se
    -- calcula en vivo cuántos de los viajes MÁS RECIENTES de un conductor fueron cancelados sin
    -- interrupción (ver server/choferes.js) y, al llegar al umbral configurado, se lo suspende acá —
    -- bloquea publicar viajes nuevos hasta que el admin lo reactive a mano desde el panel.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido_motivo TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido_at TEXT;
    -- Pago de la comisión con comprobante + confirmación del admin (a pedido del usuario, 19 ago
    -- 2026): el pasajero ya no queda "pagado" apenas hace clic — declara el pago adjuntando un
    -- comprobante (queda acá, igual que movimientos_cuenta.comprobante: por ahora solo el nombre
    -- del archivo) y "pagado" pasa a 1 recién cuando el admin lo confirma desde el panel. Mientras
    -- una reserva aceptada no está pagada, es "deuda" del pasajero — ver server/routes/reservas.js
    -- crear() (bloquea reservas nuevas) y server/routes/admin.js (cola de confirmación).
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS comprobante_pago TEXT;

    CREATE TABLE IF NOT EXISTS movimientos_cuenta (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id),
      tipo TEXT NOT NULL CHECK (tipo IN ('debito_cancelacion', 'credito_pago')),
      monto NUMERIC NOT NULL,
      motivo TEXT,
      viaje_id TEXT REFERENCES viajes(id),
      comprobante TEXT,
      estado TEXT NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'pendiente_revision', 'rechazado')),
      created_at TEXT NOT NULL,
      confirmado_at TEXT
    );

    -- Cache de distancias consultadas a Google Maps (server/maps.js) para pares de ciudades que no
    -- son "La Plata ↔ X" (esos siguen la tabla curada a mano de arriba). ciudad_a/ciudad_b siempre
    -- se guardan en orden alfabético para que "Tandil,Bolívar" y "Bolívar,Tandil" compartan la misma
    -- fila y no se pague dos veces la misma consulta. Sin fecha de vencimiento: la distancia entre
    -- dos ciudades no cambia, así que el cache no necesita refrescarse.
    CREATE TABLE IF NOT EXISTS distancias_cache (
      ciudad_a TEXT NOT NULL,
      ciudad_b TEXT NOT NULL,
      km NUMERIC NOT NULL,
      fuente TEXT NOT NULL DEFAULT 'google_maps',
      created_at TEXT NOT NULL,
      PRIMARY KEY (ciudad_a, ciudad_b)
    );
  `);

  const defaults = [
    ["precio_nafta_super", "1450"],
    ["peaje_default_ruta5_226", "3200"],
    ["comision_plataforma_pct", "10"],
    ["comision_minima", "2000"],
    ["consumo_litros_100km", "10"],
    ["tolerancia_ajuste_pct", "15"],
    // Piso mínimo de precio por asiento: nunca menos de $12.000 (tarifa mínima para trayectos
    // cortos, hasta ~230 km) ni menos de $52 por km recorrido — 500 km da exactamente $26.000.
    // Se aplica el mayor entre el piso y el cálculo por costo real (nafta + peajes / asientos).
    ["precio_minimo_por_km", "52"],
    ["precio_minimo_base", "12000"],
    // Distancia y peaje estimados de La Plata a cada ciudad del corredor (ver api/corredor.js).
    // Guardado como JSON en un solo registro de config; editable desde el panel de admin.
    ["distancias_corredor", JSON.stringify(DISTANCIAS_DEFAULT)],
    // Penalización a la cuenta corriente del conductor cuando cancela un viaje con reservas ya
    // pagadas (compensa la comisión de Mercado Pago que se pierde al reembolsar). Dos montos según
    // el aviso: menos de 24 hs antes de la salida, o 24 hs o más. Editable desde el panel de admin.
    ["penalizacion_cancelacion_menos24hs", "3000"],
    ["penalizacion_cancelacion_mas24hs", "1000"],
    // Tope de saldo deudor: por encima de este monto, el conductor no puede publicar viajes nuevos
    // hasta que el admin le confirme que pagó la deuda. Editable desde el panel de admin.
    ["tope_saldo_deudor", "20000"],
    // Peaje ESTIMADO por km para pares de ciudades que no son "La Plata ↔ X" (esos usan el peaje
    // curado a mano de distancias_corredor) — Google Maps no informa costo de peajes, así que se
    // estima como km × este valor. Sacado del promedio aproximado de la tabla curada de arriba
    // (ronda entre $8 y $12 por km según la ruta). Editable desde el panel de admin.
    ["peaje_por_km_estimado", "9"],
    // Cancelaciones consecutivas de un conductor (viajes publicados que canceló uno atrás del otro,
    // sin ninguno completado/activo en el medio): a partir de este número se le muestra una alerta
    // al admin en el panel; al llegar al de suspensión, se lo suspende automáticamente (no puede
    // publicar viajes nuevos hasta que el admin lo reactive a mano). Editable desde el panel admin.
    ["alerta_cancelaciones_consecutivas", "2"],
    ["suspension_cancelaciones_consecutivas", "3"],
  ];
  for (const [clave, valor] of defaults) {
    await run(`INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO NOTHING`, [clave, valor]);
  }
}

module.exports = { prepare, run, get, all, exec, initSchema, getPool };
