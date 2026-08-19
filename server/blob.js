// server/blob.js — almacenamiento REAL de archivos (fotos de DNI, selfie, licencia, seguro, VTV,
// comprobantes de pago) con Vercel Blob (a pedido del usuario, 19 ago 2026: "arreglá que las fotos
// se guarden de verdad, no solo el nombre del archivo").
//
// Antes, todos los campos de "subir documento" solo guardaban `input.files[0].name` (el nombre del
// archivo elegido) en columnas de texto — nunca los bytes reales. Ahora esas mismas columnas de
// texto (usuarios.doc_dni_frente, movimientos_cuenta.comprobante, reservas.comprobante_pago, etc.)
// guardan el "pathname" que devuelve Vercel Blob al subir el archivo — sin ningún cambio de
// esquema, porque ya eran TEXT. `js/components.js` (wireUploads) es quien sube el archivo de
// verdad a este endpoint y guarda ese pathname en el campo oculto del formulario.
//
// Por qué esto y no el flujo de "client upload directo a Vercel Blob" que recomienda la
// documentación oficial: ese flujo requiere cargar el paquete `@vercel/blob/client` en el
// NAVEGADOR, y ese build está pensado para correr con un bundler (usa `crypto`/`undici` de Node
// por dentro) — este proyecto no tiene build step (a propósito, ver README). Para no depender de
// que un CDN externo logre "polyfillear" ese paquete en el navegador (frágil e imposible de probar
// sin acceso al deploy real), el archivo se sube primero al navegador (comprimido, ver
// js/components.js), se manda como bytes crudos a ESTE endpoint, y ACÁ en el servidor (Node, donde
// `@vercel/blob` sí corre nativo sin problema) se lo pasa a Vercel Blob con `put()`. Esto sí tiene
// el límite de 4.5 MB por request que tiene cualquier función de Vercel (plan Hobby) — por eso el
// navegador comprime la imagen antes de mandarla (ver comprimirImagen en js/components.js), para
// que ninguna foto real de un DNI/selfie/comprobante se acerque a ese límite.
"use strict";

const { put, get } = require("@vercel/blob");
const { Readable } = require("node:stream");
const { newId, ok, badRequest, notFound } = require("./helpers");

// Solo imágenes — es lo único que suben los formularios de esta app (`accept="image/*"` en
// js/components.js renderUploadField). Nada de PDFs ni otros tipos, para no tener que sanitizar
// contenido arbitrario.
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
// Tope generoso pensado como red de seguridad, no como límite normal: con la compresión del lado
// del cliente (máx. ~1600px, calidad ~0.82) una foto real pesa unos cientos de KB. Si por algún
// motivo la compresión falla y se sube el archivo original sin comprimir, 8 MB todavía entra
// cómodo dentro del límite de 4.5 MB... en realidad NO entra (8 MB > 4.5 MB) — el request se
// cortaría solo antes de llegar acá. Este chequeo es la segunda barrera, por si el límite de la
// plataforma cambiara o el archivo llegara por otra vía.
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSION_POR_TIPO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };

// El runtime de Vercel ya deja el body crudo en `req.body` como Buffer cuando el Content-Type no es
// uno de los que auto-parsea a objeto/texto (json, form-urlencoded, texto plano) — que es
// exactamente lo que mandamos acá (ver js/components.js: Content-Type: application/octet-stream).
// Igual se deja el fallback de leer el stream a mano, mismo patrón defensivo que ya usa
// helpers.js readBody() para JSON.
function leerBufferCrudo(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BYTES + 1024 * 1024) {
        reject(new Error("Archivo demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// POST /api/upload — sube un archivo (foto de documento o comprobante) y devuelve el "pathname"
// de Vercel Blob para guardar en el campo correspondiente. A propósito SIN adminOnly ni ningún
// otro chequeo de sesión: igual que el resto de esta app (que no tiene sesiones de
// pasajero/conductor, solo de admin), cualquiera puede subir un archivo acá — es el mismo nivel de
// confianza que ya tiene, por ejemplo, `PATCH /api/usuarios/:id`. Lo que sí se valida es que sea
// una imagen y que no sea gigante. Los archivos se guardan como PRIVADOS (no públicos): nadie puede
// verlos con solo la URL, hace falta pasar por `verDocumento()` (abajo) con sesión de admin.
async function subir(req, res) {
  let buffer;
  try {
    buffer = await leerBufferCrudo(req);
  } catch (err) {
    return badRequest(res, "No se pudo leer el archivo (" + err.message + ").");
  }
  if (!buffer || !buffer.length) return badRequest(res, "No se recibió ningún archivo.");
  if (buffer.length > MAX_BYTES) {
    return badRequest(res, "El archivo es demasiado grande (máximo 8 MB) — probá con otra foto o menos resolución.");
  }
  const contentType = String(req.headers["x-upload-content-type"] || "").toLowerCase();
  if (!TIPOS_PERMITIDOS.includes(contentType)) {
    return badRequest(res, "Solo se aceptan imágenes (JPEG, PNG, WEBP o HEIC).");
  }
  // El "campo" (ej. "doc_dni_frente", "comprobante") es solo para que el nombre del archivo en
  // Vercel Blob sea legible al mirar el storage — no tiene ningún efecto en la seguridad ni en qué
  // campo de la base lo termina guardando (eso lo decide el formulario que llama a este endpoint).
  const campoCrudo = String(req.headers["x-upload-campo"] || "archivo");
  const campo = campoCrudo.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "archivo";
  const ext = EXTENSION_POR_TIPO[contentType] || "jpg";
  const pathname = `documentos/${campo}-${newId("doc")}.${ext}`;

  let blob;
  try {
    blob = await put(pathname, buffer, { access: "private", contentType, addRandomSuffix: false });
  } catch (err) {
    console.error("Error subiendo a Vercel Blob:", err);
    return badRequest(
      res,
      "No se pudo subir el archivo al storage (" + err.message + "). Si esto sigue pasando, puede ser que falte crear/conectar " +
        "el Blob store de Vercel — ver README."
    );
  }
  ok(res, { pathname: blob.pathname });
}

// GET /api/admin/documento?pathname=... — sirve un documento privado. Se registra en
// api/[...path].js envuelto en adminOnly(): solo alguien con sesión de admin válida puede ver
// documentos de identidad o comprobantes de pago de otra persona.
async function verDocumento(req, res, params, query) {
  const pathname = query.pathname;
  if (!pathname) return badRequest(res, "Falta el parámetro pathname.");
  let resultado;
  try {
    resultado = await get(pathname, { access: "private" });
  } catch (err) {
    return notFound(res, "No se encontró el documento.");
  }
  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    return notFound(res, "No se encontró el documento.");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", resultado.blob.contentType || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Documento sensible (DNI, selfie, comprobante de pago): que no quede cacheado en discos
  // compartidos ni en el navegador más allá de esta vista.
  res.setHeader("Cache-Control", "private, no-store");
  Readable.fromWeb(resultado.stream).pipe(res);
}

module.exports = { subir, verDocumento, TIPOS_PERMITIDOS, MAX_BYTES };
