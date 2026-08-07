# Viaje Compartido — versión para Vercel + Postgres

Esta es la adaptación de [Viaje Compartido](../viaje-compartido) pensada para desplegarse en Vercel: el
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
4. **Agregar una variable de entorno propia:** en **Settings → Environment Variables**, crear
   `SEED_SECRET` con cualquier valor secreto que elijas (ej. una contraseña larga). Se usa para proteger el
   endpoint que carga los datos de ejemplo.
5. **Desplegar** (Vercel lo hace automáticamente al importar, o con "Redeploy" después de agregar las
   variables de entorno).
6. **Cargar los datos de ejemplo** (una sola vez): abrí en el navegador
   `https://TU-PROYECTO.vercel.app/api/admin/seed?secret=EL_VALOR_QUE_PUSISTE_EN_SEED_SECRET`
   Deberías ver un JSON con `"mensaje": "Datos de ejemplo cargados correctamente."`. Si volvés a abrir esa
   URL más adelante, no va a duplicar los datos (revisa si ya hay usuarios cargados).
7. Abrí `https://TU-PROYECTO.vercel.app` — ya debería funcionar igual que la versión local.

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

## Usuarios de prueba (después de correr el seed)

Los mismos que en la versión local: `martin.conductor@example.com`, `laura.conductora@example.com`,
`sofia.pasajera@example.com`, `admin@viajecompartido.com.ar` — usá los botones de acceso rápido en la
pantalla de login.
