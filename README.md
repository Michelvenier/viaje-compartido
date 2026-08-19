# Ruta Compartida — versión para Vercel + Postgres

Esta es la adaptación de [Ruta Compartida](../viaje-compartido) pensada para desplegarse en Vercel: el
backend corre como funciones serverless (`api/[...path].js`) y los datos se guardan en una base Postgres
en la nube en vez del archivo SQLite local. La lógica de negocio (motor de precios, reglas de validación,
flujo de reservas) es exactamente la misma.

## Pasos de despliegue

1. **Subir este proyecto a un repositorio de GitHub** (vacío, solo con este código).
2. **Importar el repositorio en Vercel** (New Project → seleccionar el repo). No hace falta tocar ningún
   comando de build: Vercel detecta `package.json` e instala `pg` automáticamente, y sirve `index.html` +
   `api/[...path].js` con la configuración por defecto.
3. **Agregar una base de datos:** en el proyecto de Vercel, ir a la pestaña **Storage → Create Database →
   Postgres** (o conectar una integración de Neon/Supabase). Esto agrega automáticamente la variable de
   entorno `POSTGRES_URL` (o `DATABASE_URL`) al proyecto.
4. **Agregar variables de entorno propias:** en **Settings → Environment Variables**, crear:
   - `SEED_SECRET`: cualquier valor secreto que elijas (ej. una contraseña larga). Protege el endpoint que
     carga los datos de ejemplo.
   - `ADMIN_SETUP_SECRET`: otro valor secreto, distinto del anterior. Es la ÚNICA llave que permite crear o
     resetear la contraseña de la cuenta de administrador (ver el paso 7). No la compartas ni la subas al
     código — vive solo en Vercel.
   - `RESEND_API_KEY` (opcional, pero recomendada): activa el email que te avisa cuando un conductor reporta
     que un pasajero no viajó (para que hagas el reembolso manual de la comisión). Sin esta variable, la app
     sigue funcionando igual — simplemente no manda ese email, y el aviso solo queda visible en el panel de
     administración ("Reembolsos manuales pendientes"). Para activarlo: creá una cuenta gratis en
     [resend.com](https://resend.com) (hasta 3.000 emails/mes gratis), generá una API key en su panel, y
     pegala aquí. Con la cuenta recién creada, sin verificar un dominio propio, Resend solo te deja mandar
     emails a la casilla con la que te registraste — que es exactamente lo que necesitás, ya que los avisos
     son para vos.
   - `ADMIN_EMAIL` (opcional): a qué dirección le llegan esos avisos. Si no la definís, se usa
     `michelvenier10@gmail.com` por defecto.
   - `GOOGLE_MAPS_API_KEY` (opcional, pero necesaria para viajes entre ciudades intermedias): sin esta
     variable, la app sigue calculando bien la distancia y el precio de los viajes con origen o destino en
     La Plata (tabla curada a mano), pero cualquier otro par de ciudades del corredor (ej. Tandil ↔ Bolívar)
     no va a poder calcularse y el conductor va a ver un error claro al intentar publicarlo. Para activarla:
     1. Entrá a [console.cloud.google.com](https://console.cloud.google.com) y creá un proyecto nuevo (o usá
        uno existente).
     2. Activá la facturación del proyecto (**Facturación → Vincular una cuenta de facturación**) — Google
        pide una tarjeta de crédito para esto, aunque el uso típico de esta app queda dentro de los $200
        USD/mes de crédito gratis que da Google Maps Platform.
     3. Andá a **APIs y servicios → Biblioteca**, buscá **"Distance Matrix API"** y hacé clic en **Habilitar**.
     4. Andá a **APIs y servicios → Credenciales → Crear credenciales → Clave de API**. Copiá la clave que
        te genera.
     5. (Recomendado, para que nadie más pueda usar tu clave) En la clave recién creada, en
        **Restricciones de API**, elegí "Restringir clave" y marcá solo **Distance Matrix API**.
     6. Pegá esa clave acá como `GOOGLE_MAPS_API_KEY` en Vercel.
     La app cachea cada distancia consultada (tabla `distancias_cache`) para no volver a pagar por la misma
     ruta dos veces, y estima el peaje de estos trayectos como km × un valor de referencia por km (config
     `peaje_por_km_estimado`, editable desde el panel de admin) — Google Maps no informa costo de peajes.
   - **Blob store** (necesaria para que las fotos de documentos — DNI, selfie, licencia, seguro, VTV — y los
     comprobantes de pago se guarden de verdad, no solo el nombre del archivo): en el proyecto de Vercel,
     andá a **Storage → Create Database → Blob**, elegí acceso **Private** (la opción del store en sí — cada
     subida individual decide su propio nivel de acceso en el código, ver abajo), ponele un nombre (ej.
     "Documentos"), y conectalo a este proyecto (tildá Production y Preview, y Development si vas a probar en
     tu compu). Vercel conecta el store por OIDC automáticamente (variables `BLOB_STORE_ID` y
     `VERCEL_OIDC_TOKEN`) — no hace falta copiar ninguna clave a mano, a diferencia de Google Maps. La gran
     mayoría de los archivos (DNI, selfie, licencia, cédula, seguro, VTV, comprobantes de pago) quedan
     guardados como **privados**: nadie puede verlos con solo la URL, hace falta estar logueado como admin
     (`GET /api/admin/documento`, ver `server/blob.js`). Las dos excepciones son `foto_perfil` y
     `vehiculo_foto`: esas se suben como **públicas** a propósito, porque están pensadas para que las vea la
     otra persona del viaje (pasajero ⇄ conductor) sin necesitar sesión de admin — es lo que te permite ver
     la cara del otro antes de encontrarte en el punto de encuentro. El navegador comprime cada foto antes de
     subirla (máximo ~1600px, calidad ~82%) para no acercarse al límite de 4.5 MB por request que tienen las
     funciones de Vercel en el plan Hobby.
     **Ojo:** las fotos que los usuarios subieron ANTES de activar esta variable no se migran solas — para
     esas cuentas viejas, el botón "Ver" del panel admin va a decir "no encontrado" (porque lo que se había
     guardado antes era solo el nombre del archivo, no una foto real). De acá en adelante, toda subida nueva
     sí queda guardada de verdad.
5. **Desplegar** (Vercel lo hace automáticamente al importar, o con "Redeploy" después de agregar las
   variables de entorno).
6. **Cargar los datos de ejemplo** (una sola vez): abrí en el navegador
   `https://TU-PROYECTO.vercel.app/api/admin/seed?secret=EL_VALOR_QUE_PUSISTE_EN_SEED_SECRET`
   Deberías ver un JSON con `"mensaje": "Datos de ejemplo cargados correctamente."`. Si volvés a abrir esa
   URL más adelante, no va a duplicar los datos (revisa si ya hay usuarios cargados).
7. **Configurar la contraseña del admin** (una sola vez, y cada vez que quieras resetearla): hacé un POST a
   `https://TU-PROYECTO.vercel.app/api/admin/configurar-admin` con body JSON
   `{"secret": "EL_VALOR_DE_ADMIN_SETUP_SECRET", "password": "una-contraseña-de-al-menos-9-caracteres"}`
   (podés usar una extensión como Postman/Thunder Client, o `curl`). Esta es la única forma de dejar la
   cuenta admin (`admin@rutacompartida.com.ar` por defecto, se puede pasar otro `email` en el body) lista
   para iniciar sesión — así nadie puede "convertirse" en admin sin conocer `ADMIN_SETUP_SECRET`.
8. Abrí `https://TU-PROYECTO.vercel.app` — ya debería funcionar igual que la versión local.

## Diferencias con la versión local (`../viaje-compartido`)

- `api/db.js` usa el paquete `pg` contra Postgres en vez de `node:sqlite`. Todas las consultas siguen
  escritas con `?` como placeholder (se traducen automáticamente a `$1, $2, ...` de Postgres).
- No hay un `data/seed.js` para correr por consola — en su lugar hay un endpoint protegido
  `GET /api/admin/seed?secret=...` (ver `api/seed-data.js`), porque en Vercel no se puede ejecutar un script
  directamente contra la base de otra forma sencilla.
- El servidor no es un proceso siempre encendido: cada request a `/api/*` es una invocación de función
  serverless independiente (con un pool de conexiones a Postgres reutilizado mientras la instancia esté
  "caliente").
- El frontend (`index.html`, `css/`, `js/`) se sirve como archivos estáticos directamente desde la raíz del
  proyecto, sin cambios respecto a la versión local.

## Usuarios de prueba (después de correr el seed) y autenticación

Los mismos emails que en la versión local: `martin.conductor@example.com`, `laura.conductora@example.com`,
`sofia.pasajera@example.com`, `admin@rutacompartida.com.ar`.

Ahora el login pide **email + contraseña** (antes alcanzaba con el email, y eso permitía que cualquiera
entrara como cualquier usuario, incluido el admin). Las cuentas creadas por el seed no tienen contraseña
todavía:

- Para `martin`, `laura` y `sofia` (roles conductor/pasajero): la primera vez que alguien inicie sesión con
  ese email y **cualquier contraseña de 8+ caracteres**, esa queda establecida como su contraseña para
  siempre. Es un mecanismo de transición pensado solo para estas cuentas de prueba/legado.
- Para `admin@rutacompartida.com.ar` esto NO aplica: la cuenta admin nunca se puede "reclamar" solo
  sabiendo el email. Su contraseña se configura exclusivamente con el endpoint protegido por
  `ADMIN_SETUP_SECRET` (ver paso 7 más arriba).

### Seguridad de la cuenta admin

Todas las rutas `/api/admin/*` (estadísticas, listado de usuarios, cola de reembolsos, etc.) exigen un
token que solo se emite al iniciar sesión con una cuenta `rol="admin"` — nadie puede ver esa información
llamando a las URLs directamente sin haber iniciado sesión como admin primero. Además:

- 5 intentos de login fallidos seguidos con el mismo email bloquean esa cuenta por 15 minutos.
- El token de sesión admin vence a las 24 hs (hay que volver a iniciar sesión después de ese tiempo).
- Si alguna vez le sacás el rol admin a una cuenta desde la base de datos, su token deja de funcionar al
  instante, aunque todavía no haya vencido.
