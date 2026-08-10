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

// Nunca tira excepción: si el email no se pudo mandar (falta la API key, Resend caído, etc.), lo
// registra en los logs de Vercel y devuelve { enviado: false, motivo } — el aviso por email es un
// "nice to have" y no tiene que romper la operación real (marcar la inasistencia) si falla.
async function enviarEmailAdmin({ asunto, texto }) {
  const apiKey = process.env.RESEND_API_KEY;
  const destinatario = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY no está configurada — no se manda el aviso por email. Agregala en Vercel (Settings → Environment Variables) para activar esta notificación."
    );
    return { enviado: false, motivo: "RESEND_API_KEY no configurada" };
  }
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
      return { enviado: false, motivo: `Resend respondió ${resp.status}` };
    }
    return { enviado: true };
  } catch (err) {
    console.error("[email] Error de red mandando el email:", err.message);
    return { enviado: false, motivo: err.message };
  }
}

module.exports = { enviarEmailAdmin };
