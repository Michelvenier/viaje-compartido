// api/db.js — Capa de datos para el despliegue en Vercel, usando Postgres (pg)
// en vez de node:sqlite (que no persiste en funciones serverless).
//
// Expone la misma API de "prepare(sql).get/.all/.run(...params)" que usaba la
// versión local con node:sqlite, para minimizar cambios en las rutas: internamente
// traduce los placeholders "?" de SQLite a "$1, $2, ..." de Postgres y ejecuta
// la consulta contra un Pool reutilizado entre invocaciones (mientras la instancia
// de la función esté "caliente").
"use strict";

const { Pool } = require("pg");
const { DISTANCIAS_DEFAULT } = require("./corredor");

let _pool = null;
function getPool() {
  if (!_pool) {
    const connectionString =
      process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
    if (!connectionString) {
      throw new Error(
        "No se encontró la variable de entorno POSTGRES_URL / DATABASE_URL. Agregá una base Postgres desde el panel de Vercel (Storage → Postgres) y volvé a desplegar."
      );
    }
    _pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
      max: 3,
    });
  }
  return _pool;
}

// Convierte "SELECT * FROM t WHERE a = ? AND b = ?" -> "... WHERE a = $1 AND b = $2"
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function run(sql, params = []) {
  const res = await getPool().query(toPgSql(sql), params);
  return { changes: res.rowCount, rows: res.rows };
}
async function get(sql, params = []) {
  const res = await getPool().query(toPgSql(sql), params);
  return res.rows[0];
}
async function all(sql, params = []) {
  const res = await getPool().query(toPgSql(sql), params);
  return res.rows;
}

// Shim de compatibilidad: mismo estilo de llamada que la versión con node:sqlite,
// pero ahora devuelve Promesas (hay que usar `await` en cada llamada).
function prepare(sql) {
  return {
    get: (...params) => get(sql, params),
    all: (...params) => all(sql, params),
    run: (...params) => run(sql, params),
  };
}

async function exec(sql) {
  await getPool().query(sql);
}

async function initSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      rol TEXT NOT NULL CHECK (rol IN ('conductor','pasajero','admin')),
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      edad INTEGER,
      dni TEXT,
      telefono TEXT,
      email TEXT UNIQUE,
      domicilio TEXT,
      foto_perfil TEXT,
      bio TEXT,
      pref_fuma INTEGER DEFAULT 0,
      pref_mascotas INTEGER DEFAULT 0,
      pref_musica TEXT,
      pref_charla TEXT,
      pref_equipaje TEXT,
      estado_validacion TEXT DEFAULT 'pendiente' CHECK (estado_validacion IN ('pendiente','aprobado','rechazado')),
      motivo_rechazo TEXT,
      doc_dni_frente TEXT,
      doc_dni_dorso TEXT,
      doc_selfie TEXT,
      doc_licencia TEXT,
      doc_cedula TEXT,
      doc_seguro TEXT,
      doc_vtv_declarada INTEGER DEFAULT 0,
      doc_vtv TEXT,
      vtv_vencimiento TEXT,
      vehiculo_marca TEXT,
      vehiculo_modelo TEXT,
      vehiculo_color TEXT,
      vehiculo_patente TEXT,
      vehiculo_foto TEXT,
      vehiculo_asientos INTEGER DEFAULT 3,
      alias_cobro TEXT,
      rating_promedio REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      password TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS viajes (
      id TEXT PRIMARY KEY,
      conductor_id TEXT NOT NULL REFERENCES usuarios(id),
      origen_direccion TEXT NOT NULL,
      origen_ciudad TEXT NOT NULL,
      destino_ciudad TEXT NOT NULL,
      ciudades_intermedias TEXT DEFAULT '[]',
      fecha_salida TEXT NOT NULL,
      hora_salida TEXT NOT NULL,
      hora_llegada_estimada TEXT,
      distancia_km REAL NOT NULL,
      peajes_estimados REAL NOT NULL DEFAULT 0,
      precio_nafta_usado REAL NOT NULL,
      litros_estimados REAL NOT NULL,
      costo_combustible REAL NOT NULL,
      cto_total REAL NOT NULL,
      divisor_precio INTEGER NOT NULL,
      precio_sugerido REAL NOT NULL,
      precio_por_asiento REAL NOT NULL,
      asientos_totales INTEGER NOT NULL,
      asientos_disponibles INTEGER NOT NULL,
      permite_mascotas INTEGER DEFAULT 0,
      permite_equipaje_grande INTEGER DEFAULT 0,
      permite_fumar INTEGER DEFAULT 0,
      pref_charla TEXT DEFAULT 'indistinto',
      pref_musica TEXT DEFAULT 'indistinto',
      estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo','completado','cancelado')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      viaje_id TEXT NOT NULL REFERENCES viajes(id),
      pasajero_id TEXT NOT NULL REFERENCES usuarios(id),
      asientos_reservados INTEGER NOT NULL DEFAULT 1,
      estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada','completada')),
      monto_total REAL NOT NULL,
      comision_plataforma REAL NOT NULL,
      monto_conductor REAL NOT NULL,
      pagado INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      actualizado_at TEXT
    );

    CREATE TABLE IF NOT EXISTS calificaciones (
      id TEXT PRIMARY KEY,
      reserva_id TEXT NOT NULL REFERENCES reservas(id),
      autor_id TEXT NOT NULL REFERENCES usuarios(id),
      destinatario_id TEXT NOT NULL REFERENCES usuarios(id),
      puntuacion INTEGER NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
      manejo INTEGER,
      comodidad INTEGER,
      comentario TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    -- Migración: si la tabla usuarios ya existía de antes (creada con un esquema viejo),
    -- esto agrega las columnas nuevas sin borrar nada de lo que ya había.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS alias_cobro TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS doc_vtv TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS vtv_vencimiento TEXT;
    -- "reembolso_aplica" queda nulo hasta que la reserva se cancela; ahí se guarda si correspondía
    -- reembolso (según la regla de las 24 hs, o 1 siempre si canceló el conductor) o no.
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS reembolso_aplica INTEGER;
    -- "asistio" queda nulo hasta que el CONDUCTOR reporta si el pasajero viajó o no (ver
    -- api/routes/reservas.js reportarAsistencia) — null = todavía sin reportar, 1 = viajó,
    -- 0 = no se presentó. La comisión se cobra siempre al pagar, sin importar esto; si no viajó,
    -- el reembolso de la comisión lo procesa el admin a mano (ver reembolso_manual_realizado).
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS asistio INTEGER;
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS asistio_reportado_at TEXT;
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS reembolso_manual_realizado INTEGER DEFAULT 0;
    -- Contador de inasistencias del pasajero (reputación) — se ve tanto en el panel admin como en
    -- la solicitud que recibe cada conductor, para que decida con esa información.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0;
    -- Bloqueo por intentos de login fallidos (fuerza bruta) — aplica a toda cuenta, pero es
    -- la protección principal de la cuenta admin. Ver api/routes/usuarios.js login().
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TEXT;
    -- Cuenta corriente del conductor: se le debita una penalización cuando cancela un viaje que ya
    -- tenía reservas pagadas (porque la plataforma pierde la comisión de Mercado Pago al tener que
    -- reembolsar), y se le acredita cuando el admin confirma que pagó esa deuda a mano. Con más de
    -- $20.000 de saldo deudor no puede publicar viajes nuevos — ver server/routes/viajes.js.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS saldo_deudor NUMERIC DEFAULT 0;
    -- Suspensión de conductores por cancelar viajes seguidos (a pedido del usuario, 14 ago 2026): se
    -- calcula en vivo cuántos de los viajes MÁS RECIENTES de un conductor fueron cancelados sin
    -- interrupción (ver server/choferes.js) y, al llegar al umbral configurado, se lo suspende acá —
    -- bloquea publicar viajes nuevos hasta que el admin lo reactive a mano desde el panel.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido_motivo TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS suspendido_at TEXT;
    -- Pago de la comisión con comprobante + confirmación del admin (a pedido del usuario, 19 ago
    -- 2026): el pasajero ya no queda "pagado" apenas hace clic — declara el pago adjuntando un
    -- comprobante (queda acá, igual que movimientos_cuenta.comprobante: por ahora solo el nombre
    -- del archivo) y "pagado" pasa a 1 recién cuando el admin lo confirma desde el panel. Mientras
    -- una reserva aceptada no está pagada, es "deuda" del pasajero — ver server/routes/reservas.js
    -- crear() (bloquea reservas nuevas) y server/routes/admin.js (cola de confirmación).
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS comprobante_pago TEXT;
    -- Tramo real del pasajero dentro del viaje (a pedido del usuario, 19 ago 2026: "si alguien va
    -- de 9 de julio a pehuajo, tiene que hacer solo ese calculo la app"). Un viaje publicado (ej.
    -- La Plata -> Pehuajó, pasando por 9 de Julio) puede tener pasajeros que solo hacen un tramo
    -- (9 de Julio -> Pehuajó) — ese tramo se guarda acá, y el precio de ESA reserva se calcula con
    -- la distancia real de ese tramo (server/pricing.js calcularPorCiudades), no con el precio del
    -- viaje completo. Nombradas "tramo_..." (no "origen_ciudad"/"destino_ciudad" a secas) para no
    -- pisar los alias que ya usan las consultas que hacen JOIN con viajes (v.origen_ciudad,
    -- v.destino_ciudad). Nulas en reservas viejas (de antes de este cambio) — ahí se asume el
    -- tramo completo del viaje, mismo comportamiento que siempre tuvieron.
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS tramo_origen_ciudad TEXT;
    ALTER TABLE reservas ADD COLUMN IF NOT EXISTS tramo_destino_ciudad TEXT;
    -- Puntos de encuentro exactos elegidos con el buscador de lugares de Google (a pedido del
    -- usuario, 19 ago 2026: "que seleccione el punto de encuentro en google maps... igual a
    -- blablacar"). JSON, objeto con la ciudad como clave (la misma que ya se usa en origen_ciudad /
    -- destino_ciudad / ciudades_intermedias) y como valor {nombre, direccion, lat, lng, place_id}.
    -- Opcional por ciudad: un viaje puede tener el punto elegido para el origen y no para el
    -- destino, por ejemplo — donde falte, la app cae al comportamiento de siempre (solo el nombre
    -- de la ciudad / origen_direccion en texto libre). Default '{}' para viajes viejos.
    ALTER TABLE viajes ADD COLUMN IF NOT EXISTS puntos_encuentro TEXT DEFAULT '{}';
    -- Género (24 ago 2026, a pedido del usuario: "capaz no quiere viajar con un tipo desconocido,
    -- por eso me gustaria que los pasajeros vean... para que confirmen seguros"). Campo OPCIONAL —
    -- nadie está obligado a completarlo, ni al registrarse ni después; queda NULL para cualquier
    -- cuenta que no lo cargue, y ahí simplemente no se muestra ese dato en ningún lado (mismo
    -- criterio que foto_perfil cuando no está cargada). Texto libre corto en vez de un enum fijo en
    -- la base, para no tener que migrar el esquema si en el futuro se agregan más opciones — el
    -- select del frontend (js/views.js) sí ofrece opciones fijas ("Mujer" / "Varón" / "Prefiero no
    -- decirlo") para mantenerlo simple y evitar texto libre arbitrario ahí.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS genero TEXT;
    -- Licencia de conducir y cédula verde/azul con frente y dorso por separado (27 ago 2026, a
    -- pedido del usuario: "las dos son frente y dorso, osea dos opciones te tiene que dar"). Se
    -- agregan columnas NUEVAS en vez de reutilizar doc_licencia/doc_cedula para no perder la foto
    -- ya cargada por conductores que se registraron antes de este cambio — esas dos columnas viejas
    -- quedan tal cual, sin usarse en el flujo de alta nuevo (ver server/routes/usuarios.js y
    -- js/views.js, que ahora piden y guardan estas cuatro en su lugar).
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS doc_licencia_frente TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS doc_licencia_dorso TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS doc_cedula_frente TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS doc_cedula_dorso TEXT;
    -- Rol dual: cualquier cuenta puede ser conductor Y pasajero (07 sep 2026, a pedido explícito
    -- del usuario: "Quiero que todos los usuarios puedan modificar sus datos de contacto y que
    -- puedan ser conductores y pasajeros"). "rol" (arriba) queda tal cual, como el tipo de cuenta
    -- con el que se registró originalmente — ya NO es lo único que decide qué puede hacer:
    --   - Reservar viajes como pasajero: ahora lo puede hacer CUALQUIER cuenta validada que no sea
    --     admin (ver server/routes/reservas.js crear()) — no hace falta ningún flag nuevo, porque
    --     los datos que ya pide el registro (DNI, selfie, teléfono, email) alcanzan igual para un
    --     conductor que para un pasajero.
    --   - Publicar viajes como conductor: hace falta licencia, cédula, seguro, VTV y auto, que un
    --     pasajero no tiene cargados — por eso esto SÍ es un flag aparte, "es_conductor", que se
    --     habilita recién cuando esa documentación fue revisada y aprobada.
    -- "es_conductor" arranca en 0 para todas las cuentas; se pone en 1 automáticamente para los
    -- conductores YA aprobados (ver migrarRolDual07Sep2026 más abajo), y para cualquier cuenta
    -- nueva en el momento en que se aprueba su documentación de conductor (ver server/routes/
    -- admin.js validar() y validarConductor()).
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_conductor INTEGER DEFAULT 0;
    -- Estado de la SOLICITUD para publicar viajes, aparte del estado_validacion general de la
    -- cuenta (que sigue siendo sobre la identidad: DNI, selfie, teléfono, email). Null = nunca la
    -- pidió; 'pendiente'/'aprobado'/'rechazado' una vez que carga la documentación de conductor
    -- desde "Mi perfil" (ver server/routes/usuarios.js solicitarConductor()) — mismo patrón de
    -- revisión manual que ya existe para el alta de una cuenta nueva.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS conductor_estado_validacion TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS conductor_motivo_rechazo TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS conductor_solicitado_at TEXT;

    -- Aceptación de Términos y Condiciones/Reglas de la Ruta/Política de Privacidad al registrarse
    -- (08 sep 2026, a pedido explícito del usuario: "a la hora de alguien crearse algún usuario,
    -- acepta nuestros términos y condiciones no? hace que lo acepten sí o sí o si no que no se
    -- puedan y que se guarde esto"). Hasta este cambio el checkbox del wizard de registro
    -- ("Leí y acepto los Términos y Condiciones...") solo se validaba del lado del cliente
    -- (js/views.js validarPaso()) — nunca se chequeaba en el servidor (así que alguien podía saltarlo
    -- llamando directo a la API) NI se guardaba en ningún lado, así que no había ningún registro real
    -- de que la cuenta lo aceptó. Ahora registrar() (server/routes/usuarios.js) RECHAZA el alta si
    -- "acepta_reglas" no viene en true en el body, y graba la aceptación acá:
    --   - acepta_terminos: 1 para toda cuenta nueva de acá en adelante (siempre 1, nunca se guarda una
    --     cuenta con esto en 0 — si no aceptó, el registro directamente se rechaza).
    --   - acepta_terminos_at: fecha/hora exacta del alta (mismo timestamp que created_at), para tener
    --     constancia de CUÁNDO se aceptó, no solo que se aceptó.
    -- Cuentas registradas ANTES de este cambio quedan con estos dos campos en NULL/0 — no hay forma de
    -- reconstruir retroactivamente si esas cuentas aceptaron o no (el checkbox existía en el wizard
    -- desde antes, pero nunca se guardó la respuesta), así que no se migra nada acá a propósito; NULL
    -- en acepta_terminos_at para una cuenta vieja se interpreta como "de antes de este control".
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acepta_terminos INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS acepta_terminos_at TEXT;

    -- Documentación de conductor simplificada: seguro y VTV pasan de "subir un comprobante" a una
    -- DECLARACIÓN firmada (16 sep 2026, a pedido explícito del usuario: "al conductor solo le
    -- pedimos a la hora de inscribirse, dni, licencia de conducir y foto, nada mas. pero despues que
    -- firme que tiene seguro y vtv al dia" — decidido junto con el usuario vía AskUserQuestion que
    -- la cédula del auto TAMBIÉN se saca del registro, y que esta declaración se muestra en la ficha
    -- de cada viaje publicado para que la vea el pasajero). De acá en adelante, registrar("conductor")
    -- y solicitarConductor() (server/routes/usuarios.js) YA NO piden doc_cedula_frente/dorso,
    -- doc_seguro, doc_vtv ni vtv_vencimiento — piden en cambio que tilde este checkbox. Las columnas
    -- viejas de cédula/seguro/VTV (arriba, y las de compatibilidad "doc_licencia"/"doc_cedula" del 27
    -- ago 2026) NO se borran ni se tocan — una cuenta de conductor registrada ANTES de este cambio ya
    -- tiene esos documentos subidos y revisados, así que siguen siendo válidos y visibles para el
    -- admin tal cual estaban; simplemente no se le vuelve a pedir nada nuevo con este formato.
    --   - declara_seguro_vtv_al_dia: 1 si el conductor tildó el checkbox al registrarse o al pedir la
    --     capacidad de conductor desde "Mi perfil" — obligatorio para poder ser conductor de acá en
    --     adelante, mismo criterio que acepta_terminos arriba (si no lo tilda, el alta se rechaza).
    --   - declara_seguro_vtv_al_dia_at: fecha/hora exacta de la declaración.
    -- Cuentas de conductor ya aprobadas ANTES de este cambio quedan con estos dos campos en NULL/0 —
    -- no se migra nada retroactivamente (ya tienen sus documentos de seguro/VTV subidos de antes,
    -- que es una constancia más fuerte que una simple declaración) — mismo criterio ya usado para
    -- acepta_terminos.
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS declara_seguro_vtv_al_dia INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS declara_seguro_vtv_al_dia_at TEXT;

    -- "Busco viaje" (15 sep 2026, a pedido explícito del usuario: "quiero una sección donde los
    -- pasajeros puedan publicar que buscan viaje, en una fecha exacta o rango de fechas, que solo
    -- elijan las ciudades, no el punto de encuentro... estos viajes lo pueden agarrar los
    -- conductores... pasajero publica, conductor ofrece viaje... y pasajero acepta") — flujo
    -- INVERSO al de siempre: hasta ahora solo el conductor publicaba un viaje con fecha/hora/precio
    -- fijos y el pasajero reservaba (ver "reservas" más abajo). Acá el PASAJERO publica que busca
    -- viaje (solo ciudades + fecha exacta o rango, sin punto de encuentro — eso lo define el viaje
    -- real del conductor más adelante) y son los CONDUCTORES los que ofrecen. Fecha exacta se
    -- guarda con fecha_desde = fecha_hasta.
    --
    -- Decisión de concurrencia (elegida por el usuario vía AskUserQuestion, 15 sep 2026): pueden
    -- ofrecer VARIOS conductores a la vez a la misma búsqueda — el pasajero ve todas las ofertas y
    -- elige una; al aceptar, las demás ofertas pendientes de esa búsqueda se rechazan solas y la
    -- búsqueda se cierra (ver aceptarOferta() en server/routes/busquedas.js).
    CREATE TABLE IF NOT EXISTS busquedas_pasajero (
      id TEXT PRIMARY KEY,
      pasajero_id TEXT NOT NULL REFERENCES usuarios(id),
      origen_ciudad TEXT NOT NULL,
      destino_ciudad TEXT NOT NULL,
      fecha_desde TEXT NOT NULL,
      fecha_hasta TEXT NOT NULL,
      asientos_necesarios INTEGER NOT NULL DEFAULT 1,
      estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada','cancelada')),
      created_at TEXT NOT NULL
    );

    -- Una oferta = un conductor dice "yo te llevo" ofreciendo un viaje PUNTUAL suyo (ya publicado de
    -- antes, o uno nuevo que publica para esto — ver ofrecer() en server/routes/busquedas.js) para
    -- la búsqueda de un pasajero. viaje_id nunca es null: toda oferta está atada a un viaje real de
    -- siempre, con su propio precio/punto de encuentro/ciudades intermedias ya calculados — así esta
    -- feature nueva reutiliza 100% del motor de precios y de "reservas" que ya existe, en vez de
    -- inventar un cálculo de precio paralelo.
    CREATE TABLE IF NOT EXISTS ofertas_conductor (
      id TEXT PRIMARY KEY,
      busqueda_id TEXT NOT NULL REFERENCES busquedas_pasajero(id),
      conductor_id TEXT NOT NULL REFERENCES usuarios(id),
      viaje_id TEXT NOT NULL REFERENCES viajes(id),
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptada','rechazada','cancelada')),
      created_at TEXT NOT NULL,
      actualizado_at TEXT
    );

    CREATE TABLE IF NOT EXISTS movimientos_cuenta (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id),
      tipo TEXT NOT NULL CHECK (tipo IN ('debito_cancelacion', 'credito_pago')),
      monto NUMERIC NOT NULL,
      motivo TEXT,
      viaje_id TEXT REFERENCES viajes(id),
      comprobante TEXT,
      estado TEXT NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'pendiente_revision', 'rechazado')),
      created_at TEXT NOT NULL,
      confirmado_at TEXT
    );

    -- Cache de distancias consultadas a Google Maps (server/maps.js) para pares de ciudades que no
    -- son "La Plata ↔ X" (esos siguen la tabla curada a mano de arriba). ciudad_a/ciudad_b siempre
    -- se guardan en orden alfabético para que "Tandil,Bolívar" y "Bolívar,Tandil" compartan la misma
    -- fila y no se pague dos veces la misma consulta. Sin fecha de vencimiento: la distancia entre
    -- dos ciudades no cambia, así que el cache no necesita refrescarse.
    CREATE TABLE IF NOT EXISTS distancias_cache (
      ciudad_a TEXT NOT NULL,
      ciudad_b TEXT NOT NULL,
      km NUMERIC NOT NULL,
      fuente TEXT NOT NULL DEFAULT 'google_maps',
      created_at TEXT NOT NULL,
      PRIMARY KEY (ciudad_a, ciudad_b)
    );
  `);

  const defaults = [
    ["precio_nafta_super", "1450"],
    ["peaje_default_ruta5_226", "3200"],
    ["comision_plataforma_pct", "10"],
    ["comision_minima", "2000"],
    // Consumo de referencia: vuelta a 10 litros cada 100km (a pedido explícito del usuario, 08 sep
    // 2026, segunda vuelta del mismo día: "Siento caro el viaje, nafta super a 10 litros por km, mas
    // no!" — revierte el cambio a 12 de más temprano ese mismo día). Ver
    // migrarConsumoNafta08Sep2026SegundaVuelta() más abajo para la corrección del valor ya sembrado
    // en bases que ya habían arrancado con 12 (los seeds usan ON CONFLICT DO NOTHING, así que cambiar
    // el default acá no alcanza solo).
    ["consumo_litros_100km", "10"],
    ["tolerancia_ajuste_pct", "15"],
    // Piso mínimo de precio por asiento: nunca menos de $12.000 (tarifa mínima para trayectos
    // cortos, hasta ~230 km) ni menos de $52 por km recorrido — 500 km da exactamente $26.000.
    // Se aplica el mayor entre el piso y el cálculo por costo real (nafta + peajes / asientos).
    ["precio_minimo_por_km", "52"],
    ["precio_minimo_base", "12000"],
    // Distancia y peaje estimados de La Plata a cada ciudad del corredor (ver api/corredor.js).
    // Guardado como JSON en un solo registro de config; editable desde el panel de admin.
    ["distancias_corredor", JSON.stringify(DISTANCIAS_DEFAULT)],
    // Penalización a la cuenta corriente del conductor cuando cancela un viaje con reservas ya
    // pagadas (compensa la comisión de Mercado Pago que se pierde al reembolsar). Dos montos según
    // el aviso: menos de 24 hs antes de la salida, o 24 hs o más. Editable desde el panel de admin.
    ["penalizacion_cancelacion_menos24hs", "3000"],
    ["penalizacion_cancelacion_mas24hs", "1000"],
    // Tope de saldo deudor: por encima de este monto, el conductor no puede publicar viajes nuevos
    // hasta que el admin le confirme que pagó la deuda. Editable desde el panel de admin.
    ["tope_saldo_deudor", "20000"],
    // Peaje ESTIMADO por km para pares de ciudades que no son "La Plata ↔ X" (esos usan el peaje
    // curado a mano de distancias_corredor) — Google Maps no informa costo de peajes, así que se
    // estima como km × este valor. Corregido el 24 ago 2026 (a pedido explícito del usuario: "sacalo
    // de ruta 0... estan mucho mas baratos de lo que realmente valen") — antes eran $9/km, sacados
    // del promedio de la vieja tabla curada (que también estaba desactualizada). El nuevo valor sale
    // del promedio ponderado por km de 13 rutas reales desde La Plata verificadas contra
    // www.ruta0.com/ruta/argentina/ el 24 ago 2026 (de $248.442 en peajes reales sobre 4.258 km
    // reales ≈ $58/km) — sigue siendo una ESTIMACIÓN de referencia, no un cálculo real por ruta:
    // los peajes de verdad son un monto fijo por cabina, no proporcional al km, así que este valor
    // puede quedar corto en trayectos cortos con una cabina cara cerca (ej. La Plata-Chascomús, 77
    // km con una cabina de $7.900, da ~$103/km real) o largo en rutas sin ninguna cabina (ej. Rauch,
    // $0 real). La tabla curada de arriba (distancias_corredor) sí tiene el monto real por ciudad
    // para el corredor conocido — esto es solo el respaldo genérico para cualquier otro par de
    // ciudades. Editable desde el panel de admin (Valores de referencia).
    ["peaje_por_km_estimado", "58"],
    // Cancelaciones consecutivas de un conductor (viajes publicados que canceló uno atrás del otro,
    // sin ninguno completado/activo en el medio): a partir de este número se le muestra una alerta
    // al admin en el panel; al llegar al de suspensión, se lo suspende automáticamente (no puede
    // publicar viajes nuevos hasta que el admin lo reactive a mano). Editable desde el panel admin.
    ["alerta_cancelaciones_consecutivas", "2"],
    ["suspension_cancelaciones_consecutivas", "3"],
    // Datos de cobro de la PLATAFORMA (no de un usuario): adónde transfieren pasajeros (comisión) y
    // conductores (cuenta corriente) — se muestran directo en pantalla en vez de "te lo pasamos por
    // WhatsApp". Cargados a pedido del usuario (19 ago 2026). Editables desde el panel de admin, se
    // exponen sin necesidad de estar logueado vía GET /api/config/cobro (server/routes/admin.js
    // datosCobro) porque cualquier pasajero/conductor sin sesión de admin necesita verlos.
    ["alias_cobro_plataforma", "michel.venier"],
    ["titular_cobro_plataforma", "Michel Venier"],
    ["cuil_cobro_plataforma", "23-38363856-9"],
  ];
  for (const [clave, valor] of defaults) {
    await run(`INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO NOTHING`, [clave, valor]);
  }

  await migrarPeajesReales24Ago2026();
  await migrarPeajesReales25Ago2026();
  await migrarPeajesReales01Sep2026();
  await migrarRolDual07Sep2026();
  await migrarAutoAprobarPasajeros07Sep2026();
  await migrarVariantesRuta07Sep2026();
  await migrarConsumoNafta08Sep2026();
  await migrarConsumoNafta08Sep2026SegundaVuelta();
}

// Migración puntual (24 ago 2026) — a pedido explícito del usuario: "sacalo de ruta 0, mantenelo
// actualizado... estan mucho mas baratos de lo que realmente valen". Los `defaults` de arriba solo
// sirven para una base NUEVA (por el ON CONFLICT DO NOTHING) — en la base que ya está en producción,
// "distancias_corredor" y "peaje_por_km_estimado" quedaron guardados con los valores viejos y nunca
// se actualizan solos aunque se cambie el código. Esta función los corrige en cualquier base que
// todavía tenga EXACTAMENTE el valor viejo (comparación 1 a 1) — si el admin ya lo cambió a mano
// desde el panel, ese valor se respeta y no se toca. Corre en cada arranque en frío; después de la
// primera vez que corre en una base ya no tiene efecto, porque los valores dejan de coincidir con los
// viejos. Fuente de los valores nuevos: www.ruta0.com/ruta/argentina/ (calculadora de ruta real, con
// el detalle de cada cabina de peaje), consultada el 24 ago 2026 — ver
// claude/ruta-compartida-status.md (proyecto de Claude) para el detalle ruta por ruta.
const PEAJES_VIEJOS_24AGO2026 = {
  "Chascomús": 800,
  "Rauch": 1600,
  "Tandil": 2400,
  "Balcarce": 2800,
  "Necochea": 3200,
  "Luján": 1800,
  "Chivilcoy": 2600,
  "Bragado": 3000,
  "Carlos Casares": 3600,
  "Pehuajó": 3800,
  "Trenque Lauquen": 4200,
  "Santa Rosa": 5500,
  "Saladillo": 1900,
};
const PEAJES_NUEVOS_24AGO2026 = {
  "Chascomús": 7900,
  "Rauch": 0,
  "Tandil": 15800,
  "Balcarce": 15800,
  "Necochea": 15800,
  "Luján": 24806,
  "Chivilcoy": 26306,
  "Bragado": 26306,
  "Carlos Casares": 27806,
  "Pehuajó": 27806,
  "Trenque Lauquen": 29306,
  "Santa Rosa": 29306,
  "Saladillo": 1500,
};
async function migrarPeajesReales24Ago2026() {
  const filaDistancias = await get("SELECT valor FROM config WHERE clave = 'distancias_corredor'");
  if (filaDistancias) {
    const distancias = JSON.parse(filaDistancias.valor);
    let cambio = false;
    for (const [ciudad, peajeNuevo] of Object.entries(PEAJES_NUEVOS_24AGO2026)) {
      const actual = distancias[ciudad];
      if (actual && actual.peaje === PEAJES_VIEJOS_24AGO2026[ciudad]) {
        distancias[ciudad] = { ...actual, peaje: peajeNuevo };
        cambio = true;
      }
    }
    if (cambio) {
      await run("UPDATE config SET valor = ? WHERE clave = 'distancias_corredor'", [JSON.stringify(distancias)]);
    }
  }

  const filaPeajeKm = await get("SELECT valor FROM config WHERE clave = 'peaje_por_km_estimado'");
  if (filaPeajeKm && filaPeajeKm.valor === "9") {
    await run("UPDATE config SET valor = ? WHERE clave = 'peaje_por_km_estimado'", ["58"]);
  }
}

// Migración puntual (25 ago 2026) — segunda vuelta, a pedido explícito del usuario: "No me estás
// sacando bien los peajes, de pehuajo a la plata si, pero ponele alvear no, en un viaje corto, sacalos
// de ruta 0". Corrige las tres ciudades que el 24 ago 2026 habían quedado sin verificar (esta vez sí
// se pudo, usando el sufijo "-ba" en la URL de Ruta0 para desambiguar "Mercedes" y "General Alvear" de
// homónimas en otras provincias). Mismo patrón que la migración de arriba: solo pisa el valor si
// todavía coincide EXACTO con el viejo, para respetar cualquier edición manual del admin. "Bolívar"
// sigue sin poder verificarse — no está en esta migración, queda con el valor original hasta que se
// consiga un dato real.
const PEAJES_VIEJOS_25AGO2026 = {
  "Mercedes": 2200,
  "9 de Julio": 3400,
  "General Alvear": 2500,
};
const PEAJES_NUEVOS_25AGO2026 = {
  "Mercedes": 26306,
  "9 de Julio": 27806,
  "General Alvear": 1500,
};
async function migrarPeajesReales25Ago2026() {
  const filaDistancias = await get("SELECT valor FROM config WHERE clave = 'distancias_corredor'");
  if (!filaDistancias) return;
  const distancias = JSON.parse(filaDistancias.valor);
  let cambio = false;
  for (const [ciudad, peajeNuevo] of Object.entries(PEAJES_NUEVOS_25AGO2026)) {
    const actual = distancias[ciudad];
    if (actual && actual.peaje === PEAJES_VIEJOS_25AGO2026[ciudad]) {
      distancias[ciudad] = { ...actual, peaje: peajeNuevo };
      cambio = true;
    }
  }
  if (cambio) {
    await run("UPDATE config SET valor = ? WHERE clave = 'distancias_corredor'", [JSON.stringify(distancias)]);
  }
}

// Migración puntual (01 sep 2026) — refresco mensual de peajes, a pedido del usuario: "actualizame lo
// de los peajes... chequea y actualiza todo que algunos los veo sobrevaluados". Corrige "Bolívar"
// (verificado por primera vez, buscando como "San Carlos de Bolívar") y "Santa Rosa" (que venía
// agrupada con Trenque Lauquen a un valor mucho más alto que el real — ver el comentario en
// server/corredor.js DISTANCIAS_DEFAULT para el detalle de la ruta y la asimetría de sentido
// encontrada en Ruta0). Mismo patrón que las migraciones anteriores: solo pisa el valor si todavía
// coincide EXACTO con el viejo, para respetar cualquier edición manual del admin.
const PEAJES_VIEJOS_01SEP2026 = {
  "Bolívar": 4000,
  "Santa Rosa": 29306,
};
const PEAJES_NUEVOS_01SEP2026 = {
  "Bolívar": 1500,
  "Santa Rosa": 4500,
};
async function migrarPeajesReales01Sep2026() {
  const filaDistancias = await get("SELECT valor FROM config WHERE clave = 'distancias_corredor'");
  if (!filaDistancias) return;
  const distancias = JSON.parse(filaDistancias.valor);
  let cambio = false;
  for (const [ciudad, peajeNuevo] of Object.entries(PEAJES_NUEVOS_01SEP2026)) {
    const actual = distancias[ciudad];
    if (actual && actual.peaje === PEAJES_VIEJOS_01SEP2026[ciudad]) {
      distancias[ciudad] = { ...actual, peaje: peajeNuevo };
      cambio = true;
    }
  }
  if (cambio) {
    await run("UPDATE config SET valor = ? WHERE clave = 'distancias_corredor'", [JSON.stringify(distancias)]);
  }
}

// Migración puntual (07 sep 2026) — a pedido explícito del usuario: "Quiero que todos los usuarios
// puedan modificar sus datos de contacto y que puedan ser conductores y pasajeros". Habilita
// AUTOMÁTICAMENTE la mitad "fácil" del rol dual: todo conductor que YA estaba aprobado pasa a poder
// también reservar viajes como pasajero (ya tiene todos los datos que hacen falta — DNI, selfie,
// teléfono, email — no le falta nada nuevo). La mitad inversa (un pasajero que además quiere
// publicar viajes) NO se habilita sola porque le falta documentación real (licencia, cédula,
// seguro, VTV, auto) — esa persona tiene que pedirlo desde "Mi perfil" y pasar la misma revisión
// manual que cualquier alta nueva (ver solicitarConductor() en server/routes/usuarios.js).
// Solo toca cuentas que todavía no pasaron por esto (conductor_estado_validacion IS NULL), para no
// pisar nunca una decisión posterior del admin — corre en cada arranque en frío pero después de la
// primera vez ya no encuentra filas para tocar.
async function migrarRolDual07Sep2026() {
  await run(
    `UPDATE usuarios SET es_conductor = 1, conductor_estado_validacion = 'aprobado'
     WHERE rol = 'conductor' AND estado_validacion = 'aprobado' AND conductor_estado_validacion IS NULL`
  );
}

// Migración puntual (07 sep 2026) — a pedido explícito del usuario: "Quiero que EL ROL DE PASAJERO SE
// AUTORICE SOLO, CON LAS FOTOS QUE SUBA el pasajero, despues que la informacion se guarde como
// siempre". Desde este cambio, server/routes/usuarios.js registrar("pasajero") ya inserta la cuenta
// nueva directo con estado_validacion = 'aprobado' (ver esa función) — esta migración es solo para
// no dejar colgadas a mitad de camino a las cuentas de pasajero que ya estaban registradas ANTES de
// este cambio y todavía seguían "pendiente" de que el admin las revisara a mano: pasan a 'aprobado'
// una sola vez. A los CONDUCTORES no los toca — su identidad y su documentación de vehículo siguen
// necesitando la revisión manual de siempre (ver migrarRolDual07Sep2026 arriba, que es la que sigue
// habilitando la mitad "conductor ya aprobado" del rol dual). Corre en cada arranque en frío, pero
// después de la primera vez ya no encuentra ninguna fila que tocar (todo pasajero nuevo entra directo
// 'aprobado' y nunca vuelve a quedar en 'pendiente').
async function migrarAutoAprobarPasajeros07Sep2026() {
  await run(`UPDATE usuarios SET estado_validacion = 'aprobado' WHERE rol = 'pasajero' AND estado_validacion = 'pendiente'`);
}

// Migración puntual (07 sep 2026) — a pedido explícito del usuario: "pero si voy por saladillo no
// tengo esos peajes!!". El seed inicial de "distancias_corredor" (ver arriba, ["distancias_corredor",
// JSON.stringify(DISTANCIAS_DEFAULT)]) guardó una FOTO completa de DISTANCIAS_DEFAULT en la base el
// día que se creó — así que agregar el campo nuevo "variantes" a una ciudad en el CÓDIGO (ver
// server/corredor.js, la variante "vía Saladillo" de Pehuajó) no alcanza para que la app lo use en
// producción: server/pricing.js getDistanciasCorredor() hace `{ ...DISTANCIAS_DEFAULT, ...guardado }`,
// y como "guardado" ya trae su propia entrada completa para Pehuajó (sin variantes), esa entrada
// gana y la de arriba con variantes nunca se ve — mismo problema de fondo que ya pasó con
// peaje_por_km_estimado y con cada corrección de peaje anterior (24/25 ago, 01 sep 2026), ver esas
// migraciones arriba. Esta migración copia el array "variantes" de DISTANCIAS_DEFAULT hacia la fila
// ya guardada en la base, PERO SOLO para las ciudades a las que todavía les falta (nunca pisa
// km/peaje de ninguna ciudad, ni una variante que el admin ya haya guardado a mano en algún
// momento) — así conserva cualquier edición manual y es 100% aditiva. Corre en cada arranque en frío,
// pero después de la primera vez ya no encuentra ninguna ciudad a la que agregarle nada.
async function migrarVariantesRuta07Sep2026() {
  const filaDistancias = await get("SELECT valor FROM config WHERE clave = 'distancias_corredor'");
  if (!filaDistancias) return;
  const distancias = JSON.parse(filaDistancias.valor);
  let cambio = false;
  for (const [ciudad, datosDefault] of Object.entries(DISTANCIAS_DEFAULT)) {
    if (!datosDefault.variantes) continue; // esta ciudad no tiene ninguna variante cargada en el código
    if (!distancias[ciudad] || distancias[ciudad].variantes) continue; // no existe, o ya la tiene (propia o de una corrida anterior)
    distancias[ciudad] = { ...distancias[ciudad], variantes: datosDefault.variantes };
    cambio = true;
  }
  if (cambio) {
    await run("UPDATE config SET valor = ? WHERE clave = 'distancias_corredor'", [JSON.stringify(distancias)]);
  }
}

// Migración puntual (08 sep 2026) — a pedido explícito del usuario: "QUIERO QUE ME MODIFIQUES Y
// PONGAS 12 LITROS DE NAFTA CADA 100KM". Mismo patrón que la corrección de peaje_por_km_estimado
// (ver migrarPeajesReales24Ago2026 arriba): el seed de "consumo_litros_100km" usa ON CONFLICT DO
// NOTHING, así que una base que ya arrancó antes de este cambio se queda con el valor viejo aunque
// el default del código ya diga "12" — esta migración fuerza el UPDATE, pero SOLO si el valor
// guardado todavía coincide EXACTO con el viejo default ("10"), para respetar cualquier edición
// manual que el admin ya haya hecho desde el panel. Corre en cada arranque en frío, pero después de
// la primera vez ya no encuentra nada para tocar.
async function migrarConsumoNafta08Sep2026() {
  const fila = await get("SELECT valor FROM config WHERE clave = 'consumo_litros_100km'");
  if (fila && fila.valor === "10") {
    await run("UPDATE config SET valor = ? WHERE clave = 'consumo_litros_100km'", ["12"]);
  }
}

// Migración puntual (08 sep 2026, segunda vuelta del mismo día) — a pedido explícito del usuario:
// "Siento caro el viaje, nafta super a 10 litros por km, mas no!" — revierte el cambio de la
// migración de arriba (que había puesto 12) de vuelta a 10. Mismo patrón: fuerza el UPDATE, pero
// SOLO si el valor guardado todavía coincide EXACTO con "12" (el valor que dejó la migración
// anterior), para respetar cualquier edición manual que el admin haya hecho mientras tanto desde el
// panel. Corre en cada arranque en frío; después de la primera vez ya no encuentra nada para tocar.
async function migrarConsumoNafta08Sep2026SegundaVuelta() {
  const fila = await get("SELECT valor FROM config WHERE clave = 'consumo_litros_100km'");
  if (fila && fila.valor === "12") {
    await run("UPDATE config SET valor = ? WHERE clave = 'consumo_litros_100km'", ["10"]);
  }
}

module.exports = { prepare, run, get, all, exec, initSchema, getPool };
