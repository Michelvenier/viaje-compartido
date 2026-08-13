// api/routes/viajes.js — Publicación, búsqueda y gestión de viajes (versión async/Postgres).
"use strict";

const db = require("../db");
const pricing = require("../pricing");
const { newId, nowIso, ok, created, badRequest, notFound, forbidden, readBody, boolFields } = require("../helpers");

// Cuenta corriente del conductor: acumula deuda cuando cancela un viaje que ya tenía reservas
// pagadas (Ruta Compartida pierde la comisión de Mercado Pago al tener que reembolsar esa
// comisión al pasajero, aunque el reembolso en sí siempre sea correcto y se haga igual). El monto
// depende de cuánto aviso dio: menos o más de 24 hs antes de la salida. Ver server/pricing.js
// faltanMenosDe24Hs() y server/db.js para los valores default (editables desde el panel admin).
async function registrarPenalizacionPorCancelacion(conductorId, viajeId, viaje) {
  const reservasPagadas = await db.get(
    `SELECT COUNT(*) AS c FROM reservas WHERE viaje_id = ? AND pagado = 1`,
    [viajeId]
  );
  if (Number(reservasPagadas.c) === 0) return null; // nadie había pagado todavía: no hay comisión de MP que se pierda

  const clave = pricing.faltanMenosDe24Hs(viaje) ? "penalizacion_cancelacion_menos24hs" : "penalizacion_cancelacion_mas24hs";
  const monto = (await pricing.getConfig(clave)) || 0;
  if (monto <= 0) return null;

  await db.run("UPDATE usuarios SET saldo_deudor = COALESCE(saldo_deudor, 0) + ? WHERE id = ?", [monto, conductorId]);
  const movId = newId("mov");
  await db.run(
    `INSERT INTO movimientos_cuenta (id, usuario_id, tipo, monto, motivo, viaje_id, estado, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      movId,
      conductorId,
      "debito_cancelacion",
      monto,
      pricing.faltanMenosDe24Hs(viaje)
        ? "Cancelaste un viaje con reservas ya pagadas, con menos de 24 hs de aviso antes de la salida."
        : "Cancelaste un viaje con reservas ya pagadas.",
      viajeId,
      "confirmado",
      nowIso(),
    ]
  );
  return monto;
}

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

  // Bloqueo por deuda en la cuenta corriente (ver registrarPenalizacionPorCancelacion más arriba):
  // por encima del tope, no puede publicar viajes nuevos hasta que el admin le confirme el pago.
  const topeSaldoDeudor = (await pricing.getConfig("tope_saldo_deudor")) || 20000;
  const saldoDeudor = Number(conductor.saldo_deudor || 0);
  if (saldoDeudor > topeSaldoDeudor) {
    return forbidden(
      res,
      `Tenés una deuda de $${saldoDeudor} en tu cuenta corriente (por cancelaciones de viajes con reservas ya pagadas), ` +
        `que supera el máximo permitido de $${topeSaldoDeudor}. Regularizala desde "Mi perfil" antes de publicar un viaje nuevo.`
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

  // Penalización a la cuenta corriente del conductor: se calcula ANTES de cancelar reservas, y
  // solo si había al menos una reserva ya pagada (si nadie había pagado todavía, cancelar no le
  // cuesta nada a la plataforma, así que no corresponde ninguna penalización).
  const penalizacion = await registrarPenalizacionPorCancelacion(row.conductor_id, params.id, row);

  await db.run("UPDATE viajes SET estado = 'cancelado' WHERE id = ?", [params.id]);
  // Si cancela el conductor, el reembolso es siempre total, sin importar cuándo lo haga (Reglas
  // de la Ruta 2.5) — a diferencia de una cancelación del pasajero, que depende de las 24 hs.
  await db.run(
    "UPDATE reservas SET estado = 'cancelada', actualizado_at = ?, reembolso_aplica = 1 WHERE viaje_id = ? AND estado IN ('pendiente','aceptada')",
    [nowIso(), params.id]
  );

  let mensaje = "Viaje cancelado. Los pasajeros con reserva confirmada son reembolsados en su totalidad.";
  if (penalizacion) {
    mensaje += ` Como ya había reservas pagadas, se te cargaron $${penalizacion} en tu cuenta corriente (ver "Mi perfil") — compensa la comisión de Mercado Pago que la plataforma pierde al reembolsar.`;
  }
  ok(res, { mensaje, penalizacion: penalizacion || 0 });
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
