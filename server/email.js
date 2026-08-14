// api/email.js — Envío de emails al admin (avisos de inasistencia y demás notificaciones
// internas) usando la API HTTP de Resend (https://resend.com) con `fetch` nativo de Node —
// sin agregar ninguna dependencia npm nueva, en línea con el resto del proyecto.
//
// Requiere las variables de entorno (configurar SOLO en Vercel, nunca en el código/git):
//   - RESEND_API_KEY: la API key de tu cuenta de Resend (gratis hasta 3.000 emails/mes).
//   - ADMIN_EMAIL: el email del admin al que le llegan los avisos (por defecto, michelvenier10@gmail.com).
//   - EMAIL_FROM (opcional): remitente. Si no verificaste un dominio propio en Resend, dejalo sin
//     definir y se usa "onboarding@resend.dev" — funciona sin configuración extra, pero Resend solo
//     te deja mandar a la casilla con la que te registraste hasta que verifiques un dominio propio.
"use strict";

const DEFAULT_FROM = "Ruta Compartida <onboarding@resend.dev>";
const DEFAULT_ADMIN_EMAIL = "michelvenier10@gmail.com";

// Nunca tira excepción: si el email no se pudo mandar (falta la API key, Resend caído, destinatario
// no permitido en modo sandbox, etc.), lo registra en los logs de Vercel y devuelve
// { enviado: false, motivo } — el aviso por email es un "nice to have" y no tiene que romper la
// operación real (marcar la inasistencia, resetear una contraseña) si falla.
//
// OJO — límite de Resend sin dominio verificado: mientras no verifiques un dominio propio en Resend
// (Settings → Domains), la cuenta queda en modo sandbox y SOLO te deja mandar emails a la casilla
// con la que te registraste ahí. Mandar a cualquier otro destinatario (ej. el email de un usuario
// cualquiera de la app) va a fallar con un error de Resend hasta que verifiques un dominio.
async function enviarEmail({ destinatario, asunto, texto }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY no está configurada — no se manda el email. Agregala en Vercel (Settings → Environment Variables) para activar esto."
    );
    return { enviado: false, motivo: "RESEND_API_KEY no configurada" };
  }
  if (!destinatario) return { enviado: false, motivo: "Falta el email del destinatario" };
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [destinatario],
        subject: asunto,
        text: texto,
      }),
    });
    if (!resp.ok) {
      const detalle = await resp.text().catch(() => "");
      console.error(`[email] Resend respondió ${resp.status}: ${detalle}`);
      const pistaSandbox = !process.env.EMAIL_FROM
        ? " (si el destinatario no es el mail con el que te registraste en Resend, esto es esperable: sin verificar un dominio propio, Resend solo deja mandar a esa casilla)"
        : "";
      return { enviado: false, motivo: `Resend respondió ${resp.status}${pistaSandbox}` };
    }
    return { enviado: true };
  } catch (err) {
    console.error("[email] Error de red mandando el email:", err.message);
    return { enviado: false, motivo: err.message };
  }
}

// Avisos internos al admin (inasistencias, etc.) — siempre van a ADMIN_EMAIL, que es justamente
// la casilla que SÍ funciona sin verificar dominio (es la que registró la cuenta de Resend).
async function enviarEmailAdmin({ asunto, texto }) {
  const destinatario = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  return enviarEmail({ destinatario, asunto, texto });
}

module.exports = { enviarEmail, enviarEmailAdmin };
