// Motor de automatizaciones REAL (servidor). A diferencia del simulador del navegador, aquí nada
// se inventa: se mandan mensajes de verdad y los resultados llegan cuando el cliente responde.
//  - manejar(): eventos que nacen de cambios (cita creada, cancelada, no llegó, terminada, fila).
//  - tick(): el reloj — recordatorios 24 h/2 h, ciclo de corte, huecos, cumpleaños, cierre, liquidación.
//  - entrada(): mensajes y botones que mandan los clientes por WhatsApp (o el simulador del panel).
"use strict";
const { uno, todos, ejecutar, tareaNueva } = require("./db");
const util = require("./util");
const wa = require("./whatsapp");
const { armar } = require("./plantillas");
let _nucleo; function nucleo() { return _nucleo || (_nucleo = require("./nucleo")); }

function bot(texto, extra) { return Object.assign({ de: "bot", texto: String(texto).replace(/m\.(\*?)\./g, "m.$1"), hora: new Date().toISOString() }, extra || {}); }
function prendida(BS, clave) { const a = BS.autoPorClave(clave); return a && a.activa ? a : null; }
// Datos de ejemplo (números inventados) nunca reciben mensajes reales
function tel(cli) { if (!cli || cli.ejemplo) return null; const t = util.normTel(cli.tel); return util.telValido(t) ? t : null; }
// Promociones (ciclo, huecos, cumpleaños, reseñas…): no a quien pidió la baja. Lo de sus citas sí le llega.
function telPromo(cli) { return cli && cli.sinPromos ? null : tel(cli); }
// «BAJA», «no quiero más mensajes»… y la vuelta: «quiero promociones»
// Las palabras sueltas solo cuentan si son el mensaje completo («bajá los lados» no es una baja)
const RE_BAJA = /^\s*(?:(?:baja|stop)\s*[.!]*\s*$|(?:dar(?:me)? de baja|no (?:me )?(?:manden|envien|escriban) mas|no (?:quiero|deseo) (?:recibir )?(?:mas )?(?:mensajes|promociones|promos|publicidad)|dejar de recibir|cancelar (?:la )?suscripcion)\b)/;
const RE_ALTA = /^\s*(?:alta\s*[.!]*\s*$|(?:quiero (?:recibir )?(?:promociones|promos)|volver a recibir|activar (?:las )?(?:promociones|promos))\b)/;
function sinTildes(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function cap(s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); }
function filtrarPublico(a, lista) {
  const p = a.publico || "todos";
  if (p === "vip") return lista.filter((c) => c.etiquetas.indexOf("VIP") >= 0);
  if (p === "nuevos") return lista.filter((c) => c.visitas <= 2);
  if (p === "fieles") return lista.filter((c) => c.visitas > 5);
  return lista;
}
function sinLink(texto) { return String(texto).replace(/\{\{link_pago:[\w-]+\}\}/g, "[link de pago]"); }

/** Tres turnos libres del barbero en los próximos días (para el ciclo de corte). */
function horariosSugeridos(BS, barberoId) {
  const U = BS.util, out = [];
  for (let d = 1; d <= 6 && out.length < 3; d++) {
    const dia = U.addDias(U.hoy0(), d);
    const slots = BS.slotsLibres(dia, "s1", barberoId);
    if (!slots.length) continue;
    const tarde = slots.filter((s) => s.min >= 16 * 60);
    out.push(U.DIAS_CORTO[dia.getDay()] + " " + U.horaMin((tarde.length ? tarde : slots)[0].min));
  }
  return out.length ? (out.length === 1 ? out[0] : out.slice(0, -1).join(", ") + " o " + out[out.length - 1]) : "turnos esta semana";
}
function varsCliente(BS, cli, extra) {
  const b = BS.barbero(cli.barbero) || BS.get().barberos[0];
  return Object.assign(BS.varsEjemplo(), {
    nombre: BS.util.primerNombre(cli.nombre), barbero: b.nombre, dias: String(BS.util.diasEntre(cli.ultima, new Date())),
    horarios: horariosSugeridos(BS, b.id), link: BS.linkReservas()
  }, extra || {});
}

/* ==========================================================================
   EVENTOS
   ========================================================================== */
function manejar(BS, ctx, e) {
  const d = e.d || {};
  try {
    if (e.ev === "cita.creada" && d.cita) confirmar(BS, ctx, d.cita);
    if (e.ev === "cita.cancelada" && d.cita) listaEspera(BS, ctx, d.cita);
    if (e.ev === "cita.noshow" && d.cita) antiplanton(BS, ctx, d.cita);
    if (e.ev === "cita.terminada" && d.cita) resena(BS, ctx, d.cita);
    if (e.ev === "fila.entra" || e.ev === "fila.avanza") revisarFila(BS, ctx);
    BS.get().autos.filter((a) => a.custom && a.activa && a.disparador === e.ev && d.cita).forEach((a) => generico(BS, ctx, a, d.cita));
  } catch (err) { console.warn("[motor " + e.ev + "]", err); }
}

function confirmar(BS, ctx, cita) {
  const a = prendida(BS, "confirmacion");
  if (!a || cita.canal === "asistente") return;
  const cli = BS.cliente(cita.cliente), t = tel(cli);
  if (!t) return;
  const U = BS.util;
  const vars = BS.varsCita(cita);
  const pendiente = cita.anticipo && !cita.anticipo.pagado && cita.estado === "pendiente";
  vars.anticipo = pendiente ? "Para separarlo, el anticipo es de " + U.pesos(cita.anticipo.monto) + ": {{link_pago:" + cita.id + "}}"
    : cita.anticipo && cita.anticipo.pagado ? "Tu anticipo de " + U.pesos(cita.anticipo.monto) + " ya quedó registrado ✅" : "";
  const texto = BS.render(a.plantilla, vars);
  wa.encolar(ctx.barberiaId, t, { texto, plantilla: armar("confirmacion", Object.assign({}, vars, { dia: vars.dia, anticipo: vars.anticipo || "Tu turno ya está separado." })) }, { auto: a.id });
  a.stats.enviados++;
  BS.actividad({ tipo: "whatsapp", auto: a.id, toast: true, texto: "Confirmación enviada por WhatsApp a " + U.nombreCorto(cli.nombre) + " · " + U.diaRelativo(cita.inicio) + " " + U.hora(cita.inicio), mensaje: sinLink(texto) });
}

function listaEspera(BS, ctx, cita) {
  const a = prendida(BS, "espera");
  if (!a || new Date(cita.inicio) < new Date(Date.now() + 20 * 60000)) return;
  const U = BS.util, st = BS.get();
  const libres = st.clientes.filter((c) => c.id !== cita.cliente && telPromo(c) && BS.estadoCiclo(c).estado !== "agendado");
  const enLista = libres.filter((c) => c.etiquetas.indexOf("Lista de espera") >= 0);
  const toca = libres.filter((c) => BS.estadoCiclo(c).estado === "toca");
  const elegidos = filtrarPublico(a, enLista.concat(toca).concat(libres)).filter((c, i, arr) => arr.indexOf(c) === i).slice(0, 3);
  if (!elegidos.length) {
    BS.actividad({ tipo: "rayo", auto: a.id, texto: "Se liberó el turno de " + U.diaRelativo(cita.inicio) + " " + U.hora(cita.inicio) + ", pero no hay nadie con WhatsApp en la lista de espera" });
    return;
  }
  const idOferta = util.id("of");
  const expira = new Date(Math.min(new Date(cita.inicio).getTime() - 10 * 60000, Date.now() + 3 * 3600000));
  ejecutar("INSERT INTO ofertas (id, barberia_id, tipo, datos, estado, creada, expira) VALUES (?, ?, 'espera', ?, 'abierta', ?, ?)",
    idOferta, ctx.barberiaId, JSON.stringify({ barbero: cita.barbero, inicio: cita.inicio, servicio: cita.servicio }), new Date().toISOString(), expira.toISOString());
  const vars = BS.varsCita(cita);
  elegidos.forEach((c) => {
    const texto = BS.render(a.plantilla, Object.assign({}, vars, { nombre: U.primerNombre(c.nombre) }));
    wa.encolar(ctx.barberiaId, tel(c), {
      texto, botones: [{ id: "oferta:" + idOferta, titulo: "¡Lo quiero!" }],
      plantilla: armar("espera", { barberia: st.shop.nombre, dia: cap(vars.dia), hora: vars.hora, barbero: vars.barbero }, ["oferta:" + idOferta])
    }, { auto: a.id });
  });
  a.stats.enviados += elegidos.length;
  BS.actividad({ tipo: "rayo", auto: a.id, toast: true, texto: "Turno de " + U.diaRelativo(cita.inicio) + " " + U.hora(cita.inicio) + " ofrecido a " + elegidos.length + " clientes de la lista de espera", mensaje: BS.render(a.plantilla, vars) });
}

function antiplanton(BS, ctx, cita) {
  const a = prendida(BS, "antiplanton");
  if (!a) return;
  const U = BS.util, cli = BS.cliente(cita.cliente), t = tel(cli);
  const monto = cita.anticipo && cita.anticipo.pagado ? cita.anticipo.monto : 0;
  if (monto) a.stats.plata += monto;
  if (t) {
    const texto = BS.render(a.plantilla, BS.varsCita(cita));
    wa.encolar(ctx.barberiaId, t, {
      texto, botones: [{ id: "reagendar:" + cita.id, titulo: "Reagendar" }],
      plantilla: armar("antiplanton", { nombre: U.primerNombre(cli.nombre), hora: U.hora(cita.inicio), barberia: BS.get().shop.nombre }, ["reagendar:" + cita.id])
    }, { auto: a.id });
    a.stats.enviados++;
  }
  BS.actividad({ tipo: "escudo", auto: a.id, toast: true, plata: monto || undefined,
    texto: (monto ? "Anticipo de " + U.pesos(monto) + " retenido · " : "") + U.nombreCorto(cli ? cli.nombre : "Cliente") + " no llegó" + (t ? " · le escribimos para reagendar" : "") });
}

function resena(BS, ctx, cita) {
  const a = prendida(BS, "resena");
  if (!a) return;
  const U = BS.util, cli = BS.cliente(cita.cliente), t = telPromo(cli);
  if (!t) return;
  const link = BS.get().shop.linkResena || BS.linkReservas();
  const cuando = new Date(Date.now() + (Number(a.espera) || 120) * 60000);
  const texto = BS.render(a.plantilla, Object.assign(BS.varsCita(cita), { link }));
  wa.encolar(ctx.barberiaId, t, { texto, plantilla: armar("resena", { nombre: U.primerNombre(cli.nombre), barberia: BS.get().shop.nombre, link }) }, { auto: a.id, enviarDesde: cuando.toISOString() });
  a.stats.enviados++;
  BS.actividad({ tipo: "estrella", auto: a.id, texto: "Pedido de reseña programado para " + U.nombreCorto(cli.nombre) + " a las " + U.hora(cuando), mensaje: texto });
}

function revisarFila(BS, ctx) {
  const a = prendida(BS, "fila");
  const custom = BS.get().autos.filter((x) => x.custom && x.activa && x.disparador === "fila.turno");
  if (!a && !custom.length) return;
  const U = BS.util, st = BS.get();
  BS.filaOrdenada().forEach((f, i) => {
    if (i >= 2 || f.avisado) return;
    f.avisado = true;
    const t = !f.ejemplo && util.telValido(f.tel) ? util.normTel(f.tel) : null;
    const vars = Object.assign(BS.varsEjemplo(), { nombre: U.primerNombre(f.nombre), posicion: (i + 1) + "º" });
    if (a) {
      if (t) {
        wa.encolar(ctx.barberiaId, t, { texto: BS.render(a.plantilla, vars), plantilla: armar("fila", { nombre: vars.nombre, barberia: st.shop.nombre, posicion: vars.posicion }) }, { auto: a.id });
        a.stats.enviados++;
      }
      BS.actividad({ tipo: "fila", auto: a.id, toast: true, texto: (t ? "Aviso enviado a " : "Le toca pronto a ") + U.nombreCorto(f.nombre) + ": va de " + (i + 1) + "º en la fila" + (t ? "" : " (sin WhatsApp)") });
    }
    custom.forEach((c) => { if (t) { wa.encolar(ctx.barberiaId, t, { texto: BS.render(c.plantilla, vars) }, { auto: c.id }); c.stats.enviados++; } });
  });
}

/** Recetas creadas por el dueño: texto libre (sale si el cliente escribió en las últimas 24 h). */
function generico(BS, ctx, a, cita) {
  const cli = BS.cliente(cita.cliente), t = tel(cli);
  if (!t) return;
  const texto = BS.render(a.plantilla, BS.varsCita(cita));
  const enviarDesde = a.disparador === "cita.terminada" && a.espera ? new Date(Date.now() + Number(a.espera) * 60000).toISOString() : undefined;
  wa.encolar(ctx.barberiaId, t, { texto }, { auto: a.id, enviarDesde });
  a.stats.enviados++;
  BS.actividad({ tipo: "whatsapp", auto: a.id, toast: true, texto: "«" + a.nombre + "» le escribió a " + BS.util.nombreCorto(cli.nombre), mensaje: texto });
}

/** Anticipo pagado: el cliente recibe la confirmación (en su chat o por plantilla). */
function anticipoRecibido(BS, ctx, citaId) {
  const U = BS.util, c = BS.cita(citaId);
  if (!c) return;
  const cli = BS.cliente(c.cliente);
  const telConv = c.conv || tel(cli);
  if (!telConv) return;
  const fila = uno("SELECT datos FROM conversaciones WHERE barberia_id = ? AND telefono = ?", ctx.barberiaId, telConv);
  let msgs;
  if (fila) {
    const datos = JSON.parse(fila.datos);
    msgs = BS.asistente.confirmarPago(datos, citaId);
    datos.mensajes = (datos.mensajes || []).concat(msgs).slice(-80);
    ejecutar("UPDATE conversaciones SET datos = ?, actualizada = ? WHERE barberia_id = ? AND telefono = ?", JSON.stringify(datos), new Date().toISOString(), ctx.barberiaId, telConv);
  } else msgs = BS.asistente.confirmarPago(null, citaId);
  if (wa.esPrueba(telConv)) return;
  const texto = msgs.map((m) => (m.de === "sistema" ? "✅ " : "") + m.texto).join("\n\n");
  wa.encolar(ctx.barberiaId, telConv, {
    texto,
    plantilla: armar("anticipo_recibido", { nombre: U.primerNombre(cli.nombre), monto: U.pesos(c.anticipo.monto), barberia: BS.get().shop.nombre, dia: U.diaRelativo(c.inicio), hora: U.hora(c.inicio) })
  });
}

/* ==========================================================================
   RELOJ: tareas por hora del día
   ========================================================================== */
function hecha(clave) { return !!uno("SELECT 1 AS x FROM tareas WHERE clave = ?", clave); }

/** Mira (solo lectura) qué hay que hacer ahora en una barbería. */
function pendientes(BS, barberiaId, ahora) {
  const st = BS.get(), U = BS.util, out = [];
  const min = ahora.getHours() * 60 + ahora.getMinutes(), dia = U.claveDia(ahora);
  if (prendida(BS, "recordatorio")) {
    st.citas.forEach((c) => {
      if (c.estado !== "confirmada" && c.estado !== "pendiente") return;
      const falta = new Date(c.inicio) - ahora;
      if (falta > 23.5 * 3600000 && falta <= 24.5 * 3600000 && !hecha("rec24:" + c.id)) out.push({ tipo: "recordatorio", cita: c.id, cual: 24 });
      if (falta > 1.5 * 3600000 && falta <= 2.5 * 3600000 && !hecha("rec2:" + c.id)) out.push({ tipo: "recordatorio", cita: c.id, cual: 2 });
    });
  }
  const diaria = (clave, desde) => { if (prendida(BS, clave) && min >= desde && !hecha(clave + ":" + barberiaId + ":" + dia)) out.push({ tipo: clave }); };
  diaria("cumple", 9 * 60 + 30);
  diaria("ciclo", 10 * 60);
  diaria("dormidos", 11 * 60);
  if (BS.horario(ahora)) diaria("huecos", 12 * 60);
  const h = BS.horario(ahora);
  if (h) diaria("cierre", h[1] + 15);
  if (ahora.getDay() === 6) diaria("liquidacion", 21 * 60);
  return out;
}

/** Ejecuta una receta de tiempo. forzado = «Ejecutar ahora» desde el panel. Devuelve cuántos mensajes salieron. */
function ejecutarTarea(BS, ctx, t, forzado) {
  const st = BS.get(), U = BS.util, hoy = U.claveDia(new Date());
  if (!forzado && t.tipo !== "recordatorio" && !tareaNueva(t.tipo + ":" + ctx.barberiaId + ":" + hoy, ctx.barberiaId)) return 0;
  const a = BS.autoPorClave(t.tipo);
  if (!a) return 0;

  if (t.tipo === "recordatorio") {
    const citas = t.cita ? [BS.cita(t.cita)] : st.citas.filter((c) => (c.estado === "confirmada" || c.estado === "pendiente") && new Date(c.inicio) > new Date() && new Date(c.inicio) - new Date() < 26 * 3600000 && !c.recordatorio);
    let n = 0;
    citas.forEach((c) => {
      if (!c) return;
      if (t.cita && !forzado && !tareaNueva("rec" + t.cual + ":" + c.id, ctx.barberiaId)) return;
      const cli = BS.cliente(c.cliente), tl = tel(cli);
      c.recordatorio = true;
      if (!tl) return;
      const vars = BS.varsCita(c);
      wa.encolar(ctx.barberiaId, tl, {
        texto: BS.render(a.plantilla, vars),
        botones: [{ id: "confirmar:" + c.id, titulo: "Confirmo" }, { id: "cambiar:" + c.id, titulo: "Cambiar hora" }],
        plantilla: armar("recordatorio", { nombre: vars.nombre, dia: vars.dia, hora: vars.hora, barbero: vars.barbero, barberia: st.shop.nombre }, ["confirmar:" + c.id, "cambiar:" + c.id])
      }, { auto: a.id });
      n++;
    });
    a.stats.enviados += n;
    if (n) BS.actividad({ tipo: "cal", auto: a.id, toast: true, texto: "Recordatorio enviado a " + n + (n === 1 ? " cliente" : " clientes") + " · esperando que confirmen" });
    return n;
  }

  if (t.tipo === "ciclo") {
    const lista = filtrarPublico(a, st.clientes.filter((c) => telPromo(c) && c.visitas > 0 && BS.estadoCiclo(c).estado === "toca" &&
      (!c.ultimoCiclo || U.diasEntre(c.ultimoCiclo, new Date()) >= c.ciclo))).slice(0, 30);
    lista.forEach((c) => {
      const vars = varsCliente(BS, c);
      c.ultimoCiclo = new Date().toISOString();
      wa.encolar(ctx.barberiaId, tel(c), {
        texto: BS.render(a.plantilla, vars),
        botones: [{ id: "ciclo:" + c.id, titulo: "Sí, agendame" }, { id: "no", titulo: "Ahora no" }],
        plantilla: armar("ciclo", { nombre: vars.nombre, dias: vars.dias, barberia: st.shop.nombre, barbero: vars.barbero }, ["ciclo:" + c.id, "no"])
      }, { auto: a.id });
    });
    a.stats.enviados += lista.length;
    BS.actividad({ tipo: "ciclo", auto: a.id, toast: true, texto: lista.length ? "Ciclo de corte: mensaje a " + lista.length + " clientes a los que ya les toca" : "Ciclo de corte: hoy no le toca a nadie con WhatsApp" });
    return lista.length;
  }

  if (t.tipo === "huecos") {
    const ahora = new Date(), h = BS.horario(ahora);
    if (!h) return 0;
    const desde = Math.max(U.ahoraMin() + 30, h[0]);
    let hueco = null;
    for (let m = Math.ceil(desde / 20) * 20; m + 40 <= h[1] && !hueco; m += 20) {
      const s = BS.slotsLibres(ahora, "s1", "cualquiera").filter((x) => x.min === m)[0];
      if (s) hueco = s;
    }
    if (!hueco) { BS.actividad({ tipo: "hueco", auto: a.id, texto: "Huecos libres: hoy no queda ni una silla libre. Agenda llena 🔥" }); return 0; }
    const lista = filtrarPublico(a, st.clientes.filter((c) => telPromo(c) && ["toca", "dormido", "al-dia"].indexOf(BS.estadoCiclo(c).estado) >= 0)).slice(0, 15);
    if (!lista.length) return 0;
    const inicio = U.enMin(ahora, hueco.min).toISOString();
    const idOferta = util.id("of");
    ejecutar("INSERT INTO ofertas (id, barberia_id, tipo, datos, estado, creada, expira) VALUES (?, ?, 'hueco', ?, 'abierta', ?, ?)",
      idOferta, ctx.barberiaId, JSON.stringify({ barbero: hueco.barbero, inicio, servicio: "s1" }), new Date().toISOString(), new Date(new Date(inicio).getTime() - 15 * 60000).toISOString());
    const nb = BS.barbero(hueco.barbero).nombre, hora = U.horaMin(hueco.min);
    lista.forEach((c) => {
      wa.encolar(ctx.barberiaId, tel(c), {
        texto: BS.render(a.plantilla, Object.assign(varsCliente(BS, c), { hora, barbero: nb })),
        botones: [{ id: "oferta:" + idOferta, titulo: "¡Voy!" }],
        plantilla: armar("huecos", { nombre: U.primerNombre(c.nombre), hora, barbero: nb, barberia: st.shop.nombre }, ["oferta:" + idOferta])
      }, { auto: a.id });
    });
    a.stats.enviados += lista.length;
    BS.actividad({ tipo: "hueco", auto: a.id, toast: true, texto: "Huecos libres: silla libre a las " + hora + " con " + nb + " · mensaje a " + lista.length + " clientes" });
    return lista.length;
  }

  if (t.tipo === "cumple") {
    const anio = new Date().getFullYear();
    const lista = filtrarPublico(a, st.clientes.filter((c) => telPromo(c) && BS.esCumpleProximo(c, 0) === 0 && (forzado || tareaNueva("cumple:" + c.id + ":" + anio, ctx.barberiaId))));
    lista.forEach((c) => {
      const vars = varsCliente(BS, c);
      wa.encolar(ctx.barberiaId, tel(c), { texto: BS.render(a.plantilla, vars), plantilla: armar("cumple", { nombre: vars.nombre, barberia: st.shop.nombre, link: BS.linkReservas() }) }, { auto: a.id });
    });
    a.stats.enviados += lista.length;
    if (lista.length || forzado) BS.actividad({ tipo: "regalo", auto: a.id, toast: true, texto: "Cumpleaños: saludo a " + lista.length + (lista.length === 1 ? " cliente" : " clientes") });
    return lista.length;
  }

  if (t.tipo === "dormidos") {
    const lista = filtrarPublico(a, st.clientes.filter((c) => telPromo(c) && c.visitas > 0 && BS.estadoCiclo(c).estado === "dormido" && (!c.ultimoDormido || U.diasEntre(c.ultimoDormido, new Date()) >= 30))).slice(0, 30);
    lista.forEach((c) => {
      const vars = varsCliente(BS, c);
      c.ultimoDormido = new Date().toISOString();
      wa.encolar(ctx.barberiaId, tel(c), { texto: BS.render(a.plantilla, vars), plantilla: armar("dormidos", { nombre: vars.nombre, barberia: st.shop.nombre, dias: vars.dias, link: BS.linkReservas() }) }, { auto: a.id });
    });
    a.stats.enviados += lista.length;
    BS.actividad({ tipo: "luna", auto: a.id, toast: true, texto: "Clientes dormidos: mensaje a " + lista.length + " clientes" });
    return lista.length;
  }

  if (t.tipo === "cierre") {
    const hoy0 = U.hoy0(), movs = BS.movimientos(hoy0, U.addDias(hoy0, 1)).filter((m) => m.tipo !== "liquidacion");
    const por = {}; movs.forEach((m) => { por[m.medio] = (por[m.medio] || 0) + m.monto; });
    const total = movs.reduce((s, m) => s + m.monto, 0);
    const servicios = BS.citasDelDia(hoy0).filter((c) => c.estado === "terminada").length;
    const vars = Object.assign(BS.varsEjemplo(), { total: U.pesos(total), servicios: String(servicios), nequi: U.pesos(por.nequi || 0), breb: U.pesos(por.breb || 0), efectivo: U.pesos(por.efectivo || 0) });
    const tl = util.telValido(st.shop.whatsapp) ? util.normTel(st.shop.whatsapp) : null;
    if (tl) wa.encolar(ctx.barberiaId, tl, { texto: BS.render(a.plantilla, vars), plantilla: armar("cierre", Object.assign({ barberia: st.shop.nombre }, vars)) }, { auto: a.id });
    a.stats.enviados += tl ? 1 : 0;
    BS.actividad({ tipo: "caja", auto: a.id, toast: true, texto: "Cierre de caja: " + U.pesos(total) + " en " + servicios + " servicios" + (tl ? " · enviado a tu WhatsApp" : " · agregá tu WhatsApp en Ajustes para recibirlo") });
    return tl ? 1 : 0;
  }

  if (t.tipo === "liquidacion") {
    const desde = BS.inicioSemana(new Date());
    const liq = BS.liquidacion(desde, U.addDias(desde, 7)).filter((l) => l.barbero.modo !== "dueno");
    let n = 0;
    liq.forEach((l) => {
      const tl = util.telValido(l.barbero.tel) ? util.normTel(l.barbero.tel) : null;
      if (!tl) return;
      const vars = Object.assign(BS.varsEjemplo(), { nombre: l.barbero.nombre, servicios: String(l.servicios), ventas: U.pesos(l.ventas), total: U.pesos(l.total) });
      wa.encolar(ctx.barberiaId, tl, { texto: BS.render(a.plantilla, vars), plantilla: armar("liquidacion", Object.assign({ barberia: st.shop.nombre }, vars)) }, { auto: a.id });
      n++;
    });
    a.stats.enviados += n;
    BS.actividad({ tipo: "plata", auto: a.id, toast: true, texto: "Liquidación de la semana calculada para " + liq.length + " barberos" + (n < liq.length ? " · " + (liq.length - n) + " sin WhatsApp registrado" : "") });
    return n;
  }
  return 0;
}

/** Recetas de tiempo creadas por el dueño (solo texto libre: llegan si el cliente escribió en 24 h). */
function ejecutarGenerico(BS, ctx, a) {
  const st = BS.get(), U = BS.util;
  let lista = [];
  if (a.disparador === "ciclo.cumplido") lista = st.clientes.filter((c) => BS.estadoCiclo(c).estado === "toca");
  else if (a.disparador === "cliente.dormido") lista = st.clientes.filter((c) => U.diasEntre(c.ultima, new Date()) >= (a.espera || 45));
  else if (a.disparador === "cliente.cumple") lista = st.clientes.filter((c) => BS.esCumpleProximo(c, 0) === 0);
  else if (a.disparador === "cita.antes") lista = BS.citasDelDia(U.addDias(U.hoy0(), 1)).filter(BS.citaActiva).map((c) => BS.cliente(c.cliente));
  const destino = a.disparador === "cita.antes" ? tel : telPromo; // recordar una cita no es promoción
  lista = filtrarPublico(a, lista.filter((c) => c && destino(c)));
  lista.forEach((c) => wa.encolar(ctx.barberiaId, tel(c), { texto: BS.render(a.plantilla, varsCliente(BS, c)) }, { auto: a.id }));
  a.stats.enviados += lista.length;
  BS.actividad({ tipo: "whatsapp", auto: a.id, toast: true, texto: "«" + a.nombre + "»: mensaje a " + lista.length + " clientes (llega a quienes escribieron en las últimas 24 h)" });
  return lista.length;
}

function ejecutarAhora(barberiaId, autoId) {
  return nucleo().transaccion(barberiaId, (BS, ctx) => {
    const a = BS.auto(autoId);
    if (!a) throw new util.ErrorHTTP(404, "Automatización no encontrada.");
    if (!a.activa) throw new util.ErrorHTTP(400, "Prendé la automatización antes de ejecutarla.");
    const n = a.custom ? ejecutarGenerico(BS, ctx, a) : ejecutarTarea(BS, ctx, { tipo: a.clave }, true);
    return { enviados: n };
  });
}

let ultimoTick = 0;
function tick() {
  const ahora = new Date();
  if (Date.now() - ultimoTick < 50000) return;
  ultimoTick = Date.now();
  ejecutar("UPDATE ofertas SET estado = 'vencida' WHERE estado = 'abierta' AND expira < ?", ahora.toISOString());
  for (const b of nucleo().todasLasBarberias()) {
    try {
      const lista = nucleo().leer(b.id, (BS) => pendientes(BS, b.id, ahora));
      if (lista.length) nucleo().transaccion(b.id, (BS, ctx) => { lista.forEach((t) => ejecutarTarea(BS, ctx, t, false)); });
    } catch (err) { console.warn("[reloj " + b.slug + "]", err); }
  }
}

/* ==========================================================================
   ENTRADA: lo que escribe el cliente
   ========================================================================== */
function cargarConv(barberiaId, telefono) {
  const f = uno("SELECT datos FROM conversaciones WHERE barberia_id = ? AND telefono = ?", barberiaId, telefono);
  return f ? JSON.parse(f.datos) : null;
}
function guardarConv(barberiaId, telefono, datos, entrada) {
  const ahora = new Date().toISOString();
  datos.mensajes = (datos.mensajes || []).slice(-80);
  ejecutar(`INSERT INTO conversaciones (barberia_id, telefono, datos, ultima_entrada, actualizada) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(barberia_id, telefono) DO UPDATE SET datos = excluded.datos, actualizada = excluded.actualizada,
    ultima_entrada = COALESCE(?, conversaciones.ultima_entrada)`, barberiaId, telefono, JSON.stringify(datos), entrada ? ahora : null, ahora, entrada ? ahora : null);
}

/** Botones de plantillas y mensajes interactivos (oferta, confirmar, cambiar, ciclo...). */
function manejarBoton(BS, ctx, conv, cli, payload) {
  const U = BS.util;
  const [tipo, valor] = String(payload).split(/:(.+)/);
  if (tipo === "confirmar") {
    const c = BS.cita(valor);
    if (!c || c.cliente !== cli.id) return null;
    c.confirmoCliente = true;
    const a = BS.autoPorClave("recordatorio");
    if (a) a.stats.resultados++;
    BS.actividad({ tipo: "check", auto: a && a.id, toast: true, texto: U.nombreCorto(cli.nombre) + " confirmó su turno de " + U.diaRelativo(c.inicio) + " " + U.hora(c.inicio) });
    return [bot("¡Listo, " + U.primerNombre(cli.nombre) + "! Te esperamos " + U.diaRelativo(c.inicio) + " a las " + U.hora(c.inicio) + " con " + BS.barbero(c.barbero).nombre + " 💈")];
  }
  if (tipo === "cambiar") { conv.cita = valor; return BS.asistente.responder(conv, "quiero cambiar mi turno").respuestas; }
  if (tipo === "reagendar") {
    const c = BS.cita(valor);
    conv.estado = { paso: "inicio", servicio: c ? c.servicio : null, barbero: c ? c.barbero : null };
    conv.origen = "antiplanton";
    return BS.asistente.responder(conv, "quiero un turno").respuestas;
  }
  if (tipo === "ciclo") {
    const habitual = BS.get().citas.filter((x) => x.cliente === cli.id).slice(-1)[0];
    conv.estado = { paso: "inicio", barbero: cli.barbero, servicio: habitual ? habitual.servicio : "s1" };
    conv.origen = "ciclo";
    return BS.asistente.responder(conv, "quiero un turno").respuestas;
  }
  if (tipo === "oferta") return reclamarOferta(BS, ctx, cli, valor);
  if (tipo === "no") return [bot("Listo, cuando querás me escribís 👋")];
  return null;
}

function reclamarOferta(BS, ctx, cli, idOferta) {
  const U = BS.util;
  const of = uno("SELECT * FROM ofertas WHERE id = ? AND barberia_id = ?", idOferta, ctx.barberiaId);
  if (!of) return [bot("Esa oferta ya no está disponible 😕 ¿Te busco otro turno?", { rapidas: ["Agendar turno"] })];
  const d = JSON.parse(of.datos);
  const s = BS.servicio(d.servicio) || BS.get().servicios[0];
  const libre = BS.slotsLibres(new Date(d.inicio), s.id, d.barbero).some((x) => x.min === U.minDelDia(d.inicio));
  if (of.estado !== "abierta" || new Date(of.expira) < new Date() || !libre) {
    ejecutar("UPDATE ofertas SET estado = 'cerrada' WHERE id = ? AND estado = 'abierta'", idOferta);
    return [bot("Uy, ese turno ya lo tomaron 😅 ¿Te busco otro?", { rapidas: ["Agendar turno"] })];
  }
  const cita = BS.crearCita({ cliente: cli.id, barbero: d.barbero, servicio: s.id, inicio: d.inicio, fuente: of.tipo === "hueco" ? "hueco" : "espera", estado: "confirmada", canal: "asistente" });
  ejecutar("UPDATE ofertas SET estado = 'tomada' WHERE id = ?", idOferta);
  const a = BS.autoPorClave(of.tipo === "hueco" ? "huecos" : "espera");
  if (a) { a.stats.resultados++; a.stats.plata += cita.precio; }
  BS.actividad({ tipo: "plata", auto: a && a.id, toast: true, plata: cita.precio, texto: U.nombreCorto(cli.nombre) + " tomó el turno liberado de las " + U.hora(cita.inicio) + " · plata recuperada" });
  return [bot("¡Es tuyo! 🙌 " + s.nombre + ", " + U.diaRelativo(cita.inicio) + " a las " + U.hora(cita.inicio) + " con " + BS.barbero(cita.barbero).nombre + ". Te esperamos 💈")];
}

/**
 * Un mensaje del cliente. msg = { texto, payload, nombre }. Para el simulador del panel, telefono = "prueba:<usuario>".
 * Devuelve la conversación (para mostrarla en el panel).
 */
async function entrada(barberiaId, telefono, msg, opciones) {
  opciones = opciones || {};
  const prueba = wa.esPrueba(telefono);
  const conPago = [];
  const datos = nucleo().transaccion(barberiaId, (BS, ctx) => {
    const U = BS.util;
    let cli = prueba ? BS.get().clientes.filter((c) => c.nombre === "Cliente de prueba")[0] : BS.get().clientes.filter((c) => util.normTel(c.tel) === telefono)[0];
    if (!cli) {
      cli = BS.upsertCliente(prueba ? { nombre: "Cliente de prueba" } : { nombre: msg.nombre || "Cliente WhatsApp", tel: telefono });
      if (prueba) cli.etiquetas = ["Prueba"];
      else BS.actividad({ tipo: "chat", toast: true, texto: "Nuevo cliente por WhatsApp: " + cli.nombre });
    }
    if (!prueba && !cli.consentimiento) cli.consentimiento = { fecha: new Date().toISOString(), origen: "whatsapp (el cliente inició la conversación)" };
    let conv = cargarConv(barberiaId, telefono) || BS.asistente.nuevaConv(cli.id, BS.get().shop.tono);
    conv.cliente = cli.id; conv.nombre = U.primerNombre(cli.nombre); conv.tono = BS.get().shop.tono || "paisa";
    if (conv.cita && !BS.cita(conv.cita)) conv.cita = null;
    const citaAntes = conv.cita;
    const pl = String(msg.payload || "");
    const texto = String(pl.startsWith("r:") ? pl.slice(2) : msg.texto || "").slice(0, 500);
    conv.mensajes = (conv.mensajes || []).concat([{ de: "cliente", texto: texto || "[" + (msg.tipo || "mensaje") + "]", hora: new Date().toISOString() }]);

    let respuestas = null;
    const payload = String(msg.payload || "");
    // Baja / alta de promociones (Ley 1581: el cliente puede revocar la autorización cuando quiera)
    const plano = sinTildes(texto);
    if (!payload || payload.startsWith("r:")) {
      if (RE_BAJA.test(plano)) {
        if (!cli.sinPromos) BS.actividad({ tipo: "x", toast: true, texto: U.nombreCorto(cli.nombre) + " pidió no recibir más promociones por WhatsApp" });
        cli.sinPromos = cli.sinPromos || new Date().toISOString();
        respuestas = [bot("Listo, no te vuelvo a mandar promociones 🙌 Los mensajes de tus citas (confirmación y recordatorio) sí te siguen llegando. Si algún día querés volverlas a recibir, escribime «quiero promociones».")];
      } else if (RE_ALTA.test(plano) && cli.sinPromos) {
        cli.sinPromos = false;
        BS.actividad({ tipo: "check", toast: true, texto: U.nombreCorto(cli.nombre) + " volvió a aceptar promociones por WhatsApp" });
        respuestas = [bot("¡De una! Te vuelvo a avisar cuando te toque corte o se libere un turno 💈")];
      }
    }
    if (!respuestas && payload && !payload.startsWith("r:")) respuestas = manejarBoton(BS, ctx, conv, cli, payload);
    if (!respuestas) {
      if (!texto) respuestas = [bot("Por ahora solo entiendo mensajes de texto 😅 ¿Te agendo un turno?", { rapidas: ["Agendar turno"] })];
      else respuestas = BS.asistente.responder(conv, texto).respuestas;
    }
    // Cita nueva desde el chat: queda unida a esta conversación (para confirmar el pago aquí mismo)
    if (conv.cita && conv.cita !== citaAntes) {
      const c = BS.cita(conv.cita);
      if (c) {
        c.conv = telefono;
        if (conv.origen === "ciclo" || conv.origen === "antiplanton") {
          const a = BS.autoPorClave(conv.origen === "ciclo" ? "ciclo" : "antiplanton");
          if (a) { a.stats.resultados++; if (conv.origen === "ciclo") a.stats.plata += c.precio; }
          conv.origen = null;
        }
        BS.actividad({ tipo: "whatsapp", toast: true, texto: "El asistente agendó a " + U.nombreCorto(cli.nombre) + " para " + U.diaRelativo(c.inicio) + " a las " + U.hora(c.inicio) + (prueba ? " (prueba desde el panel)" : "") });
      }
    }
    respuestas.forEach((r) => { if (r.pago && !r.pago.pagado) conPago.push(r); });
    conv.mensajes = conv.mensajes.concat(respuestas);
    guardarConv(barberiaId, telefono, conv, true);
    return { conv, respuestas };
  });

  // Fuera de la transacción: links de pago (llamada a la pasarela) y envío por WhatsApp
  const pagos = require("./pagos");
  for (const r of conPago) {
    try { r.pago.url = await pagos.prepararPago(barberiaId, r.pago.cita); } catch (e) { console.warn("[pago]", e.message); }
  }
  if (conPago.length) {
    const actual = cargarConv(barberiaId, telefono);
    if (actual) {
      conPago.forEach((r) => { const m = actual.mensajes.filter((x) => x.hora === r.hora && x.texto === r.texto)[0]; if (m) m.pago = r.pago; });
      guardarConv(barberiaId, telefono, actual, false);
    }
  }
  if (!prueba) {
    for (const r of datos.respuestas) {
      const texto = r.texto + (r.pago && r.pago.url ? "\n\nPagá el anticipo aquí 👉 " + r.pago.url : "");
      const botones = (r.rapidas || []).slice(0, 3).map((x) => ({ id: "r:" + x.slice(0, 200), titulo: x.slice(0, 20) }));
      wa.encolar(barberiaId, telefono, { texto, botones });
    }
    wa.procesarCola().catch(() => {});
  }
  return cargarConv(barberiaId, telefono);
}

function despues() { setImmediate(() => wa.procesarCola().catch((e) => console.warn("[cola]", e))); }

module.exports = { manejar, tick, ejecutarAhora, entrada, anticipoRecibido, despues, cargarConv };
