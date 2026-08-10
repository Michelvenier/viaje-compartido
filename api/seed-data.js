// api/seed-data.js — Inicializa el esquema y carga datos de ejemplo en Postgres.
// Se invoca una sola vez a través de GET /api/admin/seed?secret=... (ver routes/admin.js).
"use strict";

const db = require("./db");
const pricing = require("./pricing");
const { newId, nowIso } = require("./helpers");

async function crearUsuario(datos) {
  const id = newId("usr");
  await db.run(
    `INSERT INTO usuarios (
      id, rol, nombre, apellido, edad, dni, telefono, email, domicilio, foto_perfil, bio,
      pref_fuma, pref_mascotas, pref_musica, pref_charla, pref_equipaje, estado_validacion,
      doc_dni_frente, doc_dni_dorso, doc_selfie, doc_licencia, doc_cedula, doc_seguro, doc_vtv_declarada,
      vehiculo_marca, vehiculo_modelo, vehiculo_color, vehiculo_patente, vehiculo_foto, vehiculo_asientos,
      alias_cobro, rating_promedio, rating_count, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT (email) DO NOTHING`,
    [
      id,
      datos.rol,
      datos.nombre,
      datos.apellido,
      datos.edad || 30,
      datos.dni || "30111222",
      datos.telefono || "2211234567",
      datos.email,
      datos.domicilio || null,
      datos.foto_perfil || null,
      datos.bio || null,
      datos.pref_fuma ? 1 : 0,
      datos.pref_mascotas ? 1 : 0,
      datos.pref_musica || "si",
      datos.pref_charla || "charla",
      datos.pref_equipaje || null,
      datos.estado_validacion || "aprobado",
      "demo.jpg",
      "demo.jpg",
      "demo.jpg",
      datos.rol === "conductor" ? "demo.jpg" : null,
      datos.rol === "conductor" ? "demo.jpg" : null,
      datos.rol === "conductor" ? "demo.jpg" : null,
      datos.rol === "conductor" ? 1 : 0,
      datos.vehiculo_marca || null,
      datos.vehiculo_modelo || null,
      datos.vehiculo_color || null,
      datos.vehiculo_patente || null,
      datos.rol === "conductor" ? "demo.jpg" : null,
      datos.vehiculo_asientos || 3,
      datos.rol === "conductor" ? datos.alias_cobro || `${(datos.nombre || "conductor").toLowerCase()}.mp` : null,
      datos.rating_promedio || 4.8,
      datos.rating_count || 12,
      nowIso(),
    ]
  );
  const row = await db.get("SELECT id FROM usuarios WHERE email = ?", [datos.email]);
  return row.id;
}

async function crearViaje(opts) {
  const asientos = opts.asientos_totales || 3;
  const calculo = await pricing.calcularPrecioSugerido(opts.distancia_km, opts.peajes_estimados, asientos);
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
      opts.conductorId,
      opts.origen_direccion,
      opts.origen_ciudad,
      opts.destino_ciudad,
      JSON.stringify(opts.ciudades_intermedias || []),
      opts.fecha_salida,
      opts.hora_salida,
      opts.hora_llegada_estimada || null,
      opts.distancia_km,
      opts.peajes_estimados,
      calculo.precioNaftaUsado,
      calculo.litrosEstimados,
      calculo.costoCombustible,
      calculo.ctoTotal,
      calculo.divisor,
      calculo.precioSugerido,
      calculo.precioSugerido,
      asientos,
      asientos,
      opts.permite_mascotas ? 1 : 0,
      opts.permite_equipaje_grande ? 1 : 0,
      0,
      "charla",
      "si",
      "activo",
      nowIso(),
    ]
  );
  return id;
}

async function runSeed() {
  await db.initSchema();

  const yaHay = await db.get("SELECT COUNT(*) AS c FROM usuarios");
  if (Number(yaHay.c) > 0) {
    return { mensaje: "La base ya tenía datos, no se volvió a sembrar.", usuarios: Number(yaHay.c) };
  }

  const admin = await crearUsuario({ rol: "admin", nombre: "Admin", apellido: "Viaje Compartido", email: "admin@viajecompartido.com.ar" });

  const conductor1 = await crearUsuario({
    rol: "conductor", nombre: "Martín", apellido: "Gómez", edad: 34, email: "martin.conductor@example.com",
    domicilio: "La Plata", bio: "Mate amargo y ruta tranquila. Viajo seguido a Tandil por trabajo.",
    pref_musica: "si", pref_charla: "charla", vehiculo_marca: "Renault", vehiculo_modelo: "Sandero",
    vehiculo_color: "Gris", vehiculo_patente: "AB123CD", vehiculo_asientos: 3, rating_promedio: 4.9, rating_count: 47,
  });

  const conductor2 = await crearUsuario({
    rol: "conductor", nombre: "Laura", apellido: "Fernández", edad: 41, email: "laura.conductora@example.com",
    domicilio: "La Plata", bio: "Silencio y buena música. No fumo, sí mascotas chicas.",
    pref_musica: "si", pref_charla: "silencio", pref_mascotas: true, vehiculo_marca: "Volkswagen",
    vehiculo_modelo: "Gol Trend", vehiculo_color: "Blanco", vehiculo_patente: "AC456EF", vehiculo_asientos: 3,
    rating_promedio: 4.7, rating_count: 23,
  });

  await crearUsuario({ rol: "pasajero", nombre: "Julián", apellido: "Pérez", edad: 26, email: "julian.pasajero@example.com", pref_equipaje: "mochila" });
  await crearUsuario({ rol: "pasajero", nombre: "Sofía", apellido: "Ramírez", edad: 30, email: "sofia.pasajera@example.com", pref_equipaje: "valija" });

  const hoy = new Date();
  const fecha = (dias) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  };

  await crearViaje({
    conductorId: conductor1, origen_direccion: "Terminal de Ómnibus, La Plata", origen_ciudad: "La Plata",
    destino_ciudad: "Tandil", ciudades_intermedias: ["Chascomús", "Rauch"], fecha_salida: fecha(1),
    hora_salida: "07:30", hora_llegada_estimada: "10:30", distancia_km: 190, peajes_estimados: 2400,
    asientos_totales: 3, permite_mascotas: false, permite_equipaje_grande: true,
  });

  await crearViaje({
    conductorId: conductor1, origen_direccion: "Plaza San Martín, La Plata", origen_ciudad: "La Plata",
    destino_ciudad: "Balcarce", ciudades_intermedias: ["Chascomús", "Rauch", "Tandil"], fecha_salida: fecha(2),
    hora_salida: "08:00", hora_llegada_estimada: "11:30", distancia_km: 230, peajes_estimados: 2400,
    asientos_totales: 3, permite_mascotas: false, permite_equipaje_grande: false,
  });

  await crearViaje({
    conductorId: conductor2, origen_direccion: "Estación La Plata", origen_ciudad: "La Plata",
    destino_ciudad: "Chivilcoy", ciudades_intermedias: ["Luján", "Mercedes"], fecha_salida: fecha(1),
    hora_salida: "18:00", hora_llegada_estimada: "21:00", distancia_km: 210, peajes_estimados: 1800,
    asientos_totales: 3, permite_mascotas: true, permite_equipaje_grande: true,
  });

  await crearViaje({
    conductorId: conductor2, origen_direccion: "Diagonal 74, La Plata", origen_ciudad: "La Plata",
    destino_ciudad: "Bragado", ciudades_intermedias: ["Chivilcoy"], fecha_salida: fecha(3),
    hora_salida: "09:15", hora_llegada_estimada: "12:30", distancia_km: 260, peajes_estimados: 1800,
    asientos_totales: 4, permite_mascotas: true, permite_equipaje_grande: false,
  });

  return {
    mensaje: "Datos de ejemplo cargados correctamente.",
    admin, conductor1, conductor2,
  };
}

module.exports = { runSeed };
