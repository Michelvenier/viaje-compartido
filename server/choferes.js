// server/choferes.js — Confiabilidad de conductores: cancelaciones consecutivas y suspensión
// automática (a pedido del usuario, 14 ago 2026: "suspender a los que cancelan 3 viajes seguidos y
// a los 2 generar una alerta").
"use strict";

const db = require("./db");
const pricing = require("./pricing");
const { nowIso } = require("./helpers");

// Cuenta cuántos de los viajes MÁS RECIENTES de un conductor (por fecha de creación) están
// cancelados, SEGUIDOS, sin interrupción — se corta apenas aparece uno que no está cancelado
// (activo o completado). Se calcula en vivo con una consulta simple, no se guarda ningún contador
// aparte, así nunca puede quedar desincronizado con la tabla de viajes real.
async function contarCancelacionesConsecutivas(conductorId) {
  const rows = await db.all("SELECT estado FROM viajes WHERE conductor_id = ? ORDER BY created_at DESC", [conductorId]);
  let consecutivas = 0;
  for (const row of rows) {
    if (row.estado === "cancelado") consecutivas++;
    else break;
  }
  return consecutivas;
}

// Se llama después de cada cancelación de un conductor (ver server/routes/viajes.js cancelar()).
// Si llegó al umbral de suspensión y todavía no estaba suspendido, lo suspende. Devuelve el estado
// actual para que quien llama pueda avisarle al conductor en el mensaje de respuesta.
async function evaluarSuspensionPorCancelaciones(conductorId) {
  const consecutivas = await contarCancelacionesConsecutivas(conductorId);
  const umbralAlerta = (await pricing.getConfig("alerta_cancelaciones_consecutivas")) || 2;
  const umbralSuspension = (await pricing.getConfig("suspension_cancelaciones_consecutivas")) || 3;

  let suspendidoAhora = false;
  if (consecutivas >= umbralSuspension) {
    const usuario = await db.get("SELECT suspendido FROM usuarios WHERE id = ?", [conductorId]);
    if (usuario && !usuario.suspendido) {
      await db.run("UPDATE usuarios SET suspendido = 1, suspendido_motivo = ?, suspendido_at = ? WHERE id = ?", [
        `Canceló ${consecutivas} viajes seguidos.`,
        nowIso(),
        conductorId,
      ]);
      suspendidoAhora = true;
    }
  }
  return {
    consecutivas,
    alerta: consecutivas >= umbralAlerta,
    suspendido: consecutivas >= umbralSuspension || suspendidoAhora,
    suspendidoAhora,
  };
}

module.exports = { contarCancelacionesConsecutivas, evaluarSuspensionPorCancelaciones };
