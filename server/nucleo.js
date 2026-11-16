// Núcleo: carga en Node la MISMA lógica de negocio del navegador (store.js, engine.js,
// asistente-core.js) y la aplica sobre el estado de cada barbería dentro de una transacción.
"use strict";
const config = require("./config");
const { uno, todos, ejecutar, enTransaccion } = require("./db");
const util = require("./util");

require("../assets/js/store.js");
require("../assets/js/engine.js");
require("../assets/js/asistente-core.js");
const BS = globalThis.BS;
const emitOriginal = BS.emit;
// En el servidor, los links que van en los mensajes son los de verdad (no el ejemplo del navegador)
BS.linkReservas = function () { return config.urlPublica + "/reserva/?b=" + encodeURIComponent(BS.get().shop.slug); };
BS.linkFila = function () { return BS.linkReservas() + "&modo=fila"; };
let _motor = null;
function motor() { return _motor || (_motor = require("./motor")); }

/* ---------------- Tiempo real (Server-Sent Events) ---------------- */
const suscriptores = new Map();
function suscribir(barberiaId, res) {
  if (!suscriptores.has(barberiaId)) suscriptores.set(barberiaId, new Set());
  suscriptores.get(barberiaId).add(res);
  res.on("close", () => { const s = suscriptores.get(barberiaId); if (s) s.delete(res); });
}
function avisar(barberiaId, version) {
  const s = suscriptores.get(barberiaId);
  if (!s) return;
  const dato = `event: cambio\ndata: ${JSON.stringify({ version })}\n\n`;
  for (const res of s) { try { res.write(dato); } catch (e) { s.delete(res); } }
}
setInterval(() => { for (const s of suscriptores.values()) for (const res of s) { try { res.write(": latido\n\n"); } catch (e) { /* se limpia al cerrar */ } } }, 25000).unref();

/* ---------------- Barberías ---------------- */
function slugDe(nombre) {
  return BS.util.normalizar(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "barberia";
}
function slugLibre(slug, excluirId) {
  const f = uno("SELECT id FROM barberias WHERE slug = ?", slug);
  return !f || f.id === excluirId;
}
const SLUGS_RESERVADOS = new Set(["explorar", "app", "reserva", "api", "assets", "webhooks", "pago-simulado"]);
function slugUnico(nombre) {
  const base = slugDe(nombre);
  let slug = base, n = 2;
  while (!slugLibre(slug) || SLUGS_RESERVADOS.has(slug)) slug = base + "-" + n++;
  return slug;
}

function crearBarberia(d) {
  const idB = util.id("bar");
  const slug = slugUnico(d.nombre);
  let est;
  if (d.ejemplo) {
    est = BS.semilla();
    Object.assign(est.shop, { nombre: d.nombre, barrio: d.barrio || est.shop.barrio, direccion: (d.barrio || est.shop.barrio) + ", Medellín", dueno: d.dueno, whatsapp: d.whatsapp || "", onboarded: true, linkResena: "" });
    est.barberos[0].nombre = d.dueno;
    est.ajustes.demoVivo = false;
    // Los clientes de ejemplo tienen números inventados: el servidor NUNCA les escribe por WhatsApp
    est.clientes.forEach((c) => { c.ejemplo = true; });
    est.fila.forEach((f) => { f.ejemplo = true; });
  } else {
    // Cuenta nueva y vacía: el dueño termina de configurarla en el registro paso a paso del panel
    est = BS.estadoNuevo({ nombre: d.nombre, barrio: d.barrio, dueno: d.dueno, whatsapp: d.whatsapp, onboarded: d.onboarded });
  }
  est.shop.slug = slug;
  const ahora = new Date().toISOString();
  ejecutar("INSERT INTO barberias (id, slug, estado, version, creada, actualizada) VALUES (?, ?, ?, 1, ?, ?)", idB, slug, JSON.stringify(est), ahora, ahora);
  return { id: idB, slug };
}

function filaBarberia(barberiaId) {
  const f = uno("SELECT * FROM barberias WHERE id = ?", barberiaId);
  if (!f) throw new util.ErrorHTTP(404, "Barbería no encontrada.");
  return f;
}
function porSlug(slug) { return uno("SELECT id, slug, version FROM barberias WHERE slug = ?", String(slug || "")); }

function prepararLinks(estado) {
  BS.linkReservas = () => config.urlPublica + "/reserva/?b=" + encodeURIComponent(estado.shop.slug);
  BS.linkFila = () => BS.linkReservas() + "&modo=fila";
}

/** Solo lectura: entrega BS apuntando al estado de la barbería. */
function leer(barberiaId, fn) {
  const f = filaBarberia(barberiaId);
  const estado = JSON.parse(f.estado);
  BS.usar(estado);
  prepararLinks(estado);
  try { return fn(BS, { barberiaId, estado, version: f.version, slug: f.slug }); }
  finally { BS.usar(null); }
}

/** Mueve citas viejas (más de 120 días) a la tabla de archivo para que el documento no crezca sin fin. */
function archivar(ctx) {
  const limite = Date.now() - 120 * 86400000;
  const viejas = ctx.estado.citas.filter((c) => new Date(c.inicio).getTime() < limite);
  if (!viejas.length) return;
  for (const c of viejas) ejecutar("INSERT OR REPLACE INTO citas_archivo (id, barberia_id, datos, inicio) VALUES (?, ?, ?, ?)", c.id, ctx.barberiaId, JSON.stringify(c), c.inicio);
  const fuera = new Set(viejas.map((c) => c.id));
  ctx.estado.citas = ctx.estado.citas.filter((c) => !fuera.has(c.id));
}

/**
 * Cambia el estado de una barbería de forma atómica:
 * carga → fn(BS, ctx) → el motor atiende los eventos (manda WhatsApp, etc.) → guarda → avisa en vivo.
 */
function transaccion(barberiaId, fn) {
  let version = 0;
  const resultado = enTransaccion(() => {
    const fila = filaBarberia(barberiaId);
    const estado = JSON.parse(fila.estado);
    const ctx = { barberiaId, estado, slug: fila.slug, eventos: [] };
    BS.usar(estado);
    prepararLinks(estado);
    BS.emit = (ev, d) => ctx.eventos.push({ ev, d: d || {} });
    try {
      const r = fn(BS, ctx);
      for (let i = 0; i < ctx.eventos.length && i < 300; i++) motor().manejar(BS, ctx, ctx.eventos[i]);
      archivar(ctx);
      let slug = fila.slug;
      const pedido = String(estado.shop.slug || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
      if (pedido && pedido !== fila.slug && slugLibre(pedido, barberiaId)) slug = pedido;
      estado.shop.slug = slug;
      version = fila.version + 1;
      ejecutar("UPDATE barberias SET estado = ?, version = ?, slug = ?, actualizada = ? WHERE id = ?", JSON.stringify(estado), version, slug, new Date().toISOString(), barberiaId);
      return r;
    } finally {
      BS.usar(null);
      BS.emit = emitOriginal;
    }
  });
  avisar(barberiaId, version);
  motor().despues();
  return resultado;
}

/* ---------------- Parches que manda el panel ---------------- */
const PROTEGIDOS = { autos: ["stats"] }; // campos que solo el servidor actualiza

/** Aplica el parche del panel y deduce los eventos (cita creada, cancelada, fila...) para el motor. */
function aplicarParche(BS, ctx, parche) {
  if (!parche || typeof parche !== "object") throw new util.ErrorHTTP(400, "Parche inválido.");
  const est = ctx.estado, eventos = [];
  const cols = parche.colecciones || {};
  let total = 0;
  for (const k of Object.keys(cols)) {
    if (BS.COLECCIONES.indexOf(k) < 0) { delete cols[k]; continue; }
    const c = cols[k];
    c.upsert = Array.isArray(c.upsert) ? c.upsert.filter((x) => x && typeof x === "object" && typeof x.id === "string" && x.id.length < 80) : [];
    c.borrar = Array.isArray(c.borrar) ? c.borrar.filter((x) => typeof x === "string") : [];
    total += c.upsert.length + c.borrar.length;
    const previos = new Map((est[k] || []).map((x) => [x.id, x]));
    c.upsert = c.upsert.map((nuevo) => {
      const antes = previos.get(nuevo.id);
      if (!antes) {
        if (k === "citas") eventos.push({ ev: "cita.creada", id: nuevo.id });
        if (k === "fila") eventos.push({ ev: "fila.entra", id: nuevo.id });
        return nuevo;
      }
      const mezcla = Object.assign({}, antes, nuevo);
      (PROTEGIDOS[k] || []).forEach((campo) => { if (antes[campo] !== undefined) mezcla[campo] = antes[campo]; });
      if (k === "citas" && antes.estado !== mezcla.estado) {
        const mapa = { cancelada: "cita.cancelada", "no-show": "cita.noshow", terminada: "cita.terminada" };
        if (mapa[mezcla.estado]) eventos.push({ ev: mapa[mezcla.estado], id: mezcla.id });
      }
      return mezcla;
    });
    if (k === "fila" && c.borrar.length) eventos.push({ ev: "fila.avanza" });
  }
  if (total > 3000) throw new util.ErrorHTTP(413, "Demasiados cambios a la vez.");
  BS.aplicarParche(est, { colecciones: cols, objetos: parche.objetos || {} });
  for (const e of eventos) {
    if (e.ev.startsWith("cita.")) { const cita = BS.cita(e.id); if (cita) ctx.eventos.push({ ev: e.ev, d: { cita } }); }
    else ctx.eventos.push({ ev: e.ev, d: {} });
  }
}

/* ---------------- Lo que ve el público (sin datos de clientes) ---------------- */
function estadoPublico(est) {
  const s = est.shop;
  const hoy = BS.util.hoy0();
  return {
    shop: {
      nombre: s.nombre, slug: s.slug, barrio: s.barrio, ciudad: s.ciudad, direccion: s.direccion, horario: s.horario,
      anticipo: s.anticipo, medios: s.medios, rating: s.rating, resenas: s.resenas, tono: s.tono
    },
    ejemplo: !!est.ejemplo,
    reputacion: BS.reputacion(null, est),
    servicios: est.servicios,
    barberos: est.barberos.map((b) => ({ id: b.id, nombre: b.nombre, alias: b.alias, especialidades: b.especialidades, rating: b.rating, rol: b.rol, modo: b.modo, reputacion: BS.reputacion(b.id, est) })),
    ocupacion: est.citas.filter((c) => BS.citaActiva(c) && new Date(c.inicio) >= hoy).map((c) => ({ barbero: c.barbero, inicio: c.inicio, dur: c.dur })),
    fila: est.fila.map((f) => ({ id: f.id, entro: f.entro, estado: f.estado, servicio: f.servicio, nombre: BS.util.primerNombre(f.nombre) })),
    autos: est.autos.filter((a) => a.clave === "confirmacion" || a.clave === "fila").map((a) => ({ id: a.id, clave: a.clave, activa: a.activa, plantilla: a.plantilla, nombre: a.nombre, stats: { enviados: 0, resultados: 0, plata: 0 } }))
  };
}

function todasLasBarberias() { return todos("SELECT id, slug FROM barberias"); }

module.exports = {
  BS, transaccion, leer, crearBarberia, porSlug, filaBarberia, aplicarParche, estadoPublico,
  suscribir, avisar, todasLasBarberias, slugUnico
};
