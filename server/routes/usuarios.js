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
    // Fix (08 sep 2026, a pedido explícito del usuario: "hace que lo acepten sí o sí o si no que no
    // se puedan y que se guarde esto") — el checkbox del wizard ("Leí y acepto los Términos y
    // Condiciones...") antes solo se validaba en el cliente (js/views.js validarPaso()), así que
    // llamando directo a este endpoint (sin pasar por el wizard) se podía crear una cuenta sin
    // haberlo aceptado nunca. Ahora el servidor lo exige también, y lo que se guarda más abajo
    // (acepta_terminos/acepta_terminos_at) es la única constancia real de la aceptación.
    if (!body.acepta_reglas) {
      return badRequest(res, "Tenés que aceptar los Términos y Condiciones, las Reglas de la Ruta y la Política de Privacidad para registrarte.");
    }

    if (rol === "conductor") {
      if (!body.doc_licencia_frente || !body.doc_licencia_dorso) {
        return badRequest(res, "Falta la foto de la licencia de conducir (frente y dorso).");
      }
      // Simplificado (16 sep 2026, a pedido explícito del usuario: "al conductor solo le pedimos a
      // la hora de inscribirse, dni, licencia de conducir y foto, nada mas") — ya NO se pide subir
      // cédula del auto, póliza de seguro ni oblea/constancia de VTV. En su lugar, el conductor
      // declara con este checkbox que tiene el seguro y la VTV vigentes y al día — ver la migración
      // correspondiente en server/db.js para el detalle completo de la decisión.
      if (!body.declara_seguro_vtv_al_dia) {
        return badRequest(res, "Tenés que declarar que tenés el seguro del vehículo y la VTV vigentes y al día para poder publicar viajes.");
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
        id, rol, nombre, apellido, edad, dni, telefono, email, domicilio, foto_perfil, bio, genero,
        pref_fuma, pref_mascotas, pref_musica, pref_charla, pref_equipaje, estado_validacion,
        doc_dni_frente, doc_dni_dorso, doc_selfie,
        doc_licencia_frente, doc_licencia_dorso, doc_cedula_frente, doc_cedula_dorso,
        doc_seguro, doc_vtv_declarada,
        doc_vtv, vtv_vencimiento,
        vehiculo_marca, vehiculo_modelo, vehiculo_color, vehiculo_patente, vehiculo_foto, vehiculo_asientos,
        alias_cobro, password, created_at, acepta_terminos, acepta_terminos_at,
        declara_seguro_vtv_al_dia, declara_seguro_vtv_al_dia_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
        // Género: OPCIONAL (24 ago 2026, a pedido del usuario) — si no lo completa, queda null y
        // simplemente no se muestra en ningún lado (ver comentario en server/db.js).
        body.genero || null,
        body.pref_fuma ? 1 : 0,
        body.pref_mascotas ? 1 : 0,
        body.pref_musica || "indistinto",
        body.pref_charla || "indistinto",
        body.pref_equipaje || null,
        // Desde el 07 sep 2026, a pedido explícito del usuario ("Quiero que EL ROL DE PASAJERO SE
        // AUTORICE SOLO, CON LAS FOTOS QUE SUBA el pasajero, despues que la informacion se guarde
        // como siempre"): un pasajero queda 'aprobado' automáticamente apenas se guarda su
        // registro con las fotos (DNI frente/dorso + selfie) — sin esperar revisión manual del
        // admin. El conductor SIGUE necesitando la revisión manual de siempre (identidad +
        // licencia/cédula/seguro/VTV/auto), por el riesgo mayor de manejar pasajeros.
        rol === "pasajero" ? "aprobado" : "pendiente",
        body.doc_dni_frente,
        body.doc_dni_dorso,
        body.doc_selfie,
        body.doc_licencia_frente || null,
        body.doc_licencia_dorso || null,
        // Cédula/seguro/VTV como documento ya NO se piden de acá en adelante (16 sep 2026, ver
        // arriba y server/db.js) — quedan NULL en toda cuenta nueva; se reemplazan por el checkbox
        // declara_seguro_vtv_al_dia, al final de esta lista.
        null,
        null,
        null,
        0,
        null,
        null,
        body.vehiculo_marca || null,
        body.vehiculo_modelo || null,
        body.vehiculo_color || null,
        body.vehiculo_patente || null,
        body.vehiculo_foto || null,
        body.vehiculo_asientos || 3,
        body.alias_cobro || null,
        hashPassword(body.password),
        nowIso(),
        // acepta_terminos siempre 1 acá — si `body.acepta_reglas` no vino en true, ya se rechazó el
        // alta más arriba con badRequest() y nunca se llega a este INSERT.
        1,
        nowIso(),
        // declara_seguro_vtv_al_dia: 1 solo para conductor (ya validado arriba, obligatorio); un
        // pasajero no tiene auto, así que esto no aplica y queda en 0/null.
        rol === "conductor" ? 1 : 0,
        rol === "conductor" ? nowIso() : null,
      ]
    );

    const row = await db.get("SELECT * FROM usuarios WHERE id = ?", [id]);
    created(res, {
      usuario: usuarioPublico(row),
      mensaje:
        rol === "pasajero"
          ? "¡Listo! Tu perfil de pasajero ya está aprobado con las fotos que subiste — ya podés buscar y reservar viajes."
          : "¡Listo! Revisamos manualmente la documentación de cada perfil antes de habilitarlo. Te avisamos por WhatsApp en menos de 24 hs.",
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
    // Género (24 ago 2026): opcional, editable en cualquier momento desde "Mi perfil" — se puede
    // completar, cambiar, o volver a dejar vacío mandando "" (ver render en js/views.js).
    "genero",
    "pref_fuma",
    "pref_mascotas",
    "pref_musica",
    "pref_charla",
    "pref_equipaje",
    "domicilio",
    "telefono",
    // Email (07 sep 2026, a pedido explícito del usuario: "Quiero que todos los usuarios puedan
    // modificar sus datos de contacto") — antes no se podía cambiar nunca después del registro.
    // Tiene manejo aparte más abajo porque hay que revalidar que no choque con otra cuenta (la
    // columna es UNIQUE) antes de guardarlo.
    "email",
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
    if (c === "email") {
      if (!body.email) return badRequest(res, "El email no puede quedar vacío.");
      const otroConEseEmail = await db.get("SELECT id FROM usuarios WHERE email = ? AND id != ?", [body.email, params.id]);
      if (otroConEseEmail) return badRequest(res, "Ya existe otra cuenta registrada con ese email.");
      sets.push(`${c} = ?`);
      values.push(body.email);
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

// Rol dual (07 sep 2026, a pedido explícito del usuario: "que puedan ser conductores y
// pasajeros") — una cuenta que se registró como pasajero carga acá la documentación de conductor
// (licencia, cédula, seguro, VTV, auto) para poder publicar viajes también, sin tener que crear una
// cuenta nueva. Mismos requisitos y mismas validaciones que en registrar("conductor"). Queda
// "pendiente" de revisión manual — ver server/routes/admin.js validarConductor() — hasta que el
// admin la aprueba, momento en el que recién se habilita es_conductor.
async function solicitarConductor(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const row = await db.get("SELECT * FROM usuarios WHERE id = ?", [params.id]);
  if (!row) return notFound(res, "Usuario no encontrado");
  if (row.rol === "admin") return badRequest(res, "Una cuenta de administrador no puede publicar viajes.");
  if (row.es_conductor) return badRequest(res, "Esta cuenta ya puede publicar viajes.");
  if (row.conductor_estado_validacion === "pendiente") {
    return badRequest(res, "Ya tenés una solicitud en revisión — te avisamos por WhatsApp en menos de 24 hs.");
  }

  if (!body.doc_licencia_frente || !body.doc_licencia_dorso) {
    return badRequest(res, "Falta la foto de la licencia de conducir (frente y dorso).");
  }
  // Simplificado (16 sep 2026, mismo cambio y mismo motivo que registrar("conductor") más arriba) —
  // ya NO se pide cédula/seguro/VTV como documento, se pide esta declaración en su lugar.
  if (!body.declara_seguro_vtv_al_dia) {
    return badRequest(res, "Tenés que declarar que tenés el seguro del vehículo y la VTV vigentes y al día para poder publicar viajes.");
  }
  if (!body.vehiculo_marca || !body.vehiculo_modelo || !body.vehiculo_patente) {
    return badRequest(res, "Completá marca, modelo y patente de tu vehículo.");
  }

  await db.run(
    `UPDATE usuarios SET
       doc_licencia_frente = ?, doc_licencia_dorso = ?,
       vehiculo_marca = ?, vehiculo_modelo = ?, vehiculo_color = ?, vehiculo_patente = ?,
       vehiculo_foto = ?, vehiculo_asientos = ?,
       declara_seguro_vtv_al_dia = 1, declara_seguro_vtv_al_dia_at = ?,
       conductor_estado_validacion = 'pendiente', conductor_motivo_rechazo = NULL, conductor_solicitado_at = ?
     WHERE id = ?`,
    [
      body.doc_licencia_frente,
      body.doc_licencia_dorso,
      body.vehiculo_marca,
      body.vehiculo_modelo,
      body.vehiculo_color || null,
      body.vehiculo_patente,
      body.vehiculo_foto || null,
      body.vehiculo_asientos || 3,
      nowIso(),
      nowIso(),
      params.id,
    ]
  );

  const actualizado = await db.get("SELECT * FROM usuarios WHERE id = ?", [params.id]);
  created(res, {
    usuario: usuarioPublico(actualizado),
    mensaje:
      "¡Listo! Revisamos manualmente tu documentación de conductor antes de habilitarte a publicar viajes. Te avisamos por WhatsApp en menos de 24 hs.",
  });
}

module.exports = { registrar, obtener, actualizar, login, verCuentaCorriente, declararPagoCuenta, solicitarConductor };
