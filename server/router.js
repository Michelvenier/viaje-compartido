// router.js — Mini router HTTP sin dependencias externas.
"use strict";

class Router {
  constructor() {
    this.routes = [];
  }

  _add(method, path, handler) {
    const paramNames = [];
    const pattern =
      "^" +
      path
        .replace(/\/:([A-Za-z_]+)/g, (_, name) => {
          paramNames.push(name);
          return "/([^/]+)";
        })
        .replace(/\//g, "\\/") +
      "$";
    this.routes.push({ method, regex: new RegExp(pattern), paramNames, handler });
  }

  get(path, handler) {
    this._add("GET", path, handler);
  }
  post(path, handler) {
    this._add("POST", path, handler);
  }
  patch(path, handler) {
    this._add("PATCH", path, handler);
  }
  delete(path, handler) {
    this._add("DELETE", path, handler);
  }

  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(pathname);
      if (m) {
        const params = {};
        route.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])));
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}

module.exports = Router;
