// legal.js — Contenido legal y de ayuda ("Reglas de la Ruta" + preguntas frecuentes).
// Basado en el encuadre jurídico definido para Viaje Compartido, con agregados
// inspirados en las políticas públicas de BlaBlaCar y Subite.com.ar (cancelación,
// pagos, calificaciones) para completar los puntos que la comunidad espera encontrar.

const LEGAL_SECTIONS = [
  {
    titulo: "1. Qué es Viaje Compartido (y qué NO es)",
    html: `
      <p><strong>Viaje Compartido es una plataforma de economía colaborativa.</strong> Nuestro objeto social es la
      <strong>intermediación tecnológica y administrativa</strong> para facilitar el transporte compartido entre particulares,
      con el único fin de que quienes ya hacen un trayecto puedan compartir sus gastos con quienes necesitan viajar en esa misma dirección.</p>
      <p><strong>No somos una empresa de transporte, ni de pasajeros ni de encomiendas.</strong> No poseemos vehículos, no contratamos
      conductores, no fijamos rutas y no ejecutamos ningún viaje. Los conductores son usuarios particulares que ya iban a hacer ese trayecto
      por motivos propios y decidan compartir asientos libres de su vehículo.</p>
      <p>Nuestro rol se limita a: <strong>conectar</strong> la oferta de asientos con la demanda de traslado, <strong>validar</strong> la
      documentación que declaran los usuarios para fomentar un viaje más seguro, y <strong>sugerir</strong> un importe de referencia calculado
      en base al gasto real de combustible y peajes del trayecto — nunca una tarifa comercial.</p>
      <h4>Misión</h4>
      <p>Reducir el costo de viajar entre La Plata y las localidades del corredor de las Rutas 5 y 226, conectando a quienes hacen ese
      camino con quienes necesitan sumarse, de forma simple, segura y sin fines de lucro para el conductor.</p>
      <h4>Alcance geográfico (fase inicial)</h4>
      <p>Trayectos con origen o destino en la ciudad de La Plata, conectando con las ciudades intermedias de la Ruta 5 y la Ruta 226.
      Iremos ampliando la cobertura a medida que la comunidad crezca.</p>
    `,
  },
  {
    titulo: "2. Lo que hacemos y lo que no hacemos",
    html: `
      <p><strong>Lo que hacemos:</strong></p>
      <ul>
        <li><strong>Intermediación:</strong> conectamos la oferta de asientos disponibles con la demanda de traslado.</li>
        <li><strong>Validación:</strong> revisamos la documentación que cada usuario declara al registrarse, como medida de mitigación de riesgo.</li>
        <li><strong>Cálculo de gastos:</strong> sugerimos un importe por asiento en base a nafta y peajes, con un tope que impide que el conductor gane dinero con el viaje.</li>
      </ul>
      <p><strong>Lo que NO hacemos ni garantizamos (leé esto con atención):</strong></p>
      <ul>
        <li><strong>Responsabilidad civil y siniestralidad:</strong> no asumimos responsabilidad alguna por daños materiales, físicos o
        perjuicios derivados de accidentes de tránsito, colisiones o cualquier siniestro vial. Esa responsabilidad recae íntegramente en el
        titular del vehículo y su seguro obligatorio.</li>
        <li><strong>Comportamiento de los usuarios:</strong> no somos responsables por conductas, agresiones (físicas o verbales), hurtos
        o cualquier hecho ilícito entre usuarios durante el trayecto. La validación de documentación mitiga el riesgo, pero no garantiza el
        comportamiento personal de nadie.</li>
        <li><strong>Incumplimientos de hecho:</strong> no nos responsabilizamos por demoras, cancelaciones de último momento del conductor,
        que el pasajero no se presente, ni por la pérdida o daño de equipaje y objetos personales.</li>
        <li><strong>Estado mecánico del vehículo:</strong> no garantizamos el mantenimiento del auto. La VTV vigente que declara el
        conductor es una <strong>declaración jurada</strong> ante la plataforma, no una verificación técnica nuestra.</li>
        <li><strong>Relación laboral:</strong> se excluye cualquier vínculo laboral o de dependencia con los conductores. Son usuarios
        particulares compartiendo gastos de un trayecto propio, no transportistas contratados por Viaje Compartido.</li>
      </ul>
      <p class="muted">Este resumen tiene fines informativos y de transparencia con la comunidad; no reemplaza el asesoramiento de un
      profesional legal ante una situación puntual.</p>
    `,
  },
  {
    titulo: "3. Quién puede sumarse: conductores y pasajeros",
    html: `
      <h4>Conductor</h4>
      <p>Es el usuario que realiza el trayecto por cuenta propia y decide compartir sus asientos disponibles. Para habilitarse necesita
      presentar:</p>
      <ul>
        <li>DNI (frente y dorso) y una selfie sosteniéndolo junto a su cara.</li>
        <li>Licencia de conducir vigente.</li>
        <li>Cédula verde o azul que autorice el vehículo a circular.</li>
        <li>Póliza de seguro vigente.</li>
        <li>Declaración jurada de VTV vigente.</li>
      </ul>
      <h4>Pasajero</h4>
      <p>Es el usuario que necesita trasladarse y se suma al trayecto del conductor. Para habilitarse necesita:</p>
      <ul>
        <li>Nombre, apellido y DNI (frente y dorso) validados.</li>
        <li>Selfie de reconocimiento facial.</li>
        <li>Celular verificado (usamos WhatsApp para avisos).</li>
        <li>Correo electrónico.</li>
      </ul>
      <p>Revisamos cada perfil manualmente antes de habilitarlo. Es un proceso de cuidado de la comunidad, no una garantía absoluta de
      buena conducta de cada persona.</p>
    `,
  },
  {
    titulo: "4. Cómo funciona un viaje, paso a paso",
    html: `
      <h4>4.1 Publicación</h4>
      <p>El conductor completa punto de partida exacto, ciudad de destino, ciudades intermedias (para que aparezca en búsquedas de tramos
      parciales), horario de salida, horario estimado de llegada, fecha, precio, asientos disponibles y sus preferencias de convivencia
      (mascotas, equipaje grande, fumar, charla o silencio, música).</p>
      <h4>4.2 Búsqueda y reserva</h4>
      <p>El pasajero busca por origen, destino y fecha. Ve las opciones disponibles con toda la información del viaje y selecciona la que
      le sirve. Al reservar, se envía la solicitud al conductor, quien puede <strong>aceptarla o rechazarla</strong>. Si la acepta, se
      habilitan los datos de contacto entre ambas partes para coordinar el punto de encuentro exacto.</p>
      <h4>4.3 Pago</h4>
      <p>El pago se realiza <strong>dentro de la app</strong>, una vez que el conductor aceptó la reserva. Viaje Compartido retiene un
      <strong>10% de comisión</strong> sobre el monto total como costo de intermediación y validación; el resto queda acreditado al
      conductor una vez finalizado el viaje.</p>
      <h4>4.4 Ejecución y cierre</h4>
      <p>Al finalizar el trayecto, ambas partes califican su experiencia (puntuación general, habilidad de manejo, comodidad, etc.). Las
      calificaciones quedan visibles en el perfil público de cada usuario y ayudan a construir confianza en la comunidad.</p>
      <h4>4.5 Cancelaciones y demoras</h4>
      <ul>
        <li>El pasajero debe llegar al punto de encuentro <strong>5 minutos antes</strong> del horario de salida. Hay una tolerancia de
        <strong>10 minutos</strong>; pasado ese tiempo, el conductor puede iniciar el viaje y el pasajero pierde el lugar y la contribución
        abonada.</li>
        <li>Si el pasajero cancela con <strong>más de 24 horas</strong> de anticipación, recupera el 100% de lo abonado.</li>
        <li>Si cancela dentro de las <strong>24 horas previas</strong>, recupera el 50%, salvo que la cancelación sea dentro de los
        <strong>30 minutos</strong> de haber confirmado la reserva (en ese caso, reembolso total).</li>
        <li>Si es el <strong>conductor</strong> quien cancela, los pasajeros con reserva confirmada reciben el <strong>reembolso total</strong>,
        sin excepciones.</li>
      </ul>
    `,
  },
  {
    titulo: "5. Cómo se calcula el precio (y por qué nadie puede lucrar)",
    html: `
      <p>El objetivo de este mecanismo es simple: el conductor solo recupera una parte de <strong>lo que ese viaje le cuesta</strong>,
      nunca genera una ganancia extra por llevar pasajeros.</p>
      <h4>Valor de referencia</h4>
      <p>Tomamos el precio de referencia de la nafta súper (promedio de estaciones de bandera) y los peajes vigentes en las rutas
      habilitadas. Actualizamos estos valores de forma quincenal o mensual, o antes si hay saltos bruscos de precio. Quedan
      <strong>excluidos</strong> del cálculo la amortización del vehículo, el seguro y la patente, por ser costos fijos del propietario que
      no varían por llevar o no acompañantes.</p>
      <h4>Algoritmo</h4>
      <p>Consumo estimado: 10 litros cada 100 km (auto naftero estándar). Con eso calculamos:</p>
      <ul>
        <li><strong>Litros totales</strong> = (distancia en km / 100) × 10</li>
        <li><strong>Costo de combustible</strong> = litros totales × precio de la nafta súper</li>
        <li><strong>Costo Total del Viaje (C.T.O.)</strong> = costo de combustible + peajes vigentes</li>
        <li><strong>Valor por asiento sugerido</strong> = C.T.O. / 4 (1 conductor + 3 asientos)</li>
      </ul>
      <h4>Techo Operativo (C.T.O.) — la Regla de Oro</h4>
      <p>La suma de las contribuciones de <strong>todos</strong> los pasajeros confirmados nunca puede superar el 100% del C.T.O. del
      trayecto. Es un techo inamovible que calcula el sistema, no el conductor.</p>
      <h4>Rango de ajuste (±15%)</h4>
      <p>El conductor puede ajustar el precio sugerido hasta un <strong>15% hacia arriba</strong> (para compensar, por ejemplo, un motor
      que consume más o equipaje pesado que suba el consumo), siempre que la recaudación total no rompa el Techo Operativo.</p>
      <h4>Bloqueo de sobrecarga</h4>
      <p>La plataforma limita la oferta a un máximo de <strong>3 asientos</strong> por trayecto. Si el conductor decide ofrecer el
      cuarto asiento (completando el auto al 100% de su capacidad), el sistema <strong>reprorratea automáticamente</strong> el costo
      entre 5 personas (conductor + 4 pasajeros) en vez de 4, bajando el precio por asiento para que lo recaudado en total siga
      representando solo el costo real de la nafta y los peajes.</p>
    `,
  },
  {
    titulo: "6. Derechos y obligaciones del conductor",
    html: `
      <ul>
        <li><strong>Documentación y seguridad:</strong> el vehículo debe tener VTV vigente, cédula correspondiente y seguro con cobertura
        a terceros. Debe respetar las velocidades máximas de la ruta.</li>
        <li><strong>Estado de la unidad:</strong> mantenimiento básico al día (luces, frenos, neumáticos en condiciones para ruta). No se
        permite viajar con la rueda de auxilio puesta de forma permanente.</li>
        <li><strong>Hoja de ruta:</strong> se compromete a seguir el trayecto publicado, sin desvíos por trámites personales que
        retrasen al pasajero (salvo emergencia).</li>
        <li><strong>Respeto a lo publicado:</strong> si marcó que acepta mascotas o equipaje de bodega, no puede rechazar al pasajero por
        ese motivo al momento del encuentro.</li>
        <li><strong>Higiene:</strong> el habitáculo debe estar limpio y en condiciones de salubridad para recibir a terceros.</li>
        <li><strong>Prohibiciones:</strong> no fumar dentro del vehículo (salvo acuerdo unánime) ni usar el celular mientras conduce.</li>
      </ul>
    `,
  },
  {
    titulo: "7. Derechos y obligaciones del pasajero",
    html: `
      <ul>
        <li><strong>Veracidad del equipaje:</strong> no presentarse con bultos que excedan lo declarado. Si el viaje se publicó como
        "solo mochila" y el pasajero trae una valija grande, el conductor puede no subirla por falta de espacio.</li>
        <li><strong>Puntualidad:</strong> estar en el punto de encuentro 5 minutos antes del horario de salida. Tras 10 minutos de
        tolerancia, se pierde el lugar y la contribución abonada (ver política de cancelación).</li>
        <li><strong>Respeto:</strong> tratar con respeto al conductor y a los demás pasajeros durante todo el trayecto.</li>
        <li><strong>Calificar con honestidad:</strong> las calificaciones son la base de confianza de la comunidad.</li>
      </ul>
    `,
  },
];

const FAQ_ITEMS = [
  {
    q: "¿Viaje Compartido es una empresa de transporte?",
    a: "No. Somos una plataforma de intermediación: conectamos a conductores que ya hacen un trayecto con pasajeros que quieren compartir gastos en esa misma dirección. No poseemos flota, no contratamos conductores y no ejecutamos el viaje.",
  },
  {
    q: "¿Qué pasa si tenemos un problema durante el viaje?",
    a: "La responsabilidad civil por accidentes, siniestros o conductas entre usuarios no es asumida por la plataforma: recae en el titular del vehículo y su seguro, o en las personas involucradas, según corresponda. Validamos documentación para reducir riesgos, pero eso no es una garantía de comportamiento.",
  },
  {
    q: "¿Cómo se fija el precio del viaje?",
    a: "Lo calcula el sistema en base al gasto real de combustible y peajes del trayecto, dividido entre los asientos del auto. El conductor puede ajustarlo hasta un 15% para arriba, pero nunca puede superar el Techo Operativo del viaje (ver 'Reglas de la Ruta', punto 5).",
  },
  {
    q: "¿Cómo se paga?",
    a: "Se paga dentro de la app, una vez que el conductor aceptó tu solicitud. Viaje Compartido retiene un 10% de comisión por la intermediación y validación; el resto se acredita al conductor cuando el viaje se completa.",
  },
  {
    q: "¿Puedo cancelar una reserva?",
    a: "Sí. Con más de 24 horas de anticipación recuperás el 100%. Dentro de las 24 horas previas, el 50% (salvo que cancelés dentro de los 30 minutos de haber reservado, ahí es 100%). Si cancela el conductor, siempre recibís el reembolso total.",
  },
  {
    q: "¿Qué documentación me piden para registrarme?",
    a: "A todos: DNI, selfie de validación, celular y email. A los conductores además: licencia de conducir, cédula verde/azul, seguro vigente y declaración jurada de VTV. Revisamos cada perfil manualmente y avisamos por WhatsApp en menos de 24 hs.",
  },
  {
    q: "¿Puedo viajar con mascotas o equipaje grande?",
    a: "Depende de cada viaje: el conductor indica al publicarlo si acepta mascotas, equipaje grande, si permite fumar y sus preferencias de charla y música. Elegí el viaje que mejor se adapte a lo que necesitás.",
  },
  {
    q: "¿Qué pasa si llego tarde al punto de encuentro?",
    a: "Hay una tolerancia de 10 minutos desde el horario de salida. Pasado ese tiempo, el conductor puede iniciar el viaje sin vos y no hay reembolso, salvo excepciones ya cubiertas por la política de cancelación.",
  },
  {
    q: "¿Los conductores ganan dinero llevando pasajeros?",
    a: "No debería ser así: el sistema calcula un Techo Operativo que nunca puede superarse con la suma de todas las contribuciones, así que el conductor solo recupera parte de su propio gasto de combustible y peajes, nunca una ganancia extra.",
  },
  {
    q: "¿Hay relación laboral entre Viaje Compartido y los conductores?",
    a: "No. Los conductores son usuarios particulares que comparten gastos de un trayecto propio. No existe vínculo laboral, de dependencia ni de representación entre la plataforma y los conductores o pasajeros.",
  },
];
