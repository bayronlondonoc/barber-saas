// Pagos de anticipos: simulador (local) o Wompi (Colombia: Nequi, PSE, tarjetas, Bancolombia...).
// Cada barbería conecta SU cuenta de Wompi (la plata le llega directo a ella).
// Flujo: se crea un link de pago por cita → el cliente paga → Wompi avisa a /webhooks/wompi/:barberia
// → se verifica la firma → la cita queda con el anticipo pagado y el cliente recibe la confirmación.
"use strict";
const crypto = require("crypto");
const config = require("./config");
const { uno, ejecutar, firmar } = require("./db");
const util = require("./util");
let _nucleo; function nucleo() { return _nucleo || (_nucleo = require("./nucleo")); }

function credenciales(barberiaId) {
  const f = uno("SELECT datos FROM integraciones WHERE barberia_id = ? AND tipo = 'pagos'", barberiaId);
  const d = f ? JSON.parse(f.datos) : {};
  const llave = d.wompi_llave_privada || config.pagos.wompiLlavePrivada;
  const secreto = d.wompi_secreto_eventos || config.pagos.wompiSecretoEventos;
  const wompi = (config.pagos.proveedor === "wompi" || d.wompi_llave_privada) && llave;
  return {
    proveedor: wompi ? "wompi" : "simulador",
    llave, secreto,
    ambiente: String(llave || "").startsWith("prv_prod_") ? "produccion" : "sandbox"
  };
}
function baseWompi(cred) { return cred.ambiente === "produccion" ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1"; }

/** Devuelve el link de pago del anticipo de una cita (lo crea si no existe uno vigente). */
async function prepararPago(barberiaId, citaId) {
  const vigente = uno("SELECT * FROM pagos WHERE barberia_id = ? AND cita_id = ? AND estado = 'pendiente' AND url IS NOT NULL ORDER BY creado DESC LIMIT 1", barberiaId, citaId);
  if (vigente && Date.now() - new Date(vigente.creado).getTime() < 90 * 60000) return vigente.url;

  // Datos de la cita (y el link de vuelta a la confirmación, firmado)
  const info = nucleo().leer(barberiaId, (BS) => {
    const c = BS.cita(citaId);
    if (!c) throw new util.ErrorHTTP(404, "Cita no encontrada.");
    const s = BS.get().shop, srv = BS.servicio(c.servicio) || { nombre: "Servicio" };
    return {
      monto: (c.anticipo && c.anticipo.monto) || BS.montoAnticipo(c.precio), pagado: !!(c.anticipo && c.anticipo.pagado),
      nombre: "Anticipo · " + s.nombre, descripcion: srv.nombre + " · " + BS.util.fechaCorta(c.inicio) + " " + BS.util.hora(c.inicio),
      redirect: config.urlPublica + "/reserva/?b=" + encodeURIComponent(s.slug) + "&cita=" + encodeURIComponent(c.id) + "&t=" + encodeURIComponent(firmar(c.id))
    };
  });
  if (info.pagado) return info.redirect;

  const cred = credenciales(barberiaId);
  const idPago = util.id("pg");
  const ahora = new Date().toISOString();
  let url, ref = null;
  if (cred.proveedor === "wompi") {
    const r = await fetch(baseWompi(cred) + "/payment_links", {
      method: "POST",
      headers: { Authorization: "Bearer " + cred.llave, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: info.nombre.slice(0, 60), description: info.descripcion.slice(0, 120), single_use: true, collect_shipping: false,
        currency: "COP", amount_in_cents: Math.round(info.monto) * 100, redirect_url: info.redirect,
        expires_at: new Date(Date.now() + 2 * 3600000).toISOString(), sku: idPago.slice(0, 36)
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.data || !j.data.id) throw new Error("Wompi no creó el link: " + ((j.error && (j.error.reason || JSON.stringify(j.error.messages || j.error))) || r.status));
    ref = j.data.id;
    url = "https://checkout.wompi.co/l/" + j.data.id;
  } else {
    url = config.urlPublica + "/pago-simulado/?id=" + encodeURIComponent(idPago);
  }
  ejecutar("INSERT INTO pagos (id, barberia_id, cita_id, proveedor, proveedor_ref, monto, estado, url, redirect, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)",
    idPago, barberiaId, citaId, cred.proveedor, ref, Math.round(info.monto), url, info.redirect, ahora, ahora);
  return url;
}

/** Marca el anticipo como pagado (una sola vez) y avisa al cliente. */
function aprobar(pago, medio) {
  if (pago.estado === "aprobado") return false;
  ejecutar("UPDATE pagos SET estado = 'aprobado', medio = ?, actualizado = ? WHERE id = ?", medio, new Date().toISOString(), pago.id);
  nucleo().transaccion(pago.barberia_id, (BS, ctx) => {
    const c = BS.cita(pago.cita_id);
    if (!c || (c.anticipo && c.anticipo.pagado)) return;
    if (c.estado === "cancelada") return;
    BS.pagarAnticipo(c.id, medio);
    require("./motor").anticipoRecibido(BS, ctx, c.id);
  });
  return true;
}
function rechazar(pago, motivo) {
  ejecutar("UPDATE pagos SET estado = 'rechazado', medio = ?, actualizado = ? WHERE id = ? AND estado = 'pendiente'", motivo || null, new Date().toISOString(), pago.id);
}

/* ---------------- Webhook de Wompi ---------------- */
function valorEn(obj, ruta) { return ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function checksumValido(evento, secreto, cabecera) {
  if (!secreto || !evento.signature || !Array.isArray(evento.signature.properties)) return false;
  const cadena = evento.signature.properties.map((p) => String(valorEn(evento.data, p))).join("") + String(evento.timestamp) + secreto;
  const calculado = crypto.createHash("sha256").update(cadena).digest("hex");
  const recibido = cabecera || evento.signature.checksum || "";
  return util.iguales(calculado.toLowerCase(), String(recibido).toLowerCase());
}
const MEDIO_WOMPI = { NEQUI: "nequi", PSE: "pse", CARD: "tarjeta", DAVIPLATA: "daviplata", BANCOLOMBIA_TRANSFER: "pse", BANCOLOMBIA_QR: "breb", BANCOLOMBIA_COLLECT: "efectivo" };

function webhookWompi(barberiaId, evento, cabecera) {
  const cred = credenciales(barberiaId);
  if (!checksumValido(evento, cred.secreto, cabecera)) throw new util.ErrorHTTP(401, "Firma inválida.");
  if (evento.event !== "transaction.updated") return { ignorado: true };
  const tx = (evento.data && evento.data.transaction) || {};
  const clave = "wompi:" + tx.id + ":" + tx.status;
  const nuevo = ejecutar("INSERT OR IGNORE INTO webhooks_vistos (id, origen, recibido) VALUES (?, 'wompi', ?)", clave, new Date().toISOString()).changes > 0;
  if (!nuevo) return { repetido: true };
  const pago = uno("SELECT * FROM pagos WHERE barberia_id = ? AND proveedor = 'wompi' AND proveedor_ref = ?", barberiaId, String(tx.payment_link_id || ""));
  if (!pago) return { sinPago: true };
  if (tx.status === "APPROVED") {
    const tipo = String(tx.payment_method_type || "").toUpperCase();
    aprobar(pago, tipo.includes("BRE") ? "breb" : MEDIO_WOMPI[tipo] || "pse");
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(tx.status)) rechazar(pago, tx.status);
  return { ok: true };
}

/* ---------------- Pasarela simulada (solo cuando no hay Wompi) ---------------- */
function infoSimulado(idPago) {
  const p = uno("SELECT * FROM pagos WHERE id = ? AND proveedor = 'simulador'", idPago);
  if (!p) throw new util.ErrorHTTP(404, "Pago no encontrado.");
  const extra = nucleo().leer(p.barberia_id, (BS) => {
    const c = BS.cita(p.cita_id), s = BS.get().shop;
    return { barberia: s.nombre, descripcion: c ? (BS.servicio(c.servicio) || {}).nombre + " · " + BS.util.fechaCorta(c.inicio) + " " + BS.util.hora(c.inicio) : "", medios: s.medios };
  });
  return Object.assign({ id: p.id, monto: p.monto, estado: p.estado, redirect: p.redirect }, extra);
}
function resolverSimulado(idPago, resultado, medio) {
  const p = uno("SELECT * FROM pagos WHERE id = ? AND proveedor = 'simulador'", idPago);
  if (!p) throw new util.ErrorHTTP(404, "Pago no encontrado.");
  if (resultado === "aprobado") aprobar(p, ["nequi", "breb", "pse", "daviplata", "tarjeta"].includes(medio) ? medio : "breb");
  else rechazar(p, "DECLINED");
  return { redirect: p.redirect };
}

module.exports = { credenciales, prepararPago, webhookWompi, infoSimulado, resolverSimulado };
