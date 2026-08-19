// api/routes/usuarios.js — Registro y gestión de perfiles (versión async/Postgres).
"use strict";

const db = require("../db");
const {
  newId,
  nowIso,
  ok,
  created,
  badRequest,
  notFound,
  forbidden,
  readBody,
  usuarioPublico,
  hashPassword,
  verifyPassword,
  signAdminToken,
} = require("../helpers");

// Bloqueo por fuerza bruta: después de MAX_INTENTOS intentos fallidos consecutivos,
// la cuenta queda bloqueada por BLOQUEO_MINUTOS, sin importar si la contraseña que
// llega después es correcta. Protege sobre todo a la cuenta admin (email conocido,
// así que es el blanco más obvio para probar contraseñas).
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

function registrar(rol) {
  return async (req, res) => {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return badRequest(res, "JSON inválido");
    }

    if (!body.nombre || !body.apellido) {
      return badRequest(res, "Nombre y apellido son obligatorios (como figuran en el DNI).");
    }
    if (!body.dni) return badRequest(res, "El DNI es obligatorio para validar tu identidad.");
    if (!body.doc_dni_frente || !body.doc_dni_dorso) {
      return badRequest(res, "Subí la foto de tu DNI (frente y dorso).");
    }
    if (!body.doc_selfie) {
      return badRequest(res, "Subí la selfie de validación sosteniendo tu DNI al lado de tu cara.");
    }
    if (!body.telefono) return badRequest(res, "El celular es obligatorio para validar por WhatsApp.");
    if (!body.email) return badRequest(res, "El correo electrónico es obligatorio.");
    if (!body.password || String(body.password).length < 8) {
      return badRequest(res, "Elegí una contraseña de al menos 8 caracteres.");
    }

    if (rol === "conductor") {
      if (!body.doc_licencia) return badRequest(res, "Falta la foto de la licencia de conducir.");
      if (!body.doc_cedula) return badRequest(res, "Falta la foto de la cédula verde/azul.");
      if (!body.doc_seguro) return badRequest(res, "Falta la foto/captura de la póliza de seguro vigente.");
      if (!body.doc_vtv) {
        return badRequest(res, "Falta la foto de la oblea o constancia de VTV vigente.");
      }
      if (!body.vtv_vencimiento) {
        return badRequest(res, "Indicá la fecha de vencimiento de tu VTV.");
      }
      if (new Date(body.vtv_vencimiento) < new Date(new Date().toDateString())) {
        return badRequest(res, "La fecha de vencimiento de tu VTV ya pasó. Actualizala antes de registrarte como conductor.");
      }
      if (!body.vehiculo_marca || !body.vehiculo_modelo || !body.vehiculo_patente) {
        return badRequest(res, "Completá marca, modelo y patente de tu vehículo.");
      }
      // Ya NO se pide alias de Mercado Pago/CBU al conductor (a pedido del usuario, 14 ago 2026): el
      // pasajero coordina el pago de su parte directamente con el conductor al momento de viajar, sin
      // que la plataforma tenga que guardar ni mostrar un dato de cobro. El campo alias_cobro sigue
      // existiendo en la base (lo sigue usando el pasajero, opcional, solo para reembolsos) y un
      // conductor viejo que ya lo había cargado no lo pierde, pero ya no se exige ni se muestra.
    }

    const existente = await db.get("SELECT id FROM usuarios WHERE email = ?", [body.email]);
    if (existente) return badRequest(res, "Ya existe una cuenta registrada con ese email.");

    const id = newId("usr");
    await db.run(
      `INSERT INTO usuarios (
        id, rol, nombre, apellido, edad, dni, telefono, email, domicilio, foto_perfil, bio,
        pref_fuma, pref_mascotas, pref_musica, pref_charla, pref_equipaje, estado_validacion,
        doc_dni_frente, doc_dni_dorso, doc_selfie, doc_licencia, doc_cedula, doc_seguro, doc_vtv_declarada,
        doc_vtv, vtv_vencimiento,
        vehiculo_marca, vehiculo_modelo, vehiculo_color, vehiculo_patente, vehiculo_foto, vehiculo_asientos,
        alias_cobro, password, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        rol,
        body.nombre,
        body.apellido,
        body.edad || null,
        body.dni,
        body.telefono,
        body.email,
        body.domicilio || null,
        body.foto_perfil || null,
        body.bio || null,
        body.pref_fuma ? 1 : 0,
        body.pref_mascotas ? 1 : 0,
        body.pref_musica || "indistinto",
        body.pref_charla || "indistinto",
        body.pref_equipaje || null,
        "pendiente",
        body.doc_dni_frente,
        body.doc_dni_dorso,
        body.doc_selfie,
        body.doc_licencia || null,
        body.doc_cedula || null,
        body.doc_seguro || null,
        body.doc_vtv ? 1 : 0,
        body.doc_vtv || null,
        body.vtv_vencimiento || null,
        body.vehiculo_marca || null,
        body.vehiculo_modelo || null,
        body.vehiculo_color || null,
        body.vehiculo_patente || null,
        body.vehiculo_foto || null,
        body.vehiculo_asientos || 3,
        body.alias_cobro || null,
        hashPassword(body.password),
        nowIso(),
      ]
    );

    const row = await db.get("SELECT * FROM usuarios WHERE id = ?", [id]);
    created(res, {
      usuario: usuarioPublico(row),
      mensaje:
        "¡Listo! Revisamos manualmente la documentación de cada perfil antes de habilitarlo. Te avisamos por WhatsApp en menos de 24 hs.",
    });
  };
}

async function obtener(req, res, params) {
  const row = await db.get("SELECT * FROM usuarios WHERE id = ?", [params.id]);
  if (!row) return notFound(res, "Usuario no encontrado");
  ok(res, usuarioPublico(row));
}

async function actualizar(req, res, params) {
  const row = await db.get("SELECT * FROM usuarios WHERE id = ?", [params.id]);
  if (!row) return notFound(res, "Usuario no encontrado");
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const campos = [
    "bio",
    "foto_perfil",
    "pref_fuma",
    "pref_mascotas",
    "pref_musica",
    "pref_charla",
    "pref_equipaje",
    "domicilio",
    "telefono",
    "vehiculo_asientos",
    // A pedido del usuario (19 ago 2026: "por si el chofer publica en uno y viaja en otro"): antes
    // estos 5 campos solo se cargaban una vez, en el paso 3 del registro, y no había forma de
    // corregirlos después — si un conductor cambiaba de auto (o tenía más de uno), el pasajero
    // seguía viendo el auto viejo para siempre. Ahora se pueden actualizar desde "Mi perfil".
    "vehiculo_marca",
    "vehiculo_modelo",
    "vehiculo_color",
    "vehiculo_patente",
    "vehiculo_foto",
    "alias_cobro",
    "password",
  ];
  const sets = [];
  const values = [];
  for (const c of campos) {
    if (!(c in body)) continue;
    if (c === "password") {
      if (!body.password || String(body.password).length < 8) {
        return badRequest(res, "La nueva contraseña debe tener al menos 8 caracteres.");
      }
      sets.push(`${c} = ?`);
      values.push(hashPassword(body.password));
      continue;
    }
    sets.push(`${c} = ?`);
    values.push(typeof body[c] === "boolean" ? (body[c] ? 1 : 0) : body[c]);
  }
  if (sets.length === 0) return badRequest(res, "Nada para actualizar");
  values.push(params.id);
  await db.run(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = ?`, values);
  const actualizado = await db.get("SELECT * FROM usuarios WHERE id = ?", [params.id]);
  ok(res, usuarioPublico(actualizado));
}

async function login(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!body.email) return badRequest(res, "Ingresá tu email");
  if (!body.password) return badRequest(res, "Ingresá tu contraseña");

  const row = await db.get("SELECT * FROM usuarios WHERE email = ?", [body.email]);
  if (!row) return notFound(res, "No encontramos una cuenta con ese email");

  if (row.bloqueado_hasta && new Date(row.bloqueado_hasta) > new Date()) {
    return forbidden(
      res,
      `Demasiados intentos fallidos. Esta cuenta queda bloqueada por seguridad hasta las ${new Date(
        row.bloqueado_hasta
      ).toLocaleTimeString("es-AR")}.`
    );
  }

  if (!row.password) {
    // Cuenta creada antes de exigir contraseña (dato viejo). La cuenta admin NUNCA se
    // "reclama" así — solo se configura vía /api/admin/configurar-admin con el secret del
    // servidor — para que nadie pueda convertirse en admin sabiendo solo el email.
    if (row.rol === "admin") {
      return forbidden(
        res,
        "La cuenta de administrador todavía no tiene una contraseña configurada. Pedile al equipo técnico que la configure."
      );
    }
    if (String(body.password).length < 8) {
      return badRequest(res, "Como es tu primer ingreso con este email, elegí una contraseña de al menos 8 caracteres.");
    }
    await db.run("UPDATE usuarios SET password = ? WHERE id = ?", [hashPassword(body.password), row.id]);
    return ok(res, usuarioPublico(row));
  }

  if (!verifyPassword(body.password, row.password)) {
    const intentos = Number(row.intentos_fallidos || 0) + 1;
    const bloqueaAhora = intentos >= MAX_INTENTOS;
    await db.run("UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?", [
      bloqueaAhora ? 0 : intentos,
      bloqueaAhora ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000).toISOString() : null,
      row.id,
    ]);
    if (bloqueaAhora) {
      return forbidden(
        res,
        `Demasiados intentos fallidos. Por seguridad, esta cuenta queda bloqueada por ${BLOQUEO_MINUTOS} minutos.`
      );
    }
    return badRequest(res, "Contraseña incorrecta.");
  }

  // Login correcto: reseteamos el contador de intentos fallidos.
  if (row.intentos_fallidos || row.bloqueado_hasta) {
    await db.run("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?", [row.id]);
  }

  const usuario = usuarioPublico(row);
  if (row.rol === "admin") {
    const token = signAdminToken(row.id);
    if (token) usuario.adminToken = token;
  }
  ok(res, usuario);
}

// Cuenta corriente del conductor: saldo deudor + historial completo de movimientos (débitos por
// cancelación, créditos por pagos ya confirmados por el admin, y pagos declarados por el conductor
// que todavía están pendientes de que el admin confirme que los recibió). Ver
// server/routes/viajes.js (registrarPenalizacionPorCancelacion) y server/routes/admin.js
// (confirmarPagoCuenta) para el resto del flujo.
async function verCuentaCorriente(req, res, params) {
  const usuario = await db.get("SELECT id, rol, saldo_deudor FROM usuarios WHERE id = ?", [params.id]);
  if (!usuario) return notFound(res, "Usuario no encontrado");
  const movimientos = await db.all(
    "SELECT * FROM movimientos_cuenta WHERE usuario_id = ? ORDER BY created_at DESC",
    [params.id]
  );
  ok(res, { saldoDeudor: Number(usuario.saldo_deudor || 0), movimientos });
}

// El conductor declara que ya transfirió el pago de su deuda, adjuntando un comprobante — esto NO
// descuenta el saldo todavía (queda "pendiente_revision"): el admin tiene que confirmar que
// efectivamente lo recibió, igual que con los reembolsos manuales a pasajeros. Así no alcanza con
// que alguien diga "ya pagué" para desbloquear la cuenta.
async function declararPagoCuenta(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const usuario = await db.get("SELECT id FROM usuarios WHERE id = ?", [params.id]);
  if (!usuario) return notFound(res, "Usuario no encontrado");
  if (!body.monto || Number(body.monto) <= 0) return badRequest(res, "Indicá el monto que pagaste.");
  if (!body.comprobante) return badRequest(res, "Subí el comprobante de la transferencia.");

  const id = newId("mov");
  await db.run(
    `INSERT INTO movimientos_cuenta (id, usuario_id, tipo, monto, motivo, comprobante, estado, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, params.id, "credito_pago", Number(body.monto), "Pago declarado por el conductor.", body.comprobante, "pendiente_revision", nowIso()]
  );
  const row = await db.get("SELECT * FROM movimientos_cuenta WHERE id = ?", [id]);
  created(res, {
    movimiento: row,
    mensaje: "Pago informado. Queda pendiente de que el equipo de Ruta Compartida confirme que lo recibió.",
  });
}

module.exports = { registrar, obtener, actualizar, login, verCuentaCorriente, declararPagoCuenta };
