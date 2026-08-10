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
5. **Desplegar** (Vercel lo hace automáticamente al importar, o con "Redeploy" después de agregar las
   variables de entorno).
6. **Cargar los datos de ejemplo** (una sola vez): abrí en el navegador
   `https://TU-PROYECTO.vercel.app/api/admin/seed?secret=EL_VALOR_QUE_PUSISTE_EN_SEED_SECRET`
   Deberías ver un JSON con `"mensaje": "Datos de ejemplo cargados correctamente."`. Si volvés a abrir esa
   URL más adelante, no va a duplicar los datos (revisa si ya hay usuarios cargados).
7. **Configurar la contraseña del admin** (una sola vez, y cada vez que quieras resetearla): hacé un POST a
   `https://TU-PROYECTO.vercel.app/api/admin/configurar-admin` con body JSON
   `{"secret": "EL_VALOR_DE_ADMIN_SETUP_SECRET", "password": "una-contraseña-de-al-menos-10-caracteres"}`
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
