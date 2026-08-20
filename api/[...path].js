// api/[...path].js — Función serverless "catch-all" que atiende toda la API bajo /api/*.
// Vercel enruta automáticamente cualquier request a /api/lo-que-sea hacia este archivo
// (convención de "Dynamic API Routes" por nombre de carpeta [...path]).
"use strict";

// NOTA: toda la lógica real vive en /server, NO en /api — a propósito. Vercel (plan Hobby) trata
// cada archivo .js debajo de /api como una Serverless Function separada y limita el total a 12 por
// deployment; si estos módulos (db, helpers, las rutas, etc.) estuvieran acá, cada uno sumaría al
// contador y el proyecto deja de poder desplegarse en cuanto se agrega un archivo más (esto pasó
// literalmente al agregar api/email.js). Dejando SOLO este catch-all en /api, y todo lo demás en
// /server (que Vercel no escanea como rutas), el proyecto siempre cuenta como 1 sola función.
const Router = require("../server/router");
const db = require("../server/db");
const { notFound, sendJson, forbidden, verifyAdminToken } = require("../server/helpers");

const usuarios = require("../server/routes/usuarios");
const viajes = require("../server/routes/viajes");
const reservas = require("../server/routes/reservas");
const calificaciones = require("../server/routes/calificaciones");
const admin = require("../server/routes/admin");
const blob = require("../server/blob");
const lugares = require("../server/routes/lugares");

const router = new Router();

// Envuelve una ruta admin para exigir un token válido (emitido solo al hacer login con una
// cuenta rol="admin", ver api/routes/usuarios.js login()). El token se firma con HMAC usando
// ADMIN_SETUP_SECRET (nunca viaja al código ni se guarda en ningún lado); además de verificar
// la firma y que no haya expirado, se vuelve a consultar la base en cada request para confirmar
// que el usuario referenciado todavía existe y sigue teniendo rol admin — así, si algún día se le
// revoca el rol a una cuenta, el token deja de servir al instante aunque todavía no haya vencido.
// NO se aplica a configurarAdmin ni a seed, que tienen su propio secreto de servidor.
function adminOnly(handler) {
  return async (req, res, params, query) => {
    const header = req.headers["authorization"] || req.headers["Authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    const uid = token ? verifyAdminToken(token) : null;
    if (!uid) return forbidden(res, "Necesitás iniciar sesión como administrador para acceder a esto.");
    const usuario = await db.get("SELECT id, rol FROM usuarios WHERE id = ?", [uid]);
    if (!usuario || usuario.rol !== "admin") {
      return forbidden(res, "Necesitás iniciar sesión como administrador para acceder a esto.");
    }
    return handler(req, res, params, query);
  };
}

router.post("/api/usuarios/conductor", usuarios.registrar("conductor"));
router.post("/api/usuarios/pasajero", usuarios.registrar("pasajero"));
router.post("/api/usuarios/login", usuarios.login);
router.get("/api/usuarios/:id", usuarios.obtener);
router.patch("/api/usuarios/:id", usuarios.actualizar);
router.get("/api/usuarios/:id/cuenta-corriente", usuarios.verCuentaCorriente);
router.post("/api/usuarios/:id/cuenta-corriente/pagos", usuarios.declararPagoCuenta);

router.post("/api/viajes", viajes.publicar);
router.get("/api/viajes", viajes.buscar);
router.get("/api/viajes/:id", viajes.detalle);
router.delete("/api/viajes/:id", viajes.cancelar);
router.get("/api/viajes/conductor/:conductorId", viajes.porConductor);
router.post("/api/pricing/calcular", viajes.calcularVista);
router.post("/api/viajes/:id/desglose-reserva", viajes.desgloseReservaVista);

router.post("/api/reservas", reservas.crear);
router.get("/api/reservas/:id", reservas.obtener);
router.get("/api/reservas/pasajero/:pasajeroId", reservas.porPasajero);
router.get("/api/reservas/viaje/:viajeId", reservas.porViaje);
router.patch("/api/reservas/:id", reservas.cambiarEstado);
router.post("/api/reservas/:id/pagar", reservas.pagar);
router.patch("/api/reservas/:id/asistencia", reservas.reportarAsistencia);

router.post("/api/calificaciones", calificaciones.crear);
router.get("/api/calificaciones/usuario/:usuarioId", calificaciones.porUsuario);

// Todas estas exponen estadísticas y datos personales de usuarios/reservas — requieren un
// token de admin válido. "seed" y "configurar-admin" quedan afuera a propósito: tienen su
// propio secreto de servidor (SEED_SECRET / ADMIN_SETUP_SECRET) y son los únicos puntos de
// entrada que existen antes de que exista ninguna sesión de admin.
router.get("/api/admin/pendientes", adminOnly(admin.pendientes));
router.get("/api/admin/usuarios", adminOnly(admin.listarUsuarios));
router.patch("/api/admin/validar/:id", adminOnly(admin.validar));
router.post("/api/admin/usuarios/:id/resetear-password", adminOnly(admin.resetearPassword));
router.get("/api/admin/choferes", adminOnly(admin.choferesStats));
router.patch("/api/admin/choferes/:id/reactivar", adminOnly(admin.reactivarChofer));
router.get("/api/admin/config", adminOnly(admin.verConfig));
router.patch("/api/admin/config", adminOnly(admin.actualizarConfig));
router.get("/api/admin/estadisticas", adminOnly(admin.estadisticas));
router.get("/api/admin/reembolsos-pendientes", adminOnly(admin.reembolsosPendientes));
router.patch("/api/admin/reembolsos/:id/marcar-reembolsado", adminOnly(admin.marcarReembolsado));
router.get("/api/admin/cuenta-corriente-pendientes", adminOnly(admin.cuentaCorrientePendientes));
router.patch("/api/admin/cuenta-corriente/:id/confirmar", adminOnly(admin.confirmarPagoCuenta));
router.get("/api/admin/pagos-pendientes", adminOnly(admin.pagosPendientes));
router.patch("/api/admin/reservas/:id/confirmar-pago", adminOnly(admin.confirmarPagoReserva));
router.get("/api/admin/seed", admin.seed);
router.post("/api/admin/configurar-admin", admin.configurarAdmin);

// Datos de cobro de la plataforma (alias/CBU, titular, CUIL) — a propósito SIN adminOnly: los
// necesita ver cualquier pasajero pagando la comisión o conductor pagando su cuenta corriente,
// sin sesión de admin. Ver server/routes/admin.js datosCobro().
router.get("/api/config/cobro", admin.datosCobro);

// Almacenamiento real de archivos (Vercel Blob) — ver server/blob.js para la explicación completa
// de por qué está armado así. "subir" es público (mismo nivel de confianza que el resto de la
// app); "verDocumento" exige sesión de admin porque sirve documentos de identidad y comprobantes
// de pago de otras personas.
router.post("/api/upload", blob.subir);
router.get("/api/admin/documento", adminOnly(blob.verDocumento));

// Búsqueda de puntos de encuentro (estaciones de servicio, terminales, etc.) para publicar un
// viaje, y entrega de la key de Google Maps para uso en el navegador — ver server/routes/lugares.js
// para el detalle completo de las dos keys distintas (server-side vs. browser) y por qué.
router.get("/api/lugares/buscar", lugares.buscar);
router.get("/api/lugares/maps-key", lugares.mapsKey);

let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) schemaReady = db.initSchema();
  return schemaReady;
}

module.exports = async (req, res) => {
  try {
    await ensureSchema();
  } catch (err) {
    console.error("Error inicializando el esquema:", err);
    return sendJson(res, 500, { error: "No se pudo conectar a la base de datos: " + err.message });
  }

  // req.url en Vercel para esta función viene como "/api/viajes?destino=Tandil" (con query incluida).
  const fullUrl = new URL(req.url, "http://localhost");
  const pathname = fullUrl.pathname;
  const query = {};
  fullUrl.searchParams.forEach((v, k) => (query[k] = v));

  const match = router.match(req.method, pathname);
  if (!match) return notFound(res, "Ruta de API no encontrada");

  try {
    await match.handler(req, res, match.params, query);
  } catch (err) {
    console.error(err);
    if (!res.writableEnded) sendJson(res, 500, { error: "Error interno del servidor: " + err.message });
  }
};
