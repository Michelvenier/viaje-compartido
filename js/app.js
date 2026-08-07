// app.js — Router de la SPA (hash routing) + arranque de la aplicación.

const ROUTES = [
  { pattern: /^\/$/, view: (app) => viewHome(app) },
  { pattern: /^\/buscar$/, view: (app, m, query) => viewBuscar(app, {}, query) },
  { pattern: /^\/viaje\/([^/]+)$/, view: (app, m) => viewDetalle(app, { id: m[1] }) },
  { pattern: /^\/publicar$/, view: (app) => viewPublicar(app) },
  { pattern: /^\/registro\/(conductor|pasajero)$/, view: (app, m) => viewRegistro(app, { rol: m[1] }) },
  { pattern: /^\/login$/, view: (app) => viewLogin(app) },
  { pattern: /^\/mis-viajes$/, view: (app) => viewMisViajes(app) },
  { pattern: /^\/reserva\/([^/]+)\/pagar$/, view: (app, m) => viewPagar(app, { id: m[1] }) },
  { pattern: /^\/calificar\/([^/]+)$/, view: (app, m) => viewCalificar(app, { id: m[1] }) },
  { pattern: /^\/reglas-de-la-ruta$/, view: (app) => viewReglas(app) },
  { pattern: /^\/ayuda$/, view: (app) => viewAyuda(app) },
  { pattern: /^\/admin$/, view: (app) => viewAdmin(app) },
  { pattern: /^\/perfil$/, view: (app) => viewPerfil(app) },
];

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const query = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((v, k) => (query[k] = v));
  }
  return { path: pathPart || "/", query };
}

function router() {
  const { path, query } = parseHash();
  const app = document.getElementById("app");
  for (const route of ROUTES) {
    const m = route.pattern.exec(path);
    if (m) {
      try {
        route.view(app, m, query);
      } catch (err) {
        console.error(err);
        app.innerHTML = `<div class="container"><div class="error-box">Ocurrió un error inesperado: ${escapeHtml(err.message)}</div></div>`;
      }
      window.scrollTo(0, 0);
      return;
    }
  }
  app.innerHTML = `<div class="container empty-state"><div class="big">🧭</div><h2>Página no encontrada</h2><a href="#/">Volver al inicio</a></div>`;
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  renderNavSession();
  router();

  const burger = document.getElementById("nav-burger");
  burger.addEventListener("click", () => {
    document.querySelector(".navbar-inner").classList.toggle("open");
  });
});
