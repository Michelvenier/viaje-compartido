// legal.js — Contenido legal de Ruta Compartida, separado en tres documentos:
//   1) TERMINOS_SECTIONS   → Términos y Condiciones (qué es la plataforma, rol de cada parte,
//                            naturaleza no lucrativa del viaje compartido, responsabilidad).
//   2) REGLAS_SECTIONS     → Reglas de la Ruta (cómo funciona un viaje en la práctica: publicar,
//                            reservar, pagar, cancelar, convivencia).
//   3) PRIVACIDAD_SECTIONS → Política de Privacidad (qué datos se recopilan, para qué, con quién
//                            se comparten y cómo ejercer los derechos sobre ellos).
//
// AVISO IMPORTANTE PARA QUIEN OPERE RUTA COMPARTIDA: este texto fue redactado con cuidado para
// describir con precisión lo que la plataforma efectivamente hace, pero no reemplaza la revisión
// de un abogado/a. Antes de operar con usuarios reales conviene que un profesional en Argentina
// revise especialmente: (a) los datos de identificación del titular de la plataforma (razón
// social, CUIT, domicilio) que faltan completar más abajo, (b) la cláusula de transferencia
// internacional de datos si el hosting no está en Argentina, y (c) el encuadre impositivo de la
// comisión que cobra la plataforma.

// ---------------------------------------------------------------------------
// 1) TÉRMINOS Y CONDICIONES
// ---------------------------------------------------------------------------
const TERMINOS_SECTIONS = [
  {
    titulo: "1. Aceptación de estos Términos",
    html: `
      <p>Al registrarse, publicar un viaje, solicitar o confirmar una reserva, o utilizar cualquier funcionalidad de Ruta Compartida, el
      usuario declara haber leído, comprendido y aceptado estos Términos y Condiciones, las <a href="#/reglas-de-la-ruta">Reglas de la
      Ruta</a> y la <a href="#/privacidad">Política de Privacidad</a>, que forman parte integrante de este documento.</p>
      <p>La aceptación de estos Términos no implica renuncia a ningún derecho irrenunciable que la legislación argentina reconozca al
      usuario, en particular en su carácter de consumidor (Ley N° 24.240 de Defensa del Consumidor).</p>
    `,
  },
  {
    titulo: "2. Qué es Ruta Compartida",
    html: `
      <p>Ruta Compartida es una <strong>plataforma tecnológica de intermediación</strong> que pone en contacto a personas particulares
      que proyectan realizar trayectos compatibles, para que puedan coordinar voluntariamente un viaje compartido y distribuir entre
      ellas los gastos asociados a ese trayecto.</p>
      <p>Su finalidad es facilitar el aprovechamiento de asientos disponibles en vehículos particulares cuyos conductores ya iban a
      realizar el trayecto por motivos propios, permitiendo que otras personas que necesitan desplazarse en la misma dirección se sumen
      a ese viaje.</p>
      <p>La actividad del conductor dentro de Ruta Compartida debe tener carácter <strong>particular, ocasional, no profesional y no
      comercial</strong>. El importe que recibe de los pasajeros es exclusivamente una contribución a los gastos del viaje, nunca una
      fuente de ganancia.</p>
    `,
  },
  {
    titulo: "3. Qué hace la plataforma (y qué no hace)",
    html: `
      <p>A través de sus funcionalidades, Ruta Compartida permite: crear perfiles de usuario; publicar y buscar viajes; solicitar y
      aceptar reservas; poner en contacto a conductores y pasajeros una vez confirmada una reserva; calcular una contribución de
      referencia a los gastos del trayecto; realizar determinadas verificaciones documentales; gestionar cancelaciones y reembolsos; y
      permitir que los usuarios se califiquen entre sí.</p>
      <p>La existencia de estas funcionalidades <strong>no implica</strong> que Ruta Compartida organice, dirija, ejecute o supervise
      materialmente los viajes publicados. En particular, Ruta Compartida:</p>
      <ul>
        <li>no es propietario ni guardián de los vehículos publicados;</li>
        <li>no conduce los vehículos ni decide quién los conduce;</li>
        <li>no emplea a los conductores ni mantiene con ellos relación laboral, de dependencia o de representación;</li>
        <li>no realiza inspecciones mecánicas de los vehículos;</li>
        <li>no acompaña a los usuarios durante los trayectos ni puede supervisar su comportamiento en tiempo real.</li>
      </ul>
      <p>El conductor publica voluntariamente un trayecto que de todos modos proyectaba realizar por cuenta propia, y decide ofrecer los
      asientos que le queden libres.</p>
    `,
  },
  {
    titulo: "4. El acuerdo de viaje es entre el conductor y el pasajero",
    html: `
      <p>Una vez aceptada una reserva, el acuerdo relativo a la realización material del viaje —punto de encuentro, horario,
      condiciones del trayecto— se establece <strong>directamente entre el conductor y el pasajero</strong>. Cada uno actúa en nombre
      propio y bajo su propia responsabilidad.</p>
      <p>La aceptación de una reserva a través de la plataforma no convierte a Ruta Compartida en propietario, guardián o conductor del
      vehículo, ni la plataforma representa a una parte frente a la otra, salvo en las funciones específicas de intermediación, reserva,
      cobro de su comisión o reembolso que expresamente asume.</p>
    `,
  },
  {
    titulo: "5. El viaje compartido no es un servicio de transporte comercial",
    html: `
      <p>El conductor declara que utiliza Ruta Compartida exclusivamente para compartir gastos de trayectos que de todos modos iba a
      realizar por cuenta propia. En consecuencia, el conductor <strong>no puede obtener un beneficio económico</strong> por llevar
      pasajeros: debe soportar también una parte del costo de su propio viaje, y la suma que reciba de todos los pasajeros de un mismo
      trayecto nunca puede superar el costo compartido de ese trayecto (ver <a href="#/reglas-de-la-ruta">Reglas de la Ruta</a> para el
      cálculo concreto y los topes vigentes).</p>
      <p>Queda prohibido usar la plataforma para: publicar viajes ficticios con el único fin de generar ingresos; realizar trayectos
      cuya finalidad principal sea transportar pasajeros a cambio de dinero; cobrar por fuera de los topes que fija el sistema; o usar
      Ruta Compartida como sustituto de un servicio de taxi, remis o transporte privado profesional. Ruta Compartida podrá rechazar
      publicaciones, cancelar reservas, suspender o eliminar cuentas cuando detecte indicios razonables de uso comercial, fraudulento o
      contrario a estos Términos.</p>
    `,
  },
  {
    titulo: "6. Seguro del vehículo: es responsabilidad del conductor confirmarlo",
    html: `
      <p>El conductor es responsable de mantener vigentes las coberturas de seguro que la normativa exige para su vehículo, y de
      <strong>confirmar con su propia compañía de seguros</strong> que su póliza cubre el traslado de pasajeros a cambio de una
      contribución a los gastos (carpooling), antes de publicar o realizar un viaje. La existencia de una póliza de uso particular no
      implica necesariamente que exista cobertura para cualquier utilización del vehículo.</p>
      <p>Ruta Compartida pide al conductor, al registrarse, que declare haber verificado este punto con su aseguradora. Esa
      declaración —igual que la verificación documental descripta en la sección siguiente— es una medida de reducción de riesgo, y no
      sustituye la responsabilidad del conductor de conocer y cumplir sus propias obligaciones de seguro.</p>
    `,
  },
  {
    titulo: "7. Verificación documental que realiza Ruta Compartida",
    html: `
      <p>Antes de habilitar una cuenta, un integrante del equipo de Ruta Compartida revisa manualmente la documentación cargada por el
      usuario: DNI, una selfie de validación, y —para conductores— licencia de conducir, cédula del vehículo, póliza de seguro y
      constancia de VTV vigente con su fecha de vencimiento.</p>
      <p>Para que quede claro qué promete esta verificación y qué no: es una revisión humana de que los documentos existen, parecen
      auténticos y están dentro de su fecha de vigencia declarada. <strong>No es</strong> una certificación pública de autenticidad, ni
      una investigación de antecedentes, ni una evaluación psicológica, ni una inspección mecánica del vehículo, ni una garantía sobre
      el comportamiento futuro de la persona. La selfie se compara manualmente con la foto del DNI por una persona del equipo — Ruta
      Compartida <strong>no utiliza software de reconocimiento facial automatizado</strong> para esta verificación.</p>
      <p>Que un perfil esté habilitado significa únicamente que superó estos controles documentales en ese momento. No es una
      recomendación personal ni una garantía de que el viaje transcurrirá sin incidentes.</p>
    `,
  },
  {
    titulo: "8. Contribución a los gastos y comisión de la plataforma",
    html: `
      <p>La contribución que paga el pasajero tiene como único fin compartir los gastos del trayecto (combustible y peajes); no es una
      tarifa comercial ni genera ganancia para el conductor. El método de cálculo, los topes aplicables y los porcentajes de ajuste
      permitidos están descriptos —con sus valores concretos, que la plataforma puede actualizar periódicamente— en las
      <a href="#/reglas-de-la-ruta">Reglas de la Ruta</a>.</p>
      <p>Además de esa contribución, Ruta Compartida puede percibir una comisión por el servicio tecnológico de intermediación,
      validación, gestión de reservas y soporte que presta a través de la plataforma. Esa comisión es independiente de la contribución
      que recibe el conductor, y su existencia no convierte al conductor en trabajador, empleado ni prestador contratado por la
      plataforma.</p>
    `,
  },
  {
    titulo: "9. Independencia de los conductores",
    html: `
      <p>Los conductores son usuarios independientes. No existe relación laboral, de dependencia, societaria, de representación ni de
      franquicia entre Ruta Compartida y los conductores por el solo hecho de usar la plataforma. Ruta Compartida no paga salarios ni
      garantiza ingresos, cantidad de viajes o de pasajeros.</p>
      <p>El conductor decide libremente si realiza un viaje, cuándo lo hace, qué trayecto publica y qué solicitudes acepta, dentro de
      las reglas de la plataforma.</p>
    `,
  },
  {
    titulo: "10. Conducta esperada y suspensión de cuentas",
    html: `
      <p>Todos los usuarios deben comportarse con respeto. Quedan prohibidas las amenazas, la violencia, el acoso, la discriminación, el
      fraude, la suplantación de identidad y cualquier conducta delictiva. Ruta Compartida puede suspender preventiva o
      definitivamente una cuenta cuando existan indicios razonables de alguna de estas conductas, de documentación falsa, de uso
      comercial prohibido o de incumplimiento reiterado de estos Términos, y puede colaborar con la autoridad competente cuando
      corresponda.</p>
    `,
  },
  {
    titulo: "11. Límites de responsabilidad de Ruta Compartida",
    html: `
      <p>Dentro de los límites que permite la legislación argentina, Ruta Compartida no será responsable por hechos que no resulten
      directamente imputables a un incumplimiento propio de las obligaciones que asumió como plataforma tecnológica, incluyendo en
      particular los derivados de: la conducción del vehículo; el comportamiento del conductor o del pasajero; información falsa
      cargada por un usuario; el estado mecánico del vehículo; accidentes de tránsito; y hechos de terceros ajenos a la plataforma.</p>
      <p>Esta limitación <strong>no excluye</strong> las responsabilidades que la ley argentina considere inderogables, ni los derechos
      que la normativa de defensa del consumidor reconoce al usuario que revista la condición de consumidor. Ruta Compartida responde,
      conforme a esa normativa, por los incumplimientos que resulten imputables a su propio servicio de intermediación.</p>
    `,
  },
  {
    titulo: "12. Datos personales",
    html: `
      <p>Ruta Compartida trata los datos personales de los usuarios conforme a su <a href="#/privacidad">Política de Privacidad</a> y
      a la Ley N° 25.326 de Protección de Datos Personales. Recomendamos leerla especialmente antes de cargar documentos de identidad,
      selfies o datos del vehículo.</p>
    `,
  },
  {
    titulo: "13. Modificación de estos Términos",
    html: `
      <p>Ruta Compartida puede modificar estos Términos cuando resulte necesario por cambios normativos, nuevas funcionalidades o
      razones de seguridad. Los cambios relevantes se informarán a los usuarios por medios razonables (por ejemplo, un aviso dentro de
      la app) y, cuando la ley lo exija, se solicitará una nueva aceptación.</p>
    `,
  },
  {
    titulo: "14. Ley aplicable y jurisdicción",
    html: `
      <p>Estos Términos se rigen por las leyes de la República Argentina. Cuando el usuario revista la condición jurídica de
      consumidor, estos Términos no restringen los derechos de jurisdicción que la legislación de defensa del consumidor le reconoce
      (en particular, la posibilidad de reclamar ante los tribunales correspondientes a su propio domicilio).</p>
    `,
  },
  {
    titulo: "15. Identificación del responsable de la plataforma",
    html: `
      <p><em>[Pendiente de completar antes de operar con usuarios reales: razón social o nombre y apellido del titular de Ruta
      Compartida, CUIT y domicilio legal. La normativa de defensa del consumidor exige que esta información esté disponible para el
      usuario.]</em></p>
      <p>Para consultas: <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">WhatsApp de Ruta Compartida</a>.</p>
    `,
  },
];

// ---------------------------------------------------------------------------
// 2) REGLAS DE LA RUTA (cómo funciona un viaje, en criollo)
// ---------------------------------------------------------------------------
const REGLAS_SECTIONS = [
  {
    titulo: "1. Quiénes pueden sumarse: conductores y pasajeros",
    html: `
      <h4>Conductor</h4>
      <p>Es el usuario que realiza el trayecto por cuenta propia y decide compartir sus asientos disponibles. Para habilitarse necesita
      presentar:</p>
      <ul>
        <li>DNI (frente y dorso) y una selfie sosteniéndolo junto a su cara.</li>
        <li>Licencia de conducir vigente.</li>
        <li>Cédula verde o azul que autorice el vehículo a circular.</li>
        <li>Póliza de seguro vigente, habiendo confirmado con su aseguradora que cubre carpooling.</li>
        <li>Constancia de VTV vigente (foto de la oblea o el comprobante), con su fecha de vencimiento.</li>
      </ul>
      <h4>Pasajero</h4>
      <p>Es el usuario que necesita trasladarse y se suma al trayecto del conductor. Para habilitarse necesita:</p>
      <ul>
        <li>Nombre, apellido y DNI (frente y dorso).</li>
        <li>Selfie de validación (la revisa manualmente nuestro equipo).</li>
        <li>Celular verificado (usamos WhatsApp para avisos).</li>
        <li>Correo electrónico.</li>
      </ul>
      <p>Revisamos cada perfil manualmente antes de habilitarlo. Es un proceso de reducción de riesgo, no una garantía sobre la
      conducta de cada persona — para eso están también las calificaciones y el sentido común: coordiná el encuentro en un lugar
      público y contale a alguien de confianza cuándo y con quién viajás.</p>
    `,
  },
  {
    titulo: "2. Cómo funciona un viaje, paso a paso",
    html: `
      <h4>2.1 Publicación</h4>
      <p>El conductor completa punto de partida exacto, ciudad de destino, ciudades intermedias, horario de salida, horario estimado de
      llegada, fecha, precio, asientos disponibles y sus preferencias de convivencia (mascotas, equipaje grande, fumar, charla o
      silencio, música).</p>
      <h4>2.2 Búsqueda y reserva</h4>
      <p>El pasajero busca por origen, destino y fecha. Ve el precio y la valoración del conductor, pero <strong>no sus demás datos</strong>
      (foto, auto, teléfono) hasta que la reserva quede confirmada — así evitamos que alguien lo contacte por fuera de la app antes de
      confirmar y pagar. Al reservar, se envía la solicitud al conductor, quien puede <strong>aceptarla o rechazarla</strong>. Si la
      acepta, recién ahí se habilitan los datos completos de contacto entre ambas partes para coordinar el encuentro.</p>
      <h4>2.3 Pago</h4>
      <p>Una vez que el conductor aceptó la reserva, el pasajero paga dentro de la app <strong>únicamente la comisión de Ruta
      Compartida</strong> por el servicio de intermediación. El resto del costo del viaje <strong>no lo cobra la plataforma</strong>:
      el pasajero se lo transfiere directamente al conductor —por transferencia o QR de Mercado Pago a su alias— al momento de viajar.
      El monto de la comisión se muestra <strong>desde el momento en que el pasajero solicita la reserva</strong> (antes de confirmar
      la solicitud) y vuelve a mostrarse en la pantalla de pago antes de confirmar — nunca es una sorpresa después de reservar.</p>
      <h4>2.4 Ejecución y cierre</h4>
      <p>Al finalizar el trayecto, ambas partes pueden calificar su experiencia (puntuación general, habilidad de manejo o puntualidad,
      comodidad). Las calificaciones quedan visibles en el perfil público de cada usuario.</p>
      <h4>2.5 Cancelaciones y demoras</h4>
      <p>La política de cancelación es simple y binaria, tomando como referencia el horario de salida del viaje:</p>
      <ul>
        <li>Si el pasajero cancela con <strong>24 horas o más de anticipación</strong> a la salida, no se le cobra nada: si ya había
        pagado la comisión, se le reembolsa el <strong>100%</strong>.</li>
        <li>Si el pasajero cancela con <strong>menos de 24 horas de anticipación</strong>, no corresponde reembolso: si ya pagó la
        comisión, <strong>la pierde</strong>.</li>
        <li>Si todavía no pagó la comisión al momento de cancelar, la cancelación no tiene ningún costo, sin importar el momento en que
        se haga.</li>
        <li>El pasajero debe llegar al punto de encuentro <strong>5 minutos antes</strong> del horario de salida. Hay una tolerancia de
        <strong>10 minutos</strong>; pasado ese tiempo, el conductor puede iniciar el viaje sin el pasajero y se aplica la misma regla de
        las 24 horas (en la práctica, no corresponde reembolso).</li>
        <li>Si es el <strong>conductor</strong> quien cancela el viaje, todos los pasajeros con reserva confirmada reciben el
        <strong>reembolso total</strong>, sin excepciones y sin importar cuándo cancele.</li>
      </ul>
    `,
  },
  {
    titulo: "3. Cómo se calcula el precio (y por qué nadie puede lucrar)",
    html: `
      <p>El objetivo de este mecanismo es que el conductor recupere parte de <strong>lo que ese viaje le cuesta</strong>, nunca que
      genere una ganancia por llevar pasajeros.</p>
      <h4>Valor de referencia</h4>
      <p>Tomamos un precio de referencia de la nafta súper y los peajes vigentes en las rutas habilitadas. Estos valores, junto con el
      consumo estimado del vehículo (por defecto, 10 litros cada 100 km) y el piso mínimo por kilómetro mencionado abajo, están
      configurados desde el panel de administración y pueden actualizarse cuando cambien los costos reales del corredor.</p>
      <h4>Algoritmo</h4>
      <p>Con esos valores, el sistema calcula:</p>
      <ul>
        <li><strong>Litros totales</strong> = (distancia en km / 100) × consumo de referencia</li>
        <li><strong>Costo de combustible</strong> = litros totales × precio de referencia de la nafta</li>
        <li><strong>Costo Total del Viaje (C.T.O.)</strong> = costo de combustible + peajes vigentes</li>
        <li><strong>Valor por asiento según costo</strong> = C.T.O. / (asientos ofrecidos + 1, el conductor)</li>
      </ul>
      <h4>Piso mínimo</h4>
      <p>Además del cálculo por costo, el sistema aplica un piso mínimo por asiento (ambos valores configurables desde el panel de
      administración): una tarifa mínima fija para trayectos cortos, y a partir de cierta distancia, un valor mínimo por kilómetro
      recorrido. El precio sugerido final es siempre el <strong>mayor</strong> entre el cálculo por costo real y ese piso, para que la
      contribución nunca quede desactualizada frente a los costos reales de nafta y peajes.</p>
      <h4>Techo Operativo (C.T.O.) — la Regla de Oro</h4>
      <p>La suma de las contribuciones de <strong>todos</strong> los pasajeros confirmados de un mismo trayecto nunca puede superar el
      100% del C.T.O. calculado para ese trayecto. Es un techo que calcula el sistema, no el conductor.</p>
      <h4>El precio no se puede editar</h4>
      <p>La distancia, los peajes estimados y el precio final salen siempre de una tabla de referencia por ciudad (todas las ciudades
      habilitadas tienen origen o destino en La Plata) y del cálculo automático descripto arriba. Ni el conductor ni nadie puede
      escribir un valor distinto al publicar el viaje — así el precio nunca se aparta del costo real ni depende de cuánto quiera cobrar
      cada persona.</p>
      <h4>Comisión de Ruta Compartida</h4>
      <p>Aparte de esta contribución al conductor, la app cobra una comisión propia por su servicio de intermediación (un porcentaje del
      costo compartido del viaje, con un mínimo en pesos). Esa comisión es la que factura Ruta Compartida; el resto siempre se lo
      transferís directamente al conductor. Los valores vigentes de todo lo anterior se muestran siempre antes de confirmar un pago.</p>
    `,
  },
  {
    titulo: "4. Derechos y obligaciones del conductor",
    html: `
      <ul>
        <li><strong>Documentación:</strong> el vehículo debe tener VTV vigente, cédula correspondiente y seguro con cobertura para
        carpooling. Debe respetar las velocidades máximas de la ruta.</li>
        <li><strong>Estado de la unidad:</strong> mantenimiento básico al día (luces, frenos, neumáticos en condiciones para ruta).</li>
        <li><strong>Hoja de ruta:</strong> se compromete a seguir el trayecto publicado, sin desvíos por trámites personales que
        retrasen al pasajero (salvo emergencia).</li>
        <li><strong>Respeto a lo publicado:</strong> si marcó que acepta mascotas o equipaje de bodega, no puede rechazar al pasajero
        por ese motivo al momento del encuentro.</li>
        <li><strong>Prohibiciones:</strong> no fumar dentro del vehículo (salvo acuerdo unánime) ni usar el celular mientras conduce, ni
        conducir bajo efectos de alcohol o sustancias que afecten la conducción.</li>
      </ul>
    `,
  },
  {
    titulo: "5. Derechos y obligaciones del pasajero",
    html: `
      <ul>
        <li><strong>Veracidad del equipaje:</strong> no presentarse con bultos que excedan lo declarado.</li>
        <li><strong>Puntualidad:</strong> estar en el punto de encuentro 5 minutos antes del horario de salida (ver política de
        cancelación por tolerancia).</li>
        <li><strong>Respeto:</strong> tratar con respeto al conductor y a los demás pasajeros durante todo el trayecto.</li>
        <li><strong>Calificar con honestidad:</strong> las calificaciones son la base de confianza de la comunidad.</li>
      </ul>
    `,
  },
];

// ---------------------------------------------------------------------------
// 3) POLÍTICA DE PRIVACIDAD
// ---------------------------------------------------------------------------
const PRIVACIDAD_SECTIONS = [
  {
    titulo: "1. Responsable del tratamiento de los datos",
    html: `
      <p><em>[Pendiente de completar antes de operar con usuarios reales: razón social o nombre y apellido del responsable, CUIT,
      domicilio y correo de contacto para temas de privacidad.]</em> Mientras tanto, el canal de contacto es el
      <a href="https://wa.me/5492396629101" target="_blank" rel="noopener">WhatsApp de Ruta Compartida</a>.</p>
      <p>Esta Política se rige por la Ley N° 25.326 de Protección de Datos Personales y su normativa complementaria, bajo control de la
      <strong>Agencia de Acceso a la Información Pública (AAIP)</strong>, órgano de control de dicha ley en la Argentina.</p>
    `,
  },
  {
    titulo: "2. Qué datos recopilamos",
    html: `
      <ul>
        <li><strong>Datos de identidad:</strong> nombre, apellido, edad, DNI, domicilio.</li>
        <li><strong>Datos de contacto:</strong> email y teléfono.</li>
        <li><strong>Documentos e imágenes de validación:</strong> foto del DNI (frente y dorso) y una selfie de validación. Para
        conductores, además: licencia de conducir, cédula del vehículo, póliza de seguro y constancia de VTV con su fecha de
        vencimiento.</li>
        <li><strong>Datos del vehículo</strong> (solo conductores): marca, modelo, color, patente, foto y cantidad de asientos.</li>
        <li><strong>Datos de cobro</strong> (solo conductores): alias de Mercado Pago o CBU/CVU al que los pasajeros les transfieren su
        parte del viaje.</li>
        <li><strong>Preferencias de viaje:</strong> mascotas, equipaje, música, conversación.</li>
        <li><strong>Actividad en la plataforma:</strong> viajes publicados o reservados, calificaciones recibidas y emitidas.</li>
        <li><strong>Contraseña:</strong> se guarda con una técnica de hash (scrypt) que la vuelve irreversible — ni el equipo de Ruta
        Compartida puede ver la contraseña real de un usuario.</li>
      </ul>
      <p>La selfie de validación se usa para que una persona del equipo la compare manualmente con la foto del DNI. <strong>No
      utilizamos software de reconocimiento facial automatizado</strong> ni tratamos esa imagen como dato biométrico procesado por un
      sistema; es una revisión humana puntual al momento de habilitar la cuenta.</p>
    `,
  },
  {
    titulo: "3. Para qué usamos estos datos",
    html: `
      <ul>
        <li>Crear y validar tu cuenta, y verificar tu identidad y la de tu vehículo si sos conductor.</li>
        <li>Permitirte publicar, buscar, reservar y calificar viajes.</li>
        <li>Calcular la contribución sugerida a los gastos de cada trayecto.</li>
        <li>Procesar o registrar el cobro de la comisión de Ruta Compartida.</li>
        <li>Comunicarnos con vos por WhatsApp o email sobre el estado de tu cuenta, tus reservas o tus viajes.</li>
        <li>Prevenir fraude, uso comercial no autorizado y otras infracciones a los Términos y Condiciones.</li>
        <li>Cumplir obligaciones legales, fiscales o requerimientos de autoridad competente.</li>
      </ul>
      <p>La base legal de este tratamiento es tu consentimiento al registrarte, y la necesidad de estos datos para prestarte el
      servicio que solicitaste.</p>
    `,
  },
  {
    titulo: "4. Con quién compartimos tus datos",
    html: `
      <ul>
        <li><strong>Con otros usuarios:</strong> nombre y valoración se muestran a quien busca un viaje; los datos completos de
        contacto (foto, teléfono, auto) recién se comparten con la otra parte una vez que una reserva queda confirmada.</li>
        <li><strong>Con proveedores de infraestructura tecnológica:</strong> usamos servicios de hosting y base de datos en la nube
        (actualmente Vercel y un proveedor de Postgres) para operar la plataforma. Estos proveedores pueden alojar la información en
        servidores ubicados fuera de la Argentina. Al registrarte, consentís esta transferencia internacional de datos, necesaria para
        que la plataforma funcione.</li>
        <li><strong>Con Mercado Pago u otros medios de pago</strong>, si en el futuro se integra un procesamiento de pagos real dentro
        de la app (hoy, el pago de la parte del conductor se hace siempre directamente entre pasajero y conductor, por fuera de la
        plataforma).</li>
        <li><strong>Con autoridades públicas</strong>, cuando exista una obligación legal de hacerlo o para colaborar ante un hecho
        grave (fraude, delito, siniestro).</li>
      </ul>
      <p>No vendemos ni cedemos tus datos a terceros con fines publicitarios.</p>
    `,
  },
  {
    titulo: "5. Cuánto tiempo conservamos tus datos",
    html: `
      <p>Conservamos tus datos mientras tu cuenta esté activa. Si pedís la baja de tu cuenta, podemos conservar cierta información
      (por ejemplo, historial de viajes o motivos de rechazo de validación) durante el plazo adicional necesario para cumplir
      obligaciones legales o fiscales, o para poder acreditar el cumplimiento de las Reglas de la Ruta ante un reclamo.</p>
    `,
  },
  {
    titulo: "6. Tus derechos sobre tus datos",
    html: `
      <p>Conforme a la Ley N° 25.326, tenés derecho a acceder a tus datos personales, a solicitar su rectificación o actualización si
      están incorrectos, y a pedir su supresión cuando corresponda (por ejemplo, al dar de baja tu cuenta). También podés oponerte a
      determinados usos de tus datos.</p>
      <p>Para ejercer estos derechos, escribinos por el canal de contacto indicado en la sección 1. Además, tenés derecho a presentar
      una denuncia ante la Agencia de Acceso a la Información Pública (AAIP) si considerás que no dimos curso a tu solicitud.</p>
    `,
  },
  {
    titulo: "7. Seguridad de la información",
    html: `
      <p>Guardamos las contraseñas con hash (nunca en texto plano) y usamos conexiones cifradas (HTTPS) para el tráfico entre tu
      dispositivo y la plataforma. Ningún sistema es completamente infalible: no podemos garantizar la ausencia absoluta de incidentes
      de seguridad, pero adoptamos medidas razonables para reducir ese riesgo y, si ocurriera un incidente relevante, te lo
      informaríamos por los canales de contacto disponibles.</p>
    `,
  },
  {
    titulo: "8. Almacenamiento en tu dispositivo",
    html: `
      <p>La app guarda tu sesión (los datos básicos de tu perfil) en el almacenamiento local de tu navegador (<em>localStorage</em>) para
      que no tengas que iniciar sesión cada vez que la abrís. Podés borrar esta información cerrando sesión o borrando los datos del
      sitio desde la configuración de tu navegador.</p>
    `,
  },
  {
    titulo: "9. Menores de edad",
    html: `
      <p>Ruta Compartida no está dirigido a menores de edad sin la intervención de sus representantes legales. Si detectamos una
      cuenta de un menor sin esa intervención, podremos suspenderla.</p>
    `,
  },
  {
    titulo: "10. Cambios a esta Política",
    html: `
      <p>Podemos actualizar esta Política cuando cambien nuestras prácticas de tratamiento de datos o la normativa aplicable. Los
      cambios relevantes se informarán dentro de la app.</p>
    `,
  },
];

const FAQ_ITEMS = [
  {
    q: "¿Ruta Compartida es una empresa de transporte?",
    a: "No. Somos una plataforma de intermediación: conectamos a conductores que ya hacen un trayecto con pasajeros que quieren compartir gastos en esa misma dirección. No poseemos flota, no contratamos conductores y no ejecutamos el viaje.",
  },
  {
    q: "¿Qué pasa si tenemos un problema durante el viaje?",
    a: "La responsabilidad civil por accidentes, siniestros o conductas entre usuarios no la asume la plataforma: recae en el conductor, su seguro, o en las personas involucradas, según corresponda. Verificamos documentación para reducir riesgos, pero eso no es una garantía de comportamiento ni de que no vaya a pasar nada.",
  },
  {
    q: "¿Cómo se fija el precio del viaje?",
    a: "Lo calcula el sistema automáticamente según la ciudad de origen y destino (distancia y peajes de referencia), en base al gasto real de combustible y peajes del trayecto, dividido entre los asientos del auto. Nadie puede editarlo — ni el conductor — y nunca supera el Techo Operativo del viaje (ver 'Reglas de la Ruta', punto 3).",
  },
  {
    q: "¿Cómo se paga?",
    a: "En la app pagás solo la comisión de Ruta Compartida, una vez que el conductor aceptó tu solicitud. El resto del costo se lo transferís vos directamente al conductor —por transferencia o QR de Mercado Pago a su alias— al momento de viajar. La plataforma no cobra ni retiene esa parte.",
  },
  {
    q: "¿Puedo cancelar una reserva?",
    a: "Sí, desde 'Mis viajes'. La regla es simple: cancelando con 24 horas o más de anticipación a la salida no se te cobra nada (o se te reembolsa el 100% si ya habías pagado la comisión). Cancelando con menos de 24 horas de anticipación, no corresponde reembolso de la comisión ya pagada. Si todavía no pagaste, cancelar nunca tiene costo. Si es el conductor quien cancela, siempre recibís el reembolso total.",
  },
  {
    q: "¿Cuándo se marca un viaje como completado?",
    a: "Una vez que el conductor aceptó la reserva y el pasajero pagó la comisión de la plataforma, cualquiera de los dos puede marcar el viaje como completado desde 'Mis viajes'. Recién ahí se habilita que ambos se califiquen, y el viaje se suma a las estadísticas.",
  },
  {
    q: "¿Qué documentación me piden para registrarme?",
    a: "A todos: DNI, selfie de validación, celular y email. A los conductores además: licencia de conducir, cédula verde/azul, seguro vigente y constancia de VTV con su fecha de vencimiento (no alcanza con declararlo). Revisamos cada perfil manualmente y avisamos por WhatsApp en menos de 24 hs.",
  },
  {
    q: "¿Puedo ver la foto, el auto o el teléfono del conductor antes de reservar?",
    a: "Antes de reservar solo vas a ver su nombre y su valoración, además de todos los datos del viaje. La foto, el auto y el teléfono se muestran recién cuando el conductor acepta tu reserva — así evitamos que alguien contacte por fuera de la app antes de confirmar y pagar.",
  },
  {
    q: "¿Puedo viajar con mascotas o equipaje grande?",
    a: "Depende de cada viaje: el conductor indica al publicarlo si acepta mascotas, equipaje grande, si permite fumar y sus preferencias de charla y música. Elegí el viaje que mejor se adapte a lo que necesitás.",
  },
  {
    q: "¿Qué pasa si llego tarde al punto de encuentro?",
    a: "Hay una tolerancia de 10 minutos desde el horario de salida. Pasado ese tiempo, el conductor puede iniciar el viaje sin vos, y se aplica la misma regla de las 24 horas: como ya está dentro de las 24 horas previas a la salida, no corresponde reembolso de la comisión ya pagada.",
  },
  {
    q: "¿Los conductores ganan dinero llevando pasajeros?",
    a: "No debería: el sistema calcula un Techo Operativo que la suma de todas las contribuciones nunca puede superar, así que el conductor solo recupera parte de su propio gasto de combustible y peajes, nunca una ganancia extra.",
  },
  {
    q: "¿Hay relación laboral entre Ruta Compartida y los conductores?",
    a: "No. Los conductores son usuarios particulares que comparten gastos de un trayecto propio. No existe vínculo laboral, de dependencia ni de representación entre la plataforma y los conductores o pasajeros.",
  },
  {
    q: "¿Qué hacen con mis datos y mis documentos?",
    a: "Los usamos para validar tu identidad y prestarte el servicio, y no los vendemos a terceros. El detalle completo — qué recopilamos, con quién se comparte y cómo pedir que se corrijan o eliminen — está en la Política de Privacidad.",
  },
];
