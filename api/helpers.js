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
  const { password, ...rest } = row;
  return boolFields(rest, ["pref_fuma", "pref_mascotas", "doc_vtv_declarada"]);
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
};
