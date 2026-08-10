// api/helpers.js — utilidades comunes para las rutas de la API (versión Vercel).
"use strict";

const crypto = require("crypto");

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

function ok(res, data) {
  sendJson(res, 200, data);
}
function created(res, data) {
  sendJson(res, 201, data);
}
function badRequest(res, mensaje) {
  sendJson(res, 400, { error: mensaje });
}
function notFound(res, mensaje = "No encontrado") {
  sendJson(res, 404, { error: mensaje });
}
function forbidden(res, mensaje) {
  sendJson(res, 403, { error: mensaje });
}

// El runtime de funciones Node de Vercel ya parsea el body de JSON en `req.body`
// cuando el Content-Type es application/json. Si por algún motivo llega crudo
// (ej. corriendo con `vercel dev` en algunos casos, o sin header), lo leemos del stream.
function readBody(req) {
  if (req.body !== undefined) {
    if (typeof req.body === "string") {
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return Promise.resolve(req.body || {});
  }
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error("Cuerpo demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// Convierte un objeto "row" (con 0/1) a booleanos donde corresponda.
function boolFields(row, fields) {
  if (!row) return row;
  const copy = { ...row };
  fields.forEach((f) => {
    if (f in copy) copy[f] = !!copy[f];
  });
  return copy;
}

// Quita campos sensibles/administrativos antes de exponer un usuario por API pública.
function usuarioPublico(row) {
  if (!row) return row;
  const { password, intentos_fallidos, bloqueado_hasta, ...rest } = row;
  return boolFields(rest, ["pref_fuma", "pref_mascotas", "doc_vtv_declarada"]);
}

// --- Contraseñas -----------------------------------------------------------
// Hash con scrypt (nativo de Node, sin dependencias nuevas). Formato guardado: "salt:hashHex".
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  try {
    const hashBuffer = Buffer.from(hashHex, "hex");
    const testBuffer = crypto.scryptSync(String(password), salt, 64);
    if (hashBuffer.length !== testBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, testBuffer);
  } catch {
    return false;
  }
}

// --- Token de administrador --------------------------------------------------
// Firmado con HMAC-SHA256 usando ADMIN_SETUP_SECRET (la misma llave que ya protegía
// la creación de la cuenta admin — vive solo en Vercel, nunca en el código). El token
// es opaco (payload base64url + firma), no un JWT de librería, para no agregar
// dependencias nuevas. Se emite solo al hacer login con una cuenta rol="admin" y se
// vuelve a verificar contra la base en cada request (ver adminOnly() en [...path].js),
// así que revocar el acceso de un usuario (cambiarle el rol) invalida el token al instante
// aunque todavía no haya expirado.
const ADMIN_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

function signAdminToken(userId) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAdminToken(token) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret || !token || typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [payload, sig] = partes;
  if (!payload || !sig) return null;
  const esperado = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const espBuf = Buffer.from(esperado, "utf8");
  if (sigBuf.length !== espBuf.length || !crypto.timingSafeEqual(sigBuf, espBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.uid || !data.iat) return null;
    if (Date.now() - Number(data.iat) > ADMIN_TOKEN_MAX_AGE_MS) return null;
    return data.uid;
  } catch {
    return null;
  }
}

module.exports = {
  newId,
  nowIso,
  ok,
  created,
  badRequest,
  notFound,
  forbidden,
  sendJson,
  readBody,
  boolFields,
  usuarioPublico,
  hashPassword,
  verifyPassword,
  signAdminToken,
  verifyAdminToken,
};
