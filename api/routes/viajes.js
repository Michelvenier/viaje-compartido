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

async function conConductor(row) {
  const viaje = filaViaje(row);
  const conductor = await db.get(
    `SELECT id, nombre, apellido, foto_perfil, bio, pref_fuma, pref_mascotas, pref_musica, pref_charla,
            vehiculo_marca, vehiculo_modelo, vehiculo_color, vehiculo_foto, rating_promedio, rating_count,
            estado_validacion
     FROM usuarios WHERE id = ?`,
    [viaje.conductor_id]
  );
  viaje.conductor = boolFields(conductor, ["pref_fuma", "pref_mascotas"]);
  return viaje;
}

async function publicar(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return badRequest(res, "JSON inválido");
  }

  const requeridos = [
    "conductor_id",
    "origen_direccion",
    "origen_ciudad",
    "destino_ciudad",
    "fecha_salida",
    "hora_salida",
    "distancia_km",
  ];
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
  const peajes = Number(body.peajes_estimados) || 0;
  const calculo = await pricing.calcularPrecioSugerido(Number(body.distancia_km), peajes, asientosOfrecidos);

  let precioPorAsiento = calculo.precioSugerido;
  if (body.precio_por_asiento) {
    const validacion = await pricing.validarPrecioElegido({
      precioSugerido: calculo.precioSugerido,
      precioElegido: Number(body.precio_por_asiento),
      ctoTotal: calculo.ctoTotal,
      asientosOfrecidos: calculo.asientosOfrecidos,
    });
    if (!validacion.valido) return badRequest(res, validacion.motivo);
    precioPorAsiento = Number(body.precio_por_asiento);
  }

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
      Number(body.distancia_km),
      peajes,
      calculo.precioNaftaUsado,
      calculo.litrosEstimados,
      calculo.costoCombustible,
      calculo.ctoTotal,
      calculo.divisor,
      calculo.precioSugerido,
      precioPorAsiento,
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
  await db.run(
    "UPDATE reservas SET estado = 'cancelada', actualizado_at = ? WHERE viaje_id = ? AND estado IN ('pendiente','aceptada')",
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
  if (!body.distancia_km) return badRequest(res, "Falta la distancia en km");
  const asientos = Math.min(Math.max(Number(body.asientos_totales) || 3, 1), 4);
  const calculo = await pricing.calcularPrecioSugerido(
    Number(body.distancia_km),
    Number(body.peajes_estimados) || 0,
    asientos
  );
  const tolerancia = await pricing.getConfig("tolerancia_ajuste_pct");
  ok(res, {
    ...calculo,
    precioMinimoSugerido: pricing.round2(calculo.precioSugerido * (1 - tolerancia / 100)),
    precioMaximoPermitido: pricing.round2(calculo.precioSugerido * (1 + tolerancia / 100)),
  });
}

module.exports = { publicar, buscar, detalle, porConductor, cancelar, calcularVista };
