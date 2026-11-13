/* ==========================================================================
   Barber SaaS — Vista «Asistente WhatsApp» del panel
   Le escribís como si fueras un cliente.
   - Modo demo: el cerebro (asistente-core.js) responde aquí mismo.
   - Conectado al servidor: la conversación pasa por el mismo asistente que
     contesta el WhatsApp real, y los anticipos usan la pasarela configurada.
   ========================================================================== */
(function () {
  "use strict";
  var BS = window.BS, U = BS.util, esc = U.escapar, APP = window.APP;
  var ico = APP.ico, A = BS.asistente;

  var conv = null;         // demo: conversación local
  var remoto = null;       // servidor: { mensajes, conv }
  var sondeo = null;

  function enServidor() { return BS.conexion && BS.conexion.modo === "servidor"; }
  function tono() { return BS.get().shop.tono || "paisa"; }

  function nuevaConv() {
    var cli = BS.cliente("c1") || BS.get().clientes[0];
    if (!cli) cli = BS.upsertCliente({ nombre: "Cliente de prueba", tel: "3000000000" });
    return A.nuevaConv(cli.id, tono());
  }
  function datosConv() { return enServidor() ? (remoto && remoto.conv) || { mensajes: [], estado: { paso: "inicio" } } : conv; }
  function mensajes() { return enServidor() ? (remoto ? remoto.mensajes : []) : conv.mensajes; }

  /* ---------------- Pintar ---------------- */
  function formato(txt) { return esc(txt).replace(/\*([^*]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>"); }
  function msgHTML(m) {
    if (m.de === "sistema") return '<span class="msg-pago">' + ico("check") + esc(m.texto) + "</span>";
    if (m.de === "cliente") return '<div class="msg msg--out">' + esc(m.texto) + '<span class="msg-meta">' + U.hora(m.hora) + " " + ico("dobles") + "</span></div>";
    var pago = "";
    if (m.pago) {
      if (m.pago.pagado) pago = '<div class="msg-tarjeta-pago"><span class="msg-boton is-hecho">' + ico("check") + "Anticipo pagado</span></div>";
      else if (m.pago.url) pago = '<div class="msg-tarjeta-pago"><a class="msg-boton" href="' + esc(m.pago.url) + '" target="_blank" rel="noopener">Pagar ' + U.pesos(m.pago.monto) + " ↗</a></div>";
      else pago = '<div class="msg-tarjeta-pago"><button class="msg-boton" data-bot-pagar="breb">Pagar ' + U.pesos(m.pago.monto) + " con Bre-B</button>" + '<button class="msg-boton" data-bot-pagar="nequi">Pagar con Nequi</button></div>';
    }
    return '<div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + "Automático</span>" + formato(m.texto) + pago + '<span class="msg-meta">' + U.hora(m.hora) + "</span></div>";
  }
  function pintarChat() {
    var body = document.querySelector("[data-bot-body]");
    if (!body) return;
    var lista = mensajes(), c = datosConv();
    var html = '<span class="msg-dia">Hoy</span>';
    if (!lista.length) html += '<span class="msg-dia" style="max-width:85%;text-align:center;line-height:1.4">Escribile al asistente como si fueras ' + esc(c.nombre || "un cliente") + ", un cliente de la barbería 👇</span>";
    html += lista.map(msgHTML).join("");
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;
    var ultimo = lista[lista.length - 1];
    var rap = document.querySelector("[data-bot-rapidas]");
    var opciones = !lista.length ? ["¿Tienen turno hoy?", "Corte y barba mañana a las 4", "¿Cuánto vale el corte?", "¿Cuánta gente hay en la fila?"] :
      (ultimo && ultimo.de === "bot" && ultimo.rapidas) ? ultimo.rapidas : [];
    rap.innerHTML = opciones.map(function (o) { return '<button type="button" class="rapida" data-bot-rapida="' + esc(o) + '">' + esc(o) + "</button>"; }).join("");
  }
  function pintarEntendio() {
    var cont = document.querySelector("[data-bot-entendio]");
    if (!cont) return;
    var c = datosConv(), r = c.ultimo;
    if (!r) { cont.innerHTML = '<p class="sub">Todavía no hay mensajes. Escribí algo en el chat o tocá un ejemplo.</p>'; return; }
    var e = c.estado.servicio || !c.ultimoEstado ? c.estado : Object.assign({}, c.ultimoEstado, { paso: c.estado.paso });
    function chip(k, v, nuevo) { return '<span class="ent' + (nuevo ? " is-nuevo" : "") + '"><small>' + k + "</small>" + esc(v) + "</span>"; }
    var nuevos = r.nuevos || {}, chips = [];
    var algunDato = Object.keys(nuevos).length > 0;
    chips.push(chip("Intención", r.opcion != null ? "Eligió la opción " + (r.opcion + 1) : A.INTENCIONES[r.intencion] || (algunDato ? "Dato para la reserva" : "No entendió"), true));
    if (e.servicio && BS.servicio(e.servicio)) chips.push(chip("Servicio", BS.servicio(e.servicio).nombre, nuevos.servicio));
    if (e.dia != null) chips.push(chip("Día", A.nombreDia(e.dia, U.addDias(U.hoy0(), e.dia)), nuevos.dia));
    if (e.hora != null) chips.push(chip("Hora", U.horaMin(e.hora), nuevos.hora));
    if (e.franja) chips.push(chip("Franja", { manana: "mañana", mediodia: "mediodía", tarde: "tarde", noche: "noche" }[e.franja], nuevos.franja));
    if (e.barbero) chips.push(chip("Barbero", e.barbero === "cualquiera" ? "el que esté libre" : (BS.barbero(e.barbero) || { nombre: "—" }).nombre, nuevos.barbero));
    cont.innerHTML = '<p class="sub" style="font-size:13px">Mensaje: «' + esc(r.texto) + '»</p><div class="entendio-fila">' + chips.join("") + "</div>" +
      '<div class="aviso-auto" style="background:#1a1818;box-shadow:inset 0 0 0 1px var(--linea)">' + ico("sparkle") + "<div><b>Siguiente paso:</b> " + esc(A.PASOS[e.paso] || e.paso) +
      (c.cita && BS.cita(c.cita) ? ' · <button class="link" data-accion="ver-cita" data-id="' + c.cita + '">Ver la cita en la agenda' + ico("flecha") + "</button>" : "") + "</div></div>";
  }
  function pintarPanel() {
    var feed = document.querySelector("[data-bot-feed]");
    if (feed) feed.innerHTML = APP.feedHTML(BS.get().actividad.slice(0, 4));
  }

  var ocupado = false;
  function escribir(respuestas, alTerminar) {
    var body = document.querySelector("[data-bot-body]");
    var i = 0;
    ocupado = true;
    (function siguiente() {
      if (i >= respuestas.length) { ocupado = false; pintarChat(); pintarEntendio(); if (alTerminar) alTerminar(); return; }
      var tecleo = document.createElement("span");
      tecleo.className = "escribiendo"; tecleo.innerHTML = "<i></i><i></i><i></i>";
      if (body) { body.appendChild(tecleo); body.scrollTop = body.scrollHeight; }
      setTimeout(function () {
        if (tecleo.parentNode) tecleo.parentNode.removeChild(tecleo);
        mensajes().push(respuestas[i++]);
        pintarChat();
        setTimeout(siguiente, 250);
      }, 650 + Math.random() * 450);
    })();
  }

  /* ---------------- Demo (local) ---------------- */
  function enviarLocal(texto) {
    conv.tono = tono();
    conv.mensajes.push({ de: "cliente", texto: texto, hora: new Date().toISOString() });
    pintarChat();
    var res = A.responder(conv, texto);
    pintarEntendio();
    escribir(res.respuestas);
  }
  function pagarLocal(medio) {
    var c = BS.cita(conv.cita);
    if (!c || (c.anticipo && c.anticipo.pagado)) return;
    BS.pagarAnticipo(c.id, medio);
    var msgs = A.confirmarPago(conv, c.id);
    conv.mensajes.push(msgs[0]);
    pintarChat();
    escribir(msgs.slice(1));
  }

  /* ---------------- Conectado al servidor ---------------- */
  function enviarServidor(texto) {
    var largo = mensajes().length;
    mensajes().push({ de: "cliente", texto: texto, hora: new Date().toISOString() });
    pintarChat();
    ocupado = true;
    BS.conexion.post("asistente/probar", { texto: texto }).then(function (res) {
      ocupado = false;
      var nuevas = res.mensajes.slice(largo + 1);
      remoto.conv = res.conv;
      remoto.mensajes = res.mensajes.slice(0, largo + 1);
      pintarEntendio();
      escribir(nuevas, function () { remoto.mensajes = res.mensajes; });
    }).catch(function () {
      ocupado = false;
      APP.toastSimple("No pude hablar con el servidor. Revisá tu conexión.", "x", "Asistente");
    });
  }
  function sondear() {
    if (!enServidor() || ocupado || !document.querySelector("[data-bot-body]")) return;
    BS.conexion.get("asistente/probar").then(function (res) {
      if (ocupado || !remoto) return;
      if (res.mensajes.length !== remoto.mensajes.length || JSON.stringify(res.mensajes.slice(-1)) !== JSON.stringify(remoto.mensajes.slice(-1))) {
        remoto = res; pintarChat(); pintarEntendio();
      }
    }).catch(function () { /* reintenta en el próximo ciclo */ });
  }

  function enviar(texto) {
    texto = String(texto || "").trim();
    if (!texto || ocupado) return;
    if (enServidor()) enviarServidor(texto); else enviarLocal(texto);
  }

  /* ---------------- Vista ---------------- */
  APP.vistas.asistente = {
    titulo: "Asistente WhatsApp",
    sub: function () { return enServidor() ? "La misma conversación que tendrá tu WhatsApp real · probalo aquí" : "Contesta, agenda y cobra el anticipo a cualquier hora · probalo aquí"; },
    estable: true,
    html: function () {
      if (!enServidor() && !conv) conv = nuevaConv();
      if (enServidor() && !remoto) remoto = { mensajes: [], conv: null };
      var st = BS.get(), t = tono();
      var ejemplos = ["Qué más parce, ¿hay turno mañana tipo 4?", "Corte y barba hoy en la tarde", "¿Cuánto vale el corte?", "¿Dónde quedan?", "¿Cuánta gente hay en la fila?", "Necesito cancelar mi turno"];
      var proveedor = BS.conexion && BS.conexion.sesion ? BS.conexion.sesion.integraciones : null;
      return '<div class="asis-grid"><div class="telefono asis-tel"><div class="telefono-pantalla"><div class="telefono-isla"></div>' +
        '<div class="telefono-barra"><span>' + U.horaCorta(U.ahoraMin()) + '</span><span class="mono">●●● 5G</span></div>' +
        '<div class="chat"><div class="chat-head"><span class="chat-avatar"><span class="poste is-on"></span></span><span><b>' + esc(st.shop.nombre) + "</b><small>Asistente automático · responde al instante</small></span></div>" +
        '<div class="chat-body" data-bot-body aria-live="polite"></div><div class="rapidas" data-bot-rapidas></div>' +
        '<form class="chat-input" data-bot-form autocomplete="off"><input data-bot-input placeholder="Escribí como cliente…" aria-label="Mensaje para el asistente" maxlength="200"><button type="submit" aria-label="Enviar">' + ico("enviar") + "</button></form></div></div></div>" +
        '<div class="asis-panel hoy-col">' +
        (enServidor() ? '<div class="aviso-auto">' + ico("chat") + "<div><b>Conectado al servidor.</b> Las citas que agendes aquí son reales en tu agenda." +
          (proveedor ? " WhatsApp: <b>" + esc(proveedor.whatsapp === "meta" ? "API de Meta" : "simulador") + "</b> · Pagos: <b>" + esc(proveedor.pagos === "wompi" ? "Wompi" : "simulador") + "</b>." : "") + "</div></div>" : "") +
        '<section class="card"><div class="card-cab"><div><h2>Lo que entendió el asistente</h2><p>Así lee cada mensaje antes de responder</p></div></div><div class="entendio" data-bot-entendio></div></section>' +
        '<section class="card"><div class="card-cab"><div><h2>Probá con estos mensajes</h2><p>Tocá uno y mirá cómo agenda solo en tu panel</p></div></div><div class="ejemplos">' +
        ejemplos.map(function (x) { return '<button type="button" class="ejemplo" data-bot-rapida="' + esc(x) + '">' + esc(x) + "</button>"; }).join("") + "</div></section>" +
        '<section class="card"><div class="card-cab"><h2>Cómo habla</h2></div>' +
        '<div class="interruptor-fila"><span><b>Tono</b><small>Cómo le escribe a tus clientes</small></span><div class="chips"><button class="chip' + (t === "paisa" ? " is-on" : "") + '" data-bot-tono="paisa">Paisa</button><button class="chip' + (t === "neutro" ? " is-on" : "") + '" data-bot-tono="neutro">Neutro</button></div></div>' +
        '<div class="interruptor-fila"><span><b>Anticipo al agendar</b><small>' + (st.shop.anticipo.activo ? "Pide " + (st.shop.anticipo.tipo === "fijo" ? U.pesos(st.shop.anticipo.valor) : st.shop.anticipo.porcentaje + " %") + " para separar el turno" : "Apagado: agenda sin cobrar") + '</small></span><a class="link" href="#/ajustes">Cambiar' + ico("flecha") + "</a></div>" +
        '<div class="interruptor-fila"><span><b>Empezar de nuevo</b><small>Borra esta conversación de prueba</small></span><button class="btn btn--suave btn--sm" data-bot-reiniciar>' + ico("ciclo") + "Reiniciar</button></div></section>" +
        '<section class="card"><div class="card-cab"><div><h2>Mientras tanto, en tu panel</h2><p>Lo que el chat va creando</p></div><a class="link" href="#/agenda">Agenda' + ico("flecha") + '</a></div><div data-bot-feed></div></section>' +
        "</div></div>";
    },
    montar: function (raiz) {
      pintarChat(); pintarEntendio(); pintarPanel();
      if (enServidor()) {
        BS.conexion.get("asistente/probar").then(function (res) { remoto = res; pintarChat(); pintarEntendio(); }).catch(function () {});
        clearInterval(sondeo); sondeo = setInterval(sondear, 3000);
      }
      var form = raiz.querySelector("[data-bot-form]"), input = raiz.querySelector("[data-bot-input]");
      form.addEventListener("submit", function (e) { e.preventDefault(); enviar(input.value); input.value = ""; input.focus(); });
      raiz.addEventListener("click", function (e) {
        var rap = e.target.closest("[data-bot-rapida]");
        if (rap) { enviar(rap.getAttribute("data-bot-rapida")); return; }
        var pg = e.target.closest("[data-bot-pagar]");
        if (pg) { pagarLocal(pg.getAttribute("data-bot-pagar")); return; }
        var tn = e.target.closest("[data-bot-tono]");
        if (tn) { BS.get().shop.tono = tn.getAttribute("data-bot-tono"); BS.commit("shop"); APP.render(true); return; }
        if (e.target.closest("[data-bot-reiniciar]")) {
          if (enServidor()) BS.conexion.borrar("asistente/probar").then(function () { remoto = { mensajes: [], conv: null }; APP.render(true); });
          else { conv = nuevaConv(); APP.render(true); }
        }
      });
      if (window.matchMedia("(hover: hover)").matches) setTimeout(function () { input.focus({ preventScroll: true }); }, 100);
    },
    actualizar: function () { pintarPanel(); }
  };
  if (APP.listo && APP.render) APP.render(true);
})();
