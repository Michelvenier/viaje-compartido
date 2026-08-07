// state.js — sesión del usuario (demo, guardada en localStorage) + helpers de UI (toasts).
const Session = (() => {
  const KEY = "viajecompartido_usuario";

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function set(usuario) {
    localStorage.setItem(KEY, JSON.stringify(usuario));
  }
  function clear() {
    localStorage.removeItem(KEY);
  }
  return { get, set, clear };
})();

function toast(mensaje, tipo = "info") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = mensaje;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function fmtMoney(n) {
  return "$" + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function fmtFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function iniciales(nombre, apellido) {
  return `${(nombre || "?")[0] || ""}${(apellido || "")[0] || ""}`.toUpperCase();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
