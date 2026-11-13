// WhatsApp: cola de envíos con reintentos + proveedor (simulador o API oficial de Meta, Cloud API).
// Regla de Meta: si el cliente escribió en las últimas 24 h se puede mandar texto libre (y botones);
// si no, solo plantillas aprobadas. Cada mensaje de la cola lleva las dos versiones.
"use strict";
const crypto = require("crypto");
const config = require("./config");
const { uno, todos, ejecutar } = require("./db");
const util = require("./util");

/* ---------------- Configuración por barbería ---------------- */
function integracion(barberiaId) {
  const f = uno("SELECT datos FROM integraciones WHERE barberia_id = ? AND tipo = 'whatsapp'", barberiaId);
  return f ? JSON.parse(f.datos) : {};
}
function proveedor(barberiaId) {
  const it = integracion(barberiaId);
  const phoneNumberId = it.phone_number_id || config.whatsapp.phoneNumberId;
  const meta = config.whatsapp.proveedor === "meta" && config.whatsapp.token && phoneNumberId;
  return { tipo: meta ? "meta" : "simulador", phoneNumberId };
}

/* ---------------- Cola ---------------- */
function esPrueba(tel) { return String(tel).startsWith("prueba:"); }

/** Mete un mensaje en la cola. contenido = { texto, botones?: [{id,titulo}], plantilla?: {nombre, variables, payloads} } */
function encolar(barberiaId, telefono, contenido, opts) {
  opts = opts || {};
  const tel = esPrueba(telefono) ? telefono : util.normTel(telefono);
  if (!esPrueba(tel) && !util.telValido(tel)) return null;
  const idM = util.id("msg");
  const ahora = new Date().toISOString();
  ejecutar(
    "INSERT INTO mensajes (id, barberia_id, direccion, telefono, contenido, estado, intentos, auto_id, creado, enviar_desde) VALUES (?, ?, 'salida', ?, ?, 'pendiente', 0, ?, ?, ?)",
    idM, barberiaId, tel, JSON.stringify(contenido), opts.auto || null, ahora, opts.enviarDesde || ahora
  );
  return idM;
}

function registrarEntrada(barberiaId, telefono, contenido, proveedorId) {
  ejecutar("INSERT INTO mensajes (id, barberia_id, direccion, telefono, contenido, estado, proveedor_id, creado, enviar_desde) VALUES (?, ?, 'entrada', ?, ?, 'recibido', ?, ?, ?)",
    util.id("msg"), barberiaId, telefono, JSON.stringify(contenido), proveedorId || null, new Date().toISOString(), new Date().toISOString());
}

function ventanaAbierta(barberiaId, telefono) {
  const f = uno("SELECT ultima_entrada FROM conversaciones WHERE barberia_id = ? AND telefono = ?", barberiaId, telefono);
  return !!(f && f.ultima_entrada && Date.now() - new Date(f.ultima_entrada).getTime() < 23.5 * 3600000);
}

/** Guarda lo enviado en la conversación (así el panel puede mostrar el historial). */
function anotarEnConversacion(barberiaId, telefono, texto) {
  const f = uno("SELECT datos FROM conversaciones WHERE barberia_id = ? AND telefono = ?", barberiaId, telefono);
  if (!f) return;
  const d = JSON.parse(f.datos);
  d.mensajes = (d.mensajes || []).concat([{ de: "bot", texto, hora: new Date().toISOString(), automatico: true }]).slice(-80);
  ejecutar("UPDATE conversaciones SET datos = ?, actualizada = ? WHERE barberia_id = ? AND telefono = ?", JSON.stringify(d), new Date().toISOString(), barberiaId, telefono);
}

/** Reemplaza {{link_pago:CITA}} por el link real de la pasarela (se crea en ese momento). */
async function resolverLinks(barberiaId, contenido) {
  const re = /\{\{link_pago:([\w-]+)\}\}/g;
  const ids = new Set();
  const juntar = (t) => { let m; re.lastIndex = 0; while ((m = re.exec(t || ""))) ids.add(m[1]); };
  juntar(contenido.texto);
  ((contenido.plantilla && contenido.plantilla.variables) || []).forEach(juntar);
  if (!ids.size) return contenido;
  const pagos = require("./pagos");
  const urls = {};
  for (const citaId of ids) {
    try { urls[citaId] = await pagos.prepararPago(barberiaId, citaId); }
    catch (e) {
      // Cita borrada: no hay link que mandar. Pasarela caída: mejor reintentar que mandar el mensaje sin link.
      if (e.estado === 404) urls[citaId] = "";
      else throw new Error("No se pudo crear el link de pago (" + e.message + "). Se reintenta.");
    }
  }
  const reemplazar = (t) => String(t || "").replace(re, (_, c) => urls[c] || "");
  return Object.assign({}, contenido, {
    texto: reemplazar(contenido.texto),
    plantilla: contenido.plantilla ? Object.assign({}, contenido.plantilla, { variables: contenido.plantilla.variables.map(reemplazar) }) : undefined
  });
}

/* ---------------- Meta (WhatsApp Cloud API) ---------------- */
function payloadMeta(tel, c, ventana) {
  const to = util.telWA(tel);
  if (ventana) {
    if (c.botones && c.botones.length) {
      return {
        messaging_product: "whatsapp", recipient_type: "individual", to, type: "interactive",
        interactive: { type: "button", body: { text: c.texto.slice(0, 1024) }, action: { buttons: c.botones.slice(0, 3).map((b) => ({ type: "reply", reply: { id: String(b.id).slice(0, 256), title: String(b.titulo).slice(0, 20) } })) } }
      };
    }
    return { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: c.texto.slice(0, 4096) } };
  }
  if (!c.plantilla) return null;
  const componentes = [{ type: "body", parameters: c.plantilla.variables.map((v) => ({ type: "text", text: String(v) })) }];
  (c.plantilla.payloads || []).forEach((p, i) => componentes.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: String(p) }] }));
  return { messaging_product: "whatsapp", to, type: "template", template: { name: c.plantilla.nombre, language: { code: config.whatsapp.idioma }, components: componentes } };
}

async function enviarMeta(phoneNumberId, payload) {
  const r = await fetch(`https://graph.facebook.com/${config.whatsapp.version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: "Bearer " + config.whatsapp.token, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "Error " + r.status);
  return j.messages && j.messages[0] ? j.messages[0].id : null;
}

/* ---------------- Procesar la cola ---------------- */
let procesando = false, otraVuelta = false;
async function procesarCola() {
  if (procesando) { otraVuelta = true; return; }
  procesando = true;
  try {
    for (let vuelta = 0; vuelta < 20; vuelta++) {
      const filas = todos("SELECT * FROM mensajes WHERE direccion = 'salida' AND estado = 'pendiente' AND enviar_desde <= ? ORDER BY creado, rowid LIMIT 25", new Date().toISOString());
      if (!filas.length) break;
      for (const f of filas) await enviarUno(f);
    }
  } finally {
    procesando = false;
    if (otraVuelta) { otraVuelta = false; setImmediate(procesarCola); }
  }
}

async function enviarUno(f) {
  let contenido = JSON.parse(f.contenido);
  try {
    contenido = await resolverLinks(f.barberia_id, contenido);
    const prov = proveedor(f.barberia_id);
    if (prov.tipo !== "meta" || esPrueba(f.telefono)) {
      ejecutar("UPDATE mensajes SET estado = 'simulado', contenido = ? WHERE id = ?", JSON.stringify(contenido), f.id);
      anotarEnConversacion(f.barberia_id, f.telefono, contenido.texto);
      if (!config.produccion && !esPrueba(f.telefono)) console.log(`[whatsapp simulado] → ${f.telefono}: ${String(contenido.texto).slice(0, 140)}`);
      return;
    }
    const ventana = ventanaAbierta(f.barberia_id, f.telefono);
    const payload = payloadMeta(f.telefono, contenido, ventana);
    if (!payload) {
      ejecutar("UPDATE mensajes SET estado = 'sin_ventana', error = ? WHERE id = ?", "El cliente no escribió en 24 h y este mensaje no tiene plantilla aprobada.", f.id);
      return;
    }
    const idMeta = await enviarMeta(prov.phoneNumberId, payload);
    ejecutar("UPDATE mensajes SET estado = 'enviado', proveedor_id = ?, contenido = ? WHERE id = ?", idMeta, JSON.stringify(contenido), f.id);
    anotarEnConversacion(f.barberia_id, f.telefono, contenido.texto);
  } catch (err) {
    const intentos = f.intentos + 1;
    const espera = [60, 300, 1800][Math.min(intentos - 1, 2)] * 1000;
    ejecutar("UPDATE mensajes SET intentos = ?, error = ?, estado = ?, enviar_desde = ? WHERE id = ?",
      intentos, String(err.message).slice(0, 500), intentos >= 3 ? "error" : "pendiente", new Date(Date.now() + espera).toISOString(), f.id);
    console.warn("[whatsapp] no se pudo enviar", f.id, err.message);
  }
}
setInterval(() => { procesarCola().catch((e) => console.warn("[cola]", e)); }, 5000).unref();

/* ---------------- Webhook de Meta ---------------- */
function verificarFirma(crudo, cabecera) {
  if (!config.whatsapp.appSecret) return !config.produccion; // en local se permite sin secreto
  if (!cabecera || !cabecera.startsWith("sha256=")) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", config.whatsapp.appSecret).update(crudo).digest("hex");
  return util.iguales(esperado, cabecera);
}

/** Saca los mensajes entrantes y los estados de entrega del cuerpo que manda Meta. */
function leerWebhook(cuerpo) {
  const entrantes = [], estados = [];
  for (const entry of cuerpo.entry || []) {
    for (const cambio of entry.changes || []) {
      const v = cambio.value || {};
      const phoneNumberId = v.metadata && v.metadata.phone_number_id;
      const nombres = {};
      (v.contacts || []).forEach((c) => { nombres[c.wa_id] = c.profile && c.profile.name; });
      for (const m of v.messages || []) {
        let texto = "", payload = "";
        if (m.type === "text") texto = m.text && m.text.body;
        else if (m.type === "interactive" && m.interactive) {
          const r = m.interactive.button_reply || m.interactive.list_reply || {};
          payload = r.id || ""; texto = r.title || "";
        } else if (m.type === "button" && m.button) { payload = m.button.payload || ""; texto = m.button.text || ""; }
        else texto = "";
        entrantes.push({ phoneNumberId, from: m.from, id: m.id, nombre: nombres[m.from] || "", texto: String(texto || ""), payload: String(payload || ""), tipo: m.type });
      }
      for (const s of v.statuses || []) estados.push({ id: s.id, estado: s.status });
    }
  }
  return { entrantes, estados };
}

function barberiaPorNumero(phoneNumberId) {
  const filas = todos("SELECT barberia_id, datos FROM integraciones WHERE tipo = 'whatsapp'");
  for (const f of filas) { try { if (JSON.parse(f.datos).phone_number_id === phoneNumberId) return f.barberia_id; } catch (e) { /* dato dañado */ } }
  if (config.barberiaPrincipal) { const b = uno("SELECT id FROM barberias WHERE slug = ?", config.barberiaPrincipal); if (b) return b.id; }
  // Sin número asignado solo es seguro si hay UNA barbería; si hay varias, no se adivina a quién le llega
  const todas = todos("SELECT id FROM barberias LIMIT 2");
  if (todas.length === 1) return todas[0].id;
  console.warn("[whatsapp] mensaje a un número sin barbería asignada (" + phoneNumberId + "). Asignalo en Ajustes → Conexiones o con BARBERIA_PRINCIPAL.");
  return null;
}
function numeroOcupado(phoneNumberId, barberiaId) {
  return todos("SELECT barberia_id, datos FROM integraciones WHERE tipo = 'whatsapp'").some((f) => {
    try { return f.barberia_id !== barberiaId && JSON.parse(f.datos).phone_number_id === phoneNumberId; } catch (e) { return false; }
  });
}

function actualizarEstadoEntrega(idMeta, estado) {
  const mapa = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };
  if (mapa[estado]) ejecutar("UPDATE mensajes SET estado = ? WHERE proveedor_id = ?", mapa[estado], idMeta);
}

module.exports = {
  proveedor, integracion, encolar, registrarEntrada, procesarCola, ventanaAbierta, verificarFirma, leerWebhook,
  barberiaPorNumero, numeroOcupado, actualizarEstadoEntrega, esPrueba
};
