// api.js — cliente mínimo para hablar con la API de Ruta Compartida.
const Api = (() => {
  // Las rutas /api/admin/* (menos configurar-admin y seed, que usan su propio secreto de
  // servidor) exigen un token de admin emitido al hacer login — lo mandamos como Bearer.
  // Se lee de Session recién al hacer el llamado (no al cargar el script), así que el orden
  // de <script> no importa aunque state.js se cargue después que api.js.
  function requiereTokenAdmin(path) {
    return path.startsWith("/api/admin") && !path.startsWith("/api/admin/configurar-admin") && !path.startsWith("/api/admin/seed");
  }

  async function req(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if (requiereTokenAdmin(path) && typeof Session !== "undefined") {
      const usuario = Session.get();
      if (usuario && usuario.adminToken) {
        opts.headers["Authorization"] = `Bearer ${usuario.adminToken}`;
      }
    }
    const resp = await fetch(path, opts);
    let data = null;
    try {
      data = await resp.json();
    } catch (e) {
      data = null;
    }
    if (!resp.ok) {
      const err = new Error((data && data.error) || `Error ${resp.status}`);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    get: (path) => req("GET", path),
    post: (path, body) => req("POST", path, body),
    patch: (path, body) => req("PATCH", path, body),
    del: (path) => req("DELETE", path),
  };
})();
