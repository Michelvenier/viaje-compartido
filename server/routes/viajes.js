// api/routes/viajes.js — Publicación, búsqueda y gestión de viajes (versión async/Postgres).
"use strict";

const db = require("../db");
const pricing = require("../pricing");
const { newId, nowIso, ok, created, badRequest, notFound, forbidden, readBody, boolFields } = require("../helpers");

function filaViaje(row) {
  if (!row) return row;
  const copy = boolFields(row, ["permite_mascotas", "permite_equipaje_grande", "permite_fumar"]);
  copy.ciudades_intermedias = JSON.parse(copy.ciudades_intermedias || "[]");
  return copy;
}

// A propósito NO trae foto, bio, teléfono ni datos del vehículo: mientras el pasajero está
// buscando o mirando el detalle de un viaje (todavía no reservó ni el conductor confirmó nada)
// solo debe ver nombre y valoración — así no puede escribirle por fuera de la app antes de
// confirmar y pagar. Los datos completos del conductor se exponen recién en las reservas
// del pasajero, una vez que el conductor aceptó su solicitud (ver api/routes/reservas.js).
async function conConductor(row) {
  const viaje = filaViaje(row);
  const conductor = await db.get(
    `SELECT id, nombre, apellido, rating_promedio, rating_count, estado_validacion
     FROM usuarios WHERE id = ?`,
    [viaje.conductor_id]
  );
  viaje.conductor = conductor;
  return viaje;
}

async function publicar(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }

  const requeridos = ["conductor_id", "origen_direccion", "origen_ciudad", "destino_ciudad", "fecha_salida", "hora_salida"];
  for (const campo of requeridos) {
    if (!body[campo]) return badRequest(res, `Falta el campo obligatorio: ${campo}`);
  }

  const conductor = await db.get("SELECT * FROM usuarios WHERE id = ?", [body.conductor_id]);
  if (!conductor || conductor.rol !== "conductor") {
    return badRequest(res, "El usuario no es un conductor registrado.");
  }
  if (conductor.estado_validacion !== "aprobado") {
    return forbidden(
      res,
      "Tu perfil todavía está en revisión. Te avisamos por WhatsApp en menos de 24 hs cuando estés habilitado para publicar viajes."
    );
  }

  const asientosOfrecidos = Math.min(Math.max(Number(body.asientos_totales) || 3, 1), 4);

  // Distancia, peajes y precio se calculan SIEMPRE en el servidor a partir de las ciudades — no
  // se toma ningún valor de distancia_km, peajes_estimados ni precio_por_asiento que venga del
  // cliente, así nadie (ni el propio conductor) puede modificarlos. Ver api/corredor.js.
  const calculo = await pricing.calcularPorCiudades(body.origen_ciudad, body.destino_ciudad, asientosOfrecidos);
  if (calculo.error) return badRequest(res, calculo.error);

  const id = newId("trip");
  await db.run(
    `INSERT INTO viajes (
      id, conductor_id, origen_direccion, origen_ciudad, destino_ciudad, ciudades_intermedias,
      fecha_salida, hora_salida, hora_llegada_estimada, distancia_km, peajes_estimados,
      precio_nafta_usado, litros_estimados, costo_combustible, cto_total, divisor_precio,
      precio_sugerido, precio_por_asiento, asientos_totales, asientos_disponibles,
      permite_mascotas, permite_equipaje_grande, permite_fumar, pref_charla, pref_musica,
      estado, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      conductor.id,
      body.origen_direccion,
      body.origen_ciudad,
      body.destino_ciudad,
      JSON.stringify(body.ciudades_intermedias || []),
      body.fecha_salida,
      body.hora_salida,
      body.hora_llegada_estimada || null,
      calculo.distanciaKm,
      calculo.peajesEstimados,
      calculo.precioNaftaUsado,
      calculo.litrosEstimados,
      calculo.costoCombustible,
      calculo.ctoTotal,
      calculo.divisor,
      calculo.precioSugerido,
      calculo.precioSugerido,
      asientosOfrecidos,
      asientosOfrecidos,
      body.permite_mascotas ? 1 : 0,
      body.permite_equipaje_grande ? 1 : 0,
      body.permite_fumar ? 1 : 0,
      body.pref_charla || "indistinto",
      body.pref_musica || "indistinto",
      "activo",
      nowIso(),
    ]
  );

  const row = await db.get("SELECT * FROM viajes WHERE id = ?", [id]);
  created(res, await conConductor(row));
}

async function buscar(req, res, params, query) {
  let sql = `SELECT * FROM viajes WHERE estado = 'activo' AND asientos_disponibles > 0`;
  const args = [];
  if (query.origen) {
    sql += ` AND origen_ciudad ILIKE ?`;
    args.push(`%${query.origen}%`);
  }
  if (query.destino) {
    sql += ` AND (destino_ciudad ILIKE ? OR ciudades_intermedias ILIKE ?)`;
    args.push(`%${query.destino}%`, `%${query.destino}%`);
  }
  if (query.fecha) {
    sql += ` AND fecha_salida = ?`;
    args.push(query.fecha);
  }
  sql += ` ORDER BY fecha_salida ASC, hora_salida ASC`;
  const rows = await db.all(sql, args);
  ok(res, await Promise.all(rows.map(conConductor)));
}

async function detalle(req, res, params) {
  const row = await db.get("SELECT * FROM viajes WHERE id = ?", [params.id]);
  if (!row) return notFound(res, "Viaje no encontrado");
  ok(res, await conConductor(row));
}

async function porConductor(req, res, params) {
  const rows = await db.all("SELECT * FROM viajes WHERE conductor_id = ? ORDER BY fecha_salida DESC", [
    params.conductorId,
  ]);
  ok(res, rows.map(filaViaje));
}

async function cancelar(req, res, params) {
  const row = await db.get("SELECT * FROM viajes WHERE id = ?", [params.id]);
  if (!row) return notFound(res, "Viaje no encontrado");
  await db.run("UPDATE viajes SET estado = 'cancelado' WHERE id = ?", [params.id]);
  // Si cancela el conductor, el reembolso es siempre total, sin importar cuándo lo haga (Reglas
  // de la Ruta 2.5) — a diferencia de una cancelación del pasajero, que depende de las 24 hs.
  await db.run(
    "UPDATE reservas SET estado = 'cancelada', actualizado_at = ?, reembolso_aplica = 1 WHERE viaje_id = ? AND estado IN ('pendiente','aceptada')",
    [nowIso(), params.id]
  );
  ok(res, { mensaje: "Viaje cancelado. Los pasajeros con reserva confirmada son reembolsados en su totalidad." });
}

async function calcularVista(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  if (!body.origen_ciudad || !body.destino_ciudad) return badRequest(res, "Elegí ciudad de origen y de destino.");
  const asientos = Math.min(Math.max(Number(body.asientos_totales) || 3, 1), 4);
  const calculo = await pricing.calcularPorCiudades(body.origen_ciudad, body.destino_ciudad, asientos);
  if (calculo.error) return badRequest(res, calculo.error);
  ok(res, calculo);
}

// Vista previa de la comisión ANTES de confirmar la solicitud de reserva (Reglas de la Ruta 2.3:
// el monto de la comisión tiene que verse desde el momento de reservar, no solo en la pantalla de
// pago). Usa el mismo cálculo que se aplica de verdad al crear la reserva (pricing.calcularDesgloseReserva),
// así el número que ve el pasajero antes de solicitar es siempre el que después le va a cobrar.
async function desgloseReservaVista(req, res, params) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }
  const viaje = await db.get("SELECT * FROM viajes WHERE id = ?", [params.id]);
  if (!viaje) return notFound(res, "Viaje no encontrado");
  const asientos = Math.max(1, Number(body.asientos_reservados) || 1);
  const desglose = await pricing.calcularDesgloseReserva(viaje.precio_por_asiento, asientos);
  ok(res, desglose);
}

module.exports = { publicar, buscar, detalle, porConductor, cancelar, calcularVista, desgloseReservaVista };
