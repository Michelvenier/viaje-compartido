// api.js — cliente mínimo para hablar con la API de Ruta Compartida.
const Api = (() => {
  async function req(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
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
