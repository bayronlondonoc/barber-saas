// Rutas HTTP: cuentas, panel (privado), reservas y fila (público), webhooks y pasarela simulada.
"use strict";
const crypto = require("crypto");
const config = require("./config");
const { uno, ejecutar, firmar } = require("./db");
const util = require("./util");
const nucleo = require("./nucleo");
const motor = require("./motor");
const wa = require("./whatsapp");
const pagos = require("./pagos");
const { ErrorHTTP } = util;
const BS = nucleo.BS;

/* ---------------- Cuentas y sesiones ---------------- */
const SESION = "bs_sesion", DIAS_SESION = 30;
function hashClave(clave) {
  const sal = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(clave, sal, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt$16384$8$1$${sal}$${h}`;
}
function claveCorrecta(clave, guardado) {
  const [, N, r, p, sal, h] = String(guardado).split("$");
  const calc = crypto.scryptSync(clave, sal, 64, { N: Number(N), r: Number(r), p: Number(p) }).toString("hex");
  return util.iguales(calc, h);
}
function abrirSesion(res, usuarioId) {
  const tk = util.token(32);
  ejecutar("INSERT INTO sesiones (token_hash, usuario_id, expira, creada) VALUES (?, ?, ?, ?)", util.sha256(tk), usuarioId,
    new Date(Date.now() + DIAS_SESION * 86400000).toISOString(), new Date().toISOString());
  util.ponerCookie(res, SESION, tk, DIAS_SESION * 86400);
}
function usuarioDe(req) {
  const tk = util.cookies(req)[SESION];
  if (!tk) return null;
  const f = uno(`SELECT u.id, u.email, u.nombre, u.barberia_id, s.expira FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?`, util.sha256(tk));
  if (!f || new Date(f.expira) < new Date()) return null;
  return f;
}
function exigirUsuario(req) {
  const u = usuarioDe(req);
  if (!u) throw new ErrorHTTP(401, "Tu sesión terminó. Volvé a entrar.");
  return u;
}
function emailValido(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length < 120; }

function enmascarar(x) { x = String(x || ""); return x ? (x.length > 10 ? x.slice(0, 8) + "…" + x.slice(-4) : "•••• " + x.slice(-3)) : ""; }
function integraciones(barberiaId) {
  const w = wa.proveedor(barberiaId), cred = pagos.credenciales(barberiaId), itW = wa.integracion(barberiaId);
  const itP = uno("SELECT datos FROM integraciones WHERE barberia_id = ? AND tipo = 'pagos'", barberiaId);
  const p = itP ? JSON.parse(itP.datos) : {};
  return {
    whatsapp: w.tipo, whatsappNumero: enmascarar(itW.phone_number_id || ""), pagos: cred.proveedor, wompiAmbiente: cred.proveedor === "wompi" ? cred.ambiente : "",
    wompiLlave: enmascarar(p.wompi_llave_privada), wompiEventos: p.wompi_secreto_eventos ? "•••• guardado" : "",
    webhookWompi: config.urlPublica + "/webhooks/wompi/" + barberiaId, webhookWhatsapp: config.urlPublica + "/webhooks/whatsapp"
  };
}
function sesionDe(u) {
  const b = uno("SELECT id, slug, estado FROM barberias WHERE id = ?", u.barberia_id);
  return { usuario: { id: u.id, email: u.email, nombre: u.nombre }, barberia: { id: b.id, slug: b.slug, nombre: JSON.parse(b.estado).shop.nombre }, integraciones: integraciones(b.id) };
}
function estadoActual(barberiaId) {
  const f = uno("SELECT version, estado FROM barberias WHERE id = ?", barberiaId);
  return { version: f.version, estado: JSON.parse(f.estado) };
}

/* ---------------- Vista pública de una cita ---------------- */
function citaPublica(barberiaId, citaId) {
  return nucleo.leer(barberiaId, (BS) => {
    const c = BS.cita(citaId);
    if (!c) throw new ErrorHTTP(404, "No encontramos esa reserva.");
    const cli = BS.cliente(c.cliente) || { nombre: "" }, srv = BS.servicio(c.servicio) || { nombre: "Servicio" }, b = BS.barbero(c.barbero) || { nombre: "" };
    const a = BS.autoPorClave("confirmacion");
    const vars = BS.varsCita(c);
    vars.anticipo = c.anticipo && c.anticipo.pagado ? "Tu anticipo de " + BS.util.pesos(c.anticipo.monto) + " ya quedó registrado ✅" : "";
    const pend = c.anticipo && !c.anticipo.pagado ? uno("SELECT url FROM pagos WHERE barberia_id = ? AND cita_id = ? AND estado = 'pendiente' ORDER BY creado DESC LIMIT 1", barberiaId, c.id) : null;
    return {
      id: c.id, estado: c.estado, inicio: c.inicio, dur: c.dur, precio: c.precio, pagoUrl: pend ? pend.url : null,
      servicio: srv.nombre, barbero: b.nombre, cliente: BS.util.primerNombre(cli.nombre),
      anticipo: c.anticipo ? { monto: c.anticipo.monto, pagado: !!c.anticipo.pagado, medio: c.anticipo.medio } : null,
      mensaje: a && a.activa ? BS.render(a.plantilla, vars) : "",
      direccion: BS.get().shop.direccion, barberia: BS.get().shop.nombre
    };
  });
}
function barberiaPublica(slug) {
  const b = nucleo.porSlug(slug);
  if (!b) throw new ErrorHTTP(404, "No encontramos esa barbería.");
  return b;
}

/* ==========================================================================
   Tabla de rutas
   ========================================================================== */
const rutas = [];
function ruta(metodo, patron, fn, opciones) { rutas.push({ metodo, patron, fn, opciones: opciones || {} }); }

ruta("GET", /^\/api\/salud$/, () => ({ barbersaas: true, version: "1.0", whatsapp: config.whatsapp.proveedor, pagos: config.pagos.proveedor, registro: config.registroAbierto }));

ruta("POST", /^\/api\/registro$/, async (req, res, p, cuerpo) => {
  util.limitar(req, "registro", 8, 3600000);
  if (!config.registroAbierto) throw new ErrorHTTP(403, "El registro está cerrado. Pedí una invitación.");
  const email = String(cuerpo.email || "").trim().toLowerCase(), clave = String(cuerpo.clave || "");
  const barberia = String(cuerpo.barberia || "").trim().slice(0, 60), nombre = String(cuerpo.nombre || "").trim().slice(0, 40);
  if (!barberia || !nombre) throw new ErrorHTTP(400, "Escribí el nombre de la barbería y tu nombre.");
  if (!emailValido(email)) throw new ErrorHTTP(400, "Revisá el correo.");
  if (clave.length < 8 || clave.length > 200) throw new ErrorHTTP(400, "La contraseña debe tener al menos 8 caracteres.");
  if (cuerpo.acepto !== true) throw new ErrorHTTP(400, "Necesitamos tu autorización para el tratamiento de datos.");
  if (uno("SELECT 1 AS x FROM usuarios WHERE email = ?", email)) throw new ErrorHTTP(409, "Ese correo ya tiene una cuenta. Entrá con tu contraseña.");
  const whatsapp = util.telValido(cuerpo.whatsapp) ? util.normTel(cuerpo.whatsapp) : "";
  // La barbería arranca vacía; ubicación, horario, servicios y equipo se llenan en el registro paso a paso
  const b = nucleo.crearBarberia({ nombre: barberia, barrio: String(cuerpo.barrio || "").slice(0, 40), dueno: nombre, whatsapp, ejemplo: cuerpo.ejemplo === true, onboarded: false });
  const idU = util.id("usr");
  ejecutar("INSERT INTO usuarios (id, barberia_id, email, nombre, hash, rol, creado) VALUES (?, ?, ?, ?, ?, 'dueno', ?)", idU, b.id, email, nombre, hashClave(clave), new Date().toISOString());
  abrirSesion(res, idU);
  return [201, { ok: true, barberia: b }];
}, { cuerpo: true });

ruta("POST", /^\/api\/entrar$/, async (req, res, p, cuerpo) => {
  util.limitar(req, "entrar", 10, 15 * 60000);
  const email = String(cuerpo.email || "").trim().toLowerCase();
  const u = uno("SELECT * FROM usuarios WHERE email = ?", email);
  if (!u || !claveCorrecta(String(cuerpo.clave || ""), u.hash)) throw new ErrorHTTP(401, "Correo o contraseña incorrectos.");
  abrirSesion(res, u.id);
  return { ok: true };
}, { cuerpo: true });

ruta("POST", /^\/api\/salir$/, (req, res) => {
  const tk = util.cookies(req)[SESION];
  if (tk) ejecutar("DELETE FROM sesiones WHERE token_hash = ?", util.sha256(tk));
  util.ponerCookie(res, SESION, "", 0);
  return { ok: true };
});

ruta("GET", /^\/api\/sesion$/, (req) => sesionDe(exigirUsuario(req)));
ruta("GET", /^\/api\/estado$/, (req) => estadoActual(exigirUsuario(req).barberia_id));

ruta("POST", /^\/api\/sync$/, (req, res, p, cuerpo) => {
  const u = exigirUsuario(req);
  nucleo.transaccion(u.barberia_id, (BS, ctx) => nucleo.aplicarParche(BS, ctx, cuerpo.parche));
  return estadoActual(u.barberia_id);
}, { cuerpo: true });

ruta("GET", /^\/api\/eventos$/, (req, res) => {
  const u = exigirUsuario(req);
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write(": conectado\n\n");
  nucleo.suscribir(u.barberia_id, res);
  return undefined; // la conexión queda abierta
});

ruta("POST", /^\/api\/automatizaciones\/([\w-]+)\/ejecutar$/, (req, res, p) => {
  const u = exigirUsuario(req);
  util.limitar(req, "ejecutar", 30, 60000);
  return motor.ejecutarAhora(u.barberia_id, p[1]);
}, { cuerpo: true });

ruta("GET", /^\/api\/asistente\/probar$/, (req) => {
  const u = exigirUsuario(req);
  const conv = motor.cargarConv(u.barberia_id, "prueba:" + u.id);
  return { mensajes: conv ? conv.mensajes : [], conv };
});
ruta("POST", /^\/api\/asistente\/probar$/, async (req, res, p, cuerpo) => {
  const u = exigirUsuario(req);
  util.limitar(req, "probar", 60, 60000);
  const texto = String(cuerpo.texto || "").trim().slice(0, 300);
  if (!texto) throw new ErrorHTTP(400, "Escribí un mensaje.");
  const conv = await motor.entrada(u.barberia_id, "prueba:" + u.id, { texto });
  return { mensajes: conv.mensajes, conv };
}, { cuerpo: true });
ruta("DELETE", /^\/api\/asistente\/probar$/, (req) => {
  const u = exigirUsuario(req);
  ejecutar("DELETE FROM conversaciones WHERE barberia_id = ? AND telefono = ?", u.barberia_id, "prueba:" + u.id);
  return { ok: true };
});

ruta("POST", /^\/api\/whatsapp\/prueba$/, (req, res, p, cuerpo) => {
  const u = exigirUsuario(req);
  util.limitar(req, "prueba-wa", 10, 60000);
  const st = estadoActual(u.barberia_id).estado;
  if (!util.telValido(st.shop.whatsapp)) throw new ErrorHTTP(400, "Primero escribí tu WhatsApp en Ajustes → Tu barbería.");
  wa.encolar(u.barberia_id, st.shop.whatsapp, { texto: String(cuerpo.texto || "Prueba de Barber SaaS ✅").slice(0, 1000) });
  wa.procesarCola().catch(() => {});
  const prov = wa.proveedor(u.barberia_id);
  return { mensaje: prov.tipo === "meta" ? "Enviada a tu WhatsApp. Si no te llega, escribile primero a tu número de la barbería (Meta solo permite texto libre dentro de las 24 h)." : "Simulada: el WhatsApp real se activa al conectar la API de Meta." };
}, { cuerpo: true });

ruta("GET", /^\/api\/integraciones$/, (req) => integraciones(exigirUsuario(req).barberia_id));
ruta("PUT", /^\/api\/integraciones$/, (req, res, p, cuerpo) => {
  const u = exigirUsuario(req);
  const guardar = (tipo, cambios) => {
    const f = uno("SELECT datos FROM integraciones WHERE barberia_id = ? AND tipo = ?", u.barberia_id, tipo);
    const datos = Object.assign(f ? JSON.parse(f.datos) : {}, cambios);
    ejecutar("INSERT INTO integraciones (barberia_id, tipo, datos) VALUES (?, ?, ?) ON CONFLICT(barberia_id, tipo) DO UPDATE SET datos = excluded.datos", u.barberia_id, tipo, JSON.stringify(datos));
  };
  // Primero se valida todo; si algo está mal no se guarda nada
  if (cuerpo.whatsapp_phone_number_id) {
    if (!/^\d{6,30}$/.test(cuerpo.whatsapp_phone_number_id)) throw new ErrorHTTP(400, "El ID del número de WhatsApp son solo dígitos.");
    if (wa.numeroOcupado(cuerpo.whatsapp_phone_number_id, u.barberia_id)) throw new ErrorHTTP(409, "Ese número de WhatsApp ya está conectado a otra barbería.");
  }
  const pg = {};
  if (cuerpo.wompi_llave_privada) {
    if (!/^prv_(test|prod)_[\w-]{8,}$/.test(cuerpo.wompi_llave_privada)) throw new ErrorHTTP(400, "La llave privada de Wompi empieza por prv_test_ o prv_prod_.");
    pg.wompi_llave_privada = cuerpo.wompi_llave_privada;
  }
  if (cuerpo.wompi_secreto_eventos) {
    if (String(cuerpo.wompi_secreto_eventos).length < 8) throw new ErrorHTTP(400, "Revisá el secreto de eventos de Wompi.");
    pg.wompi_secreto_eventos = cuerpo.wompi_secreto_eventos;
  }
  if (cuerpo.whatsapp_phone_number_id) guardar("whatsapp", { phone_number_id: cuerpo.whatsapp_phone_number_id });
  if (Object.keys(pg).length) guardar("pagos", pg);
  return { ok: true, integraciones: integraciones(u.barberia_id) };
}, { cuerpo: true });

/* ---------------- Público: reservas y fila ---------------- */
ruta("GET", /^\/api\/publico\/([\w-]+)$/, (req, res, p) => {
  const b = barberiaPublica(p[1]);
  return nucleo.leer(b.id, (BS, ctx) => nucleo.estadoPublico(ctx.estado));
}, { publico: true });

ruta("POST", /^\/api\/publico\/([\w-]+)\/reservas$/, async (req, res, p, cuerpo) => {
  util.limitar(req, "reservar", 15, 60000);
  const b = barberiaPublica(p[1]);
  const nombre = String(cuerpo.nombre || "").trim().slice(0, 60), tel = util.normTel(cuerpo.tel);
  if (nombre.length < 2) throw new ErrorHTTP(400, "Escribí tu nombre.");
  if (!util.telValido(tel)) throw new ErrorHTTP(400, "Revisá el celular: son 10 dígitos y empieza por 3.");
  if (cuerpo.acepto !== true) throw new ErrorHTTP(400, "Necesitamos tu autorización para escribirte por WhatsApp.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo.fecha || ""))) throw new ErrorHTTP(400, "Fecha inválida.");
  const min = Number(cuerpo.min);
  if (!Number.isInteger(min) || min < 0 || min > 1440) throw new ErrorHTTP(400, "Hora inválida.");
  const r = nucleo.transaccion(b.id, (BS) => {
    const U = BS.util;
    const [a, m, d] = cuerpo.fecha.split("-").map(Number);
    const dia = new Date(a, m - 1, d);
    if (U.diasEntre(new Date(), dia) < 0 || U.diasEntre(new Date(), dia) > 60) throw new ErrorHTTP(400, "Elegí una fecha de los próximos días.");
    const srv = BS.servicio(String(cuerpo.servicio || ""));
    if (!srv) throw new ErrorHTTP(400, "Ese servicio no existe.");
    const barbero = cuerpo.barbero && cuerpo.barbero !== "cualquiera" ? String(cuerpo.barbero) : "cualquiera";
    if (barbero !== "cualquiera" && !BS.barbero(barbero)) throw new ErrorHTTP(400, "Ese barbero no existe.");
    const slot = BS.slotsLibres(dia, srv.id, barbero).filter((s) => s.min === min)[0];
    if (!slot) throw new ErrorHTTP(409, "Ese turno se acaba de ocupar. Elegí otro, porfa.");
    const monto = BS.montoAnticipo(srv.precio);
    const conAnticipo = BS.get().shop.anticipo.activo && monto > 0;
    const medio = ["breb", "nequi", "daviplata", "pse", "tarjeta"].includes(cuerpo.medio) ? cuerpo.medio : "breb";
    const cita = BS.crearCita({
      nombre, tel, barbero: barbero === "cualquiera" ? slot.barbero : barbero, servicio: srv.id, inicio: U.enMin(dia, min), fuente: "web",
      estado: conAnticipo ? "pendiente" : "confirmada",
      anticipo: conAnticipo ? { monto, medio, pagado: false, fecha: new Date().toISOString() } : null
    });
    const cli = BS.cliente(cita.cliente);
    if (cli && !cli.consentimiento) cli.consentimiento = { fecha: new Date().toISOString(), origen: "link de reservas" };
    BS.actividad({ tipo: "web", toast: true, texto: U.nombreCorto(nombre) + " reservó desde tu link: " + srv.nombre + " " + U.diaRelativo(cita.inicio) + " a las " + U.hora(cita.inicio) });
    return { citaId: cita.id, conAnticipo };
  });
  let pagoUrl = null, pagoError = false;
  if (r.conAnticipo) {
    // Si la pasarela falla, la reserva queda apartada y el link sale después por WhatsApp
    try { pagoUrl = await pagos.prepararPago(b.id, r.citaId); }
    catch (e) { pagoError = true; console.warn("[pago] no se pudo crear el link:", e.message); }
  }
  return [201, { cita: citaPublica(b.id, r.citaId), token: firmar(r.citaId), pagoUrl, pagoError }];
}, { cuerpo: true, publico: true });

ruta("GET", /^\/api\/publico\/([\w-]+)\/reservas\/([\w-]+)$/, (req, res, p, c, url) => {
  const b = barberiaPublica(p[1]);
  if (!util.iguales(firmar(p[2]), url.searchParams.get("t") || "")) throw new ErrorHTTP(404, "No encontramos esa reserva.");
  return citaPublica(b.id, p[2]);
}, { publico: true });

function posicionFila(barberiaId, filaId) {
  return nucleo.leer(barberiaId, (BS) => {
    const orden = BS.filaOrdenada(), i = orden.findIndex((f) => f.id === filaId);
    if (i >= 0) {
      const f = orden[i];
      const a = BS.autoPorClave("fila");
      return { estado: "en-fila", posicion: i + 1, espera: BS.esperaFila(i + 1), filaEstado: f.estado, avisado: !!f.avisado, total: orden.length,
        mensaje: f.avisado && a && a.activa ? BS.render(a.plantilla, Object.assign(BS.varsEjemplo(), { nombre: BS.util.primerNombre(f.nombre), posicion: (i + 1) + "º" })) : "" };
    }
    const c = BS.get().citas.filter((x) => x.filaId === filaId)[0];
    if (c) return { estado: "te-toca", barbero: (BS.barbero(c.barbero) || {}).nombre || "tu barbero" };
    return { estado: "fuera" };
  });
}
ruta("POST", /^\/api\/publico\/([\w-]+)\/fila$/, (req, res, p, cuerpo) => {
  util.limitar(req, "fila", 10, 60000);
  const b = barberiaPublica(p[1]);
  const nombre = String(cuerpo.nombre || "").trim().slice(0, 60), tel = util.normTel(cuerpo.tel);
  if (nombre.length < 2) throw new ErrorHTTP(400, "Escribí tu nombre.");
  if (!util.telValido(tel)) throw new ErrorHTTP(400, "Revisá el celular: son 10 dígitos y empieza por 3.");
  if (cuerpo.acepto !== true) throw new ErrorHTTP(400, "Necesitamos tu permiso para avisarte por WhatsApp.");
  const idF = nucleo.transaccion(b.id, (BS) => {
    if (!BS.abiertoAhora()) throw new ErrorHTTP(409, "La fila abre cuando abre la barbería.");
    const ya = BS.get().fila.filter((f) => util.normTel(f.tel) === tel)[0];
    if (ya) return ya.id;
    const f = BS.unirseFila({ nombre, tel, via: "web", servicio: BS.servicio(cuerpo.servicio) ? cuerpo.servicio : "s1" });
    const cli = f.cliente && BS.cliente(f.cliente);
    if (cli && !cli.consentimiento) cli.consentimiento = { fecha: new Date().toISOString(), origen: "fila virtual" };
    return f.id;
  });
  return [201, Object.assign({ id: idF, token: firmar(idF) }, posicionFila(b.id, idF))];
}, { cuerpo: true, publico: true });

ruta("GET", /^\/api\/publico\/([\w-]+)\/fila\/([\w-]+)$/, (req, res, p, c, url) => {
  const b = barberiaPublica(p[1]);
  if (!util.iguales(firmar(p[2]), url.searchParams.get("t") || "")) throw new ErrorHTTP(404, "Turno no encontrado.");
  return posicionFila(b.id, p[2]);
}, { publico: true });

ruta("POST", /^\/api\/publico\/([\w-]+)\/fila\/([\w-]+)\/llegue$/, (req, res, p, c, url) => {
  const b = barberiaPublica(p[1]);
  if (!util.iguales(firmar(p[2]), url.searchParams.get("t") || "")) throw new ErrorHTTP(404, "Turno no encontrado.");
  nucleo.transaccion(b.id, (BS) => { const f = BS.get().fila.filter((x) => x.id === p[2])[0]; if (f) f.estado = "local"; });
  return posicionFila(b.id, p[2]);
}, { cuerpo: true, publico: true });

ruta("DELETE", /^\/api\/publico\/([\w-]+)\/fila\/([\w-]+)$/, (req, res, p, c, url) => {
  const b = barberiaPublica(p[1]);
  if (!util.iguales(firmar(p[2]), url.searchParams.get("t") || "")) throw new ErrorHTTP(404, "Turno no encontrado.");
  nucleo.transaccion(b.id, (BS) => { if (BS.get().fila.some((x) => x.id === p[2])) BS.salirFila(p[2]); });
  return { ok: true };
}, { publico: true });

/* ---------------- Pasarela simulada ---------------- */
ruta("GET", /^\/api\/pagos\/simulado\/([\w-]+)$/, (req, res, p) => pagos.infoSimulado(p[1]), { publico: true });
ruta("POST", /^\/api\/pagos\/simulado\/([\w-]+)$/, (req, res, p, cuerpo) => {
  util.limitar(req, "pago-sim", 20, 60000);
  if (config.pagos.proveedor === "wompi" && config.produccion) throw new ErrorHTTP(403, "La pasarela simulada está apagada.");
  return pagos.resolverSimulado(p[1], cuerpo.resultado, cuerpo.medio);
}, { cuerpo: true, publico: true });

/* ---------------- Webhooks ---------------- */
async function webhookWhatsapp(req, res) {
  const crudo = await util.leerCuerpo(req, 1024 * 1024);
  if (!wa.verificarFirma(crudo, req.headers["x-hub-signature-256"])) { res.writeHead(401); res.end(); return; }
  res.writeHead(200); res.end("ok"); // Meta espera respuesta rápida; se procesa después
  let cuerpo;
  try { cuerpo = JSON.parse(crudo.toString("utf8")); } catch (e) { return; }
  const { entrantes, estados } = wa.leerWebhook(cuerpo);
  estados.forEach((s) => wa.actualizarEstadoEntrega(s.id, s.estado));
  for (const m of entrantes) {
    try {
      const nuevo = ejecutar("INSERT OR IGNORE INTO webhooks_vistos (id, origen, recibido) VALUES (?, 'whatsapp', ?)", "wa:" + m.id, new Date().toISOString()).changes > 0;
      if (!nuevo) continue;
      const barberiaId = wa.barberiaPorNumero(m.phoneNumberId);
      if (!barberiaId) continue;
      const telefono = util.normTel(m.from);
      wa.registrarEntrada(barberiaId, telefono, { texto: m.texto, payload: m.payload, tipo: m.tipo }, m.id);
      await motor.entrada(barberiaId, telefono, m);
    } catch (err) { console.warn("[webhook whatsapp]", err); }
  }
}

/* ---------------- Despachador ---------------- */
async function atender(req, res) {
  const url = new URL(req.url, "http://local");
  const camino = url.pathname;
  try {
    if (camino === "/webhooks/whatsapp") {
      if (req.method === "GET") {
        const q = url.searchParams;
        const ok = q.get("hub.mode") === "subscribe" && config.whatsapp.verifyToken && util.iguales(q.get("hub.verify_token") || "", config.whatsapp.verifyToken);
        res.writeHead(ok ? 200 : 403, { "Content-Type": "text/plain" }); res.end(ok ? q.get("hub.challenge") : "forbidden"); return;
      }
      if (req.method === "POST") return await webhookWhatsapp(req, res);
    }
    const mW = camino.match(/^\/webhooks\/wompi\/([\w-]+)$/);
    if (mW && req.method === "POST") {
      const crudo = await util.leerCuerpo(req, 256 * 1024);
      let ev; try { ev = JSON.parse(crudo.toString("utf8")); } catch (e) { throw new ErrorHTTP(400, "JSON inválido."); }
      return util.json(res, 200, pagos.webhookWompi(mW[1], ev, req.headers["x-event-checksum"]));
    }
    if (camino.startsWith("/api/")) {
      const r = rutas.find((x) => x.metodo === req.method && x.patron.test(camino));
      if (!r) {
        const otraMetodo = rutas.some((x) => x.patron.test(camino));
        throw new ErrorHTTP(otraMetodo ? 405 : 404, otraMetodo ? "Método no permitido." : "No existe esa ruta.");
      }
      if (req.method !== "GET" && !r.opciones.publico && !util.mismoOrigen(req)) throw new ErrorHTTP(403, "Origen no permitido.");
      let cuerpo = {};
      if (r.opciones.cuerpo) {
        if (req.method !== "GET" && !/application\/json/.test(req.headers["content-type"] || "")) throw new ErrorHTTP(415, "Mandá JSON.");
        cuerpo = await util.leerJSON(req);
      }
      const p = camino.match(r.patron);
      const salida = await r.fn(req, res, p, cuerpo, url);
      if (salida === undefined) return; // SSE
      if (Array.isArray(salida)) return util.json(res, salida[0], salida[1]);
      return util.json(res, 200, salida);
    }
    if ((req.method === "GET" || req.method === "HEAD") && util.servirEstatico(req, res, camino)) return;
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — no encontrado");
  } catch (err) {
    const estado = err.estado || 500;
    if (estado === 500) console.error("[error]", req.method, camino, err);
    if (!res.headersSent) util.json(res, estado, { error: estado === 500 ? "Algo falló en el servidor. Intentá de nuevo." : err.message });
    else try { res.end(); } catch (e) { /* conexión cerrada */ }
  }
}

module.exports = { atender };
