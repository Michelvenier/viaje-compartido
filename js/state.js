// state.js — sesión del usuario (guardada en localStorage) + helpers de UI (toasts).
const Session = (() => {
  const KEY = "rutacompartida_usuario";

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

// Convierte un teléfono cargado en cualquier formato ("011 15-4567-8901", "1145678901",
// "+54 9 11 4567-8901", etc.) al formato que necesita el link wa.me (54 9 + código de área + número,
// sin el 0 de larga distancia ni el 15 de celular). Es una heurística — el campo de teléfono es texto
// libre, no hay forma de acertar siempre, así que el admin igual tiene que revisar el número antes de
// mandar el mensaje. Devuelve null si no hay teléfono cargado.
function formatearNumeroWhatsapp(telefono) {
  if (!telefono) return null;
  let digitos = String(telefono).replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("0")) digitos = digitos.slice(1); // saca el 0 de larga distancia
  digitos = digitos.replace(/^(\d{2,4})15/, "$1"); // saca el "15" de celular si quedó pegado después del código de área
  if (digitos.startsWith("54")) {
    digitos = digitos.startsWith("549") ? digitos : "549" + digitos.slice(2);
  } else {
    digitos = "549" + digitos;
  }
  return digitos;
}

// Mensaje de confirmación mostrado ANTES de cancelar una reserva, calculado en el cliente con la
// misma regla de las 24 hs que aplica el servidor (api/routes/reservas.js calcularReembolsoAplica)
// — así el pasajero sabe, antes de confirmar, si va a perder la comisión o no. El servidor vuelve
// a calcularlo de forma autoritativa al procesar la cancelación; esto es solo para el aviso previo.
function mensajeConfirmacionCancelacion(fechaSalida, horaSalida, pagado) {
  if (!pagado) {
    return "¿Confirmás que querés cancelar esta reserva? Como todavía no pagaste la comisión, no se te cobra nada.";
  }
  const salida = new Date(`${fechaSalida}T${horaSalida}:00`);
  const reembolsoAplica = Number.isNaN(salida.getTime()) || salida.getTime() - Date.now() >= 24 * 60 * 60 * 1000;
  return reembolsoAplica
    ? "¿Confirmás que querés cancelar esta reserva? Como faltan 24 hs o más para la salida, se te reembolsa el 100% de la comisión pagada."
    : "¿Confirmás que querés cancelar esta reserva? Como faltan menos de 24 hs para la salida, NO corresponde reembolso de la comisión ya pagada.";
}
