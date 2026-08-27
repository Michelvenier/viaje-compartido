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

// Solo imágenes — es lo único que suben los formularios de esta app (`accept="image/*,.jfif,.heic,
// .heif"` en js/components.js renderUploadField). Nada de PDFs ni otros tipos, para no tener que
// sanitizar contenido arbitrario. Lista ampliada (27 ago 2026, a pedido del usuario: "quiero que la
// documentacion que carguen choferes y pasajeros acepte muchas modalidades, como jpg jpeg jfif y
// las que se te ocurran") — se agregan los formatos comunes que puede entregar un teléfono o una
// PC además de los que ya estaban. ".jfif" es en sí mismo un archivo JPEG (JPEG File Interchange
// Format), así que el navegador casi siempre lo reporta como "image/jpeg" — pero algunos navegadores
// viejos lo reportan como "image/pjpeg", por eso se incluye ese tipo también, mapeado igual que jpeg.
const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/pjpeg", // variante vieja de algunos navegadores para JPEG/JFIF
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/avif",
];
// Tope generoso pensado como red de seguridad, no como límite normal: con la compresión del lado
// del cliente (máx. ~1600px, calidad ~0.82) una foto real pesa unos cientos de KB. Si por algún
// motivo la compresión falla y se sube el archivo original sin comprimir, 8 MB todavía entra
// cómodo dentro del límite de 4.5 MB... en realidad NO entra (8 MB > 4.5 MB) — el request se
// cortaría solo antes de llegar acá. Este chequeo es la segunda barrera, por si el límite de la
// plataforma cambiara o el archivo llegara por otra vía.
const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSION_POR_TIPO = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/avif": "avif",
};

// Estos dos campos son la excepción a "todo se guarda privado a nivel de la app": la foto de
// perfil y la foto del auto están pensadas para que las vea la OTRA persona del viaje (pasajero ⇄
// conductor), sin login de admin — es justamente el pedido del usuario (19 ago 2026: "quiero una
// imagen para cada usuario, asi ven la cara los demas... asi no llega un desconocido"). Todo lo
// demás (DNI, selfie, licencia, cédula, seguro, VTV, comprobantes de pago) sigue siendo privado y
// solo lo puede ver el admin — son documentos de identidad/pago, no algo para mostrar a cualquiera.
//
// 27 ago 2026 — CAMBIO IMPORTANTE: el Blob store real de este proyecto ("Documento usuarios") quedó
// creado en Vercel con el modo de acceso fijado en "Private" (irreversible — Vercel no deja
// cambiarlo después de creado, confirmado en Settings del store: "The access mode cannot be changed
// after creation"), así que `put()` con `access: "public"` para estos dos campos empezó a fallar en
// producción con "Cannot use public access on a private store". Antes de este cambio, estos dos
// campos SÍ se subían con `access: "public"` y se devolvía `blob.url` (una URL pública de Vercel,
// fetchable por cualquiera sin backend de por medio). Ahora TODO se sube siempre como `access:
// "private"` — incluida la foto de perfil y la del auto — y estos dos campos se diferencian
// únicamente en CÓMO se sirven después: en vez de una URL directa de Vercel, se devuelve un link a
// `verDocumentoPublico()` (abajo), que lee el blob privado en el servidor y lo re-sirve SIN pedir
// sesión de admin (a diferencia de `verDocumento()`, que sí la exige) — mismo resultado visual para
// quien mira la app (una foto que carga sola en un <img>), pero sin depender de que el store
// soporte acceso público.
const CAMPOS_PUBLICOS = ["foto_perfil", "vehiculo_foto"];

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

// POST /api/upload — sube un archivo (foto de documento o comprobante) y devuelve el valor para
// guardar en el campo correspondiente. A propósito SIN adminOnly ni ningún otro chequeo de sesión:
// igual que el resto de esta app (que no tiene sesiones de pasajero/conductor, solo de admin),
// cualquiera puede subir un archivo acá — es el mismo nivel de confianza que ya tiene, por ejemplo,
// `PATCH /api/usuarios/:id`. Lo que sí se valida es que sea una imagen y que no sea gigante. TODOS
// los archivos se guardan como PRIVADOS en Vercel Blob (ver nota del 27 ago 2026 en
// CAMPOS_PUBLICOS más arriba) — nadie puede verlos con solo una URL de Vercel; hace falta pasar por
// `verDocumento()` (con sesión de admin) o, para foto_perfil/vehiculo_foto, por
// `verDocumentoPublico()` (sin sesión, ver abajo).
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
    return badRequest(res, "Solo se aceptan imágenes (JPEG/JFIF, PNG, WEBP, HEIC, HEIF, GIF, BMP, TIFF o AVIF).");
  }
  // El "campo" (ej. "doc_dni_frente", "comprobante") es solo para que el nombre del archivo en
  // Vercel Blob sea legible al mirar el storage — no tiene ningún efecto en la seguridad ni en qué
  // campo de la base lo termina guardando (eso lo decide el formulario que llama a este endpoint).
  const campoCrudo = String(req.headers["x-upload-campo"] || "archivo");
  const campo = campoCrudo.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "archivo";
  const ext = EXTENSION_POR_TIPO[contentType] || "jpg";
  const pathname = `documentos/${campo}-${newId("doc")}.${ext}`;
  const publico = CAMPOS_PUBLICOS.includes(campo);

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
  // Para campos públicos (foto_perfil, vehiculo_foto) devolvemos un link RELATIVO a
  // verDocumentoPublico() (ver abajo) — no una URL de Vercel, porque el blob es privado (ver nota
  // del 27 ago 2026 más arriba). El frontend (avatarHtml() en js/components.js, y el preview de
  // "Mi perfil" en js/views.js) reconoce este link igual que reconocía antes una URL http(s)
  // completa, y lo usa tal cual como `src` de un <img> — el navegador lo resuelve solo contra el
  // dominio actual. Para todo lo demás seguimos devolviendo solo el "pathname" privado de Vercel,
  // que no sirve como URL de ningún tipo sin pasar por verDocumento() con sesión de admin.
  ok(res, { valor: publico ? `/api/documento-publico?pathname=${encodeURIComponent(blob.pathname)}` : blob.pathname, publico });
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

// GET /api/documento-publico?pathname=... — sirve foto_perfil/vehiculo_foto SIN sesión de admin
// (27 ago 2026, ver nota en CAMPOS_PUBLICOS más arriba): estas dos son las únicas que cualquiera
// que use la app tiene que poder ver (la otra persona del viaje), a diferencia de DNI/selfie/
// comprobantes que siguen exigiendo `verDocumento()` con sesión de admin. Se registra en
// api/[...path].js SIN adminOnly() a propósito.
//
// Chequeo de seguridad clave: aunque el blob en sí es privado en Vercel (nadie puede verlo con
// solo una URL de Vercel Blob, hace falta pasar por este endpoint o por verDocumento()), este
// endpoint específico NO pide sesión — así que hay que evitar que alguien lo use para colarse y ver
// un documento sensible (DNI, comprobante de pago) sabiendo o adivinando su pathname. Por eso se
// valida que el pathname empiece con `documentos/<campo>-` para algún `campo` de CAMPOS_PUBLICOS
// ANTES de ir a buscarlo — un pathname de doc_dni_frente, comprobante, etc. se rechaza acá mismo,
// sin llegar a pedirle nada a Vercel Blob. (Los pathnames además llevan un UUID al azar —
// newId()/crypto.randomUUID() — así que tampoco son adivinables; este chequeo es una segunda capa,
// no la única defensa.)
async function verDocumentoPublico(req, res, params, query) {
  const pathname = query.pathname;
  if (!pathname) return badRequest(res, "Falta el parámetro pathname.");
  const esCampoPublico = CAMPOS_PUBLICOS.some((campo) => pathname.startsWith(`documentos/${campo}-`));
  if (!esCampoPublico) return notFound(res, "No se encontró la foto.");
  let resultado;
  try {
    resultado = await get(pathname, { access: "private" });
  } catch (err) {
    return notFound(res, "No se encontró la foto.");
  }
  if (!resultado || resultado.statusCode !== 200 || !resultado.stream) {
    return notFound(res, "No se encontró la foto.");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", resultado.blob.contentType || "application/octet-stream");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // A diferencia de verDocumento() (documentos sensibles, "no-store"), esta es una foto pensada
  // para mostrarse a cualquiera que use la app — sí se puede cachear en el navegador para no
  // volver a pedirla en cada pantalla.
  res.setHeader("Cache-Control", "public, max-age=3600");
  Readable.fromWeb(resultado.stream).pipe(res);
}

module.exports = { subir, verDocumento, verDocumentoPublico, TIPOS_PERMITIDOS, MAX_BYTES };
