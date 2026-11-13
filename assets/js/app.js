/* ==========================================================================
   Barber SaaS — Plataforma (panel del dueño)
   Vistas: Hoy · Agenda · Fila virtual · Automatizaciones · Clientes · Caja · Ajustes
   (El asistente de WhatsApp vive en app-bot.js)
   ========================================================================== */
(function () {
  "use strict";
  var BS = window.BS, U = BS.util, esc = U.escapar;
  var APP = (window.APP = window.APP || { vistas: {} });
  APP.vistas = APP.vistas || {};

  /* ---------------- Íconos ---------------- */
  var IC = {
    inicio: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4V15h-5v5.5h-4A1.5 1.5 0 0 1 4 19z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    fila: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.7 2.4 3 5.2"/>',
    rayo: '<path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13z"/>',
    chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.2A8.5 8.5 0 1 1 20.5 11.5z"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>',
    plata: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
    ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M7 7l10 10M17 7L7 17"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    tijeras: '<circle cx="6" cy="6.5" r="3"/><circle cx="6" cy="17.5" r="3"/><path d="M8.6 8.1L20 18M8.6 15.9L20 6"/>',
    escudo: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    ciclo: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>',
    hueco: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
    estrella: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    regalo: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12M12 8v12.5"/><path d="M12 8c-1.5-3.5-6-3.5-5-1s5 1 5 1zm0 0c1.5-3.5 6-3.5 5-1s-5 1-5 1z"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 18.5v2M18.5 14h2"/>',
    enlace: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    externo: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
    chevI: '<path d="M15 5l-7 7 7 7"/>',
    chevD: '<path d="M9 5l7 7-7 7"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    basura: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5A1.5 1.5 0 0 0 8 21h8a1.5 1.5 0 0 0 1.5-1.5l1-12.5M9 7V4.5h6V7"/>',
    enviar: '<path d="M21 3L10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    tienda: '<path d="M4 9.5V20h16V9.5"/><path d="M3 9.5l1.5-5h15l1.5 5z"/><path d="M9.5 20v-5h5v5"/>',
    caja: '<rect x="3.5" y="9" width="17" height="11" rx="2"/><path d="M7 9V5.5h7V9M7 13h2M11 13h2M15 13h2M7 16.5h10"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    ubicacion: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    web: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5s1.1-6.1 3.6-8.5z"/>',
    dobles: '<path d="M2.5 12.5l4 4L14.5 8.5M11 16l.5.5L20 8"/>',
    descargar: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M4.5 19.5h15"/>'
  };
  function ico(n, cls) { return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || IC.rayo) + "</svg>"; }
  var TIPO_ICO = { whatsapp: "chat", resena: "estrella" };
  function icoTipo(t) { return TIPO_ICO[t] || (IC[t] ? t : "rayo"); }
  APP.ico = ico;

  /* ---------------- Helpers ---------------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function estadoChip(estado) {
    var e = BS.ESTADOS[estado] || BS.ESTADOS.confirmada;
    return '<span class="estado estado--' + e.clase + '">' + ico(e.ico) + e.txt + "</span>";
  }
  function avatar(nombre, cls) { return '<span class="avatar' + (cls ? " " + cls : "") + '" aria-hidden="true">' + esc(U.iniciales(nombre)) + "</span>"; }
  var FUENTE_ICO = { whatsapp: "chat", web: "web", manual: "tienda", fila: "fila", espera: "rayo", ciclo: "ciclo", hueco: "hueco" };
  function fuenteIco(f) { return FUENTE_ICO[f] || "cal"; }
  function saludoHora() { var h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"; }
  APP.helpers = { estadoChip: estadoChip, avatar: avatar, fuenteIco: fuenteIco };

  /* ---------------- Rutas ---------------- */
  var RUTAS = [
    { id: "hoy", txt: "Hoy", ico: "inicio", grupo: "Día a día" },
    { id: "agenda", txt: "Agenda", ico: "cal", grupo: "Día a día" },
    { id: "fila", txt: "Fila virtual", ico: "fila", grupo: "Día a día" },
    { id: "automatizaciones", txt: "Automatizaciones", ico: "rayo", grupo: "Piloto automático", corto: "Auto" },
    { id: "asistente", txt: "Asistente WhatsApp", ico: "chat", grupo: "Piloto automático" },
    { id: "clientes", txt: "Clientes", ico: "usuario", grupo: "Negocio" },
    { id: "caja", txt: "Caja y pagos", ico: "plata", grupo: "Negocio" },
    { id: "ajustes", txt: "Ajustes", ico: "ajustes", grupo: "Negocio" }
  ];
  var TABBAR = [["hoy", "Hoy", "inicio"], ["agenda", "Agenda", "cal"], ["fila", "Fila", "fila"], ["automatizaciones", "Auto", "rayo"], ["mas", "Más", "menu"]];
  IC.menu = '<path d="M4 7h16M4 12h16M4 17h16"/>';

  var ui = {
    ruta: null, agendaDia: U.hoy0(), agendaBarbero: "todos", clientesFiltro: "todos", clientesBusqueda: "",
    autosFiltro: "todas", cajaPeriodo: "hoy", grafTabla: false, feedAbierto: {}, nuevaId: null
  };
  APP.ui = ui;

  function rutaActual() { var h = location.hash.replace(/^#\/?/, ""); return h.split("?")[0] || "hoy"; }
  APP.ir = function (ruta) { if (rutaActual() === ruta) render(true); else location.hash = "#/" + ruta; };

  /* ---------------- Render ---------------- */
  var vistaEl, capa, toastsEl, renderPendiente = false, sucio = false;

  function render(forzar) {
    var ruta = rutaActual();
    if (!APP.vistas[ruta]) ruta = "hoy";
    var v = APP.vistas[ruta];
    var cambio = ruta !== ui.ruta;
    ui.ruta = ruta;
    var activo = document.activeElement;
    if (!forzar && !cambio) {
      if (v.estable) { if (v.actualizar) v.actualizar(); pintarShell(ruta, v); return; }
      if (activo && vistaEl.contains(activo) && /INPUT|TEXTAREA|SELECT/.test(activo.tagName)) { sucio = true; pintarShell(ruta, v); return; }
    }
    var scrollAgenda = $(".agenda-envoltura", vistaEl);
    var guardado = scrollAgenda && !cambio ? { t: scrollAgenda.scrollTop, l: scrollAgenda.scrollLeft } : null;
    vistaEl.innerHTML = v.html();
    if (cambio) {
      vistaEl.classList.remove("entra"); void vistaEl.offsetWidth; vistaEl.classList.add("entra");
      window.scrollTo(0, 0);
    }
    if (v.montar) v.montar(vistaEl, { cambio: cambio, guardado: guardado });
    pintarShell(ruta, v);
    sucio = false;
  }
  function programarRender() {
    if (renderPendiente) return;
    renderPendiente = true;
    requestAnimationFrame(function () { renderPendiente = false; render(); });
  }
  APP.render = render;
  APP.programarRender = programarRender;

  function pintarShell(ruta, v) {
    var st = BS.get();
    var r = RUTAS.filter(function (x) { return x.id === ruta; })[0] || { txt: "Más" };
    $("[data-titulo]").textContent = v.titulo || r.txt;
    $("[data-subtitulo]").textContent = typeof v.sub === "function" ? v.sub() : (v.sub || st.shop.nombre + " · " + st.shop.barrio);
    document.title = (v.titulo || r.txt) + " · Barber SaaS";
    var fila = st.fila.length;
    var activas = st.autos.filter(function (a) { return a.activa; }).length;
    var badges = { fila: fila ? '<span class="badge">' + fila + "</span>" : "", automatizaciones: '<span class="badge badge--ok">' + activas + "</span>" };
    var html = "", grupo = "";
    RUTAS.forEach(function (x) {
      if (x.grupo !== grupo) { grupo = x.grupo; html += '<p class="lat-nav-k">' + grupo + "</p>"; }
      html += '<a href="#/' + x.id + '"' + (x.id === ruta ? ' class="is-activo" aria-current="page"' : "") + ">" + ico(x.ico) + "<span>" + x.txt + "</span>" + (badges[x.id] || "") + "</a>";
    });
    $("[data-nav]").innerHTML = html;
    $("[data-tabbar]").innerHTML = TABBAR.map(function (t) {
      var on = t[0] === ruta || (t[0] === "mas" && ["asistente", "clientes", "caja", "ajustes", "mas"].indexOf(ruta) >= 0);
      return '<a href="#/' + t[0] + '"' + (on ? ' class="is-activo" aria-current="page"' : "") + ">" + ico(t[2]) + t[1] + (t[0] === "fila" && fila ? '<span class="badge">' + fila + "</span>" : "") + "</a>";
    }).join("");
    $("[data-shop-nombre]").textContent = st.shop.nombre;
    $("[data-shop-barrio]").textContent = st.shop.barrio + " · " + st.shop.ciudad;
    $("[data-dueno-nombre]").textContent = st.shop.dueno;
    $("[data-dueno-ini]").textContent = U.iniciales(st.shop.dueno);
    var vivo = $("[data-accion='toggle-vivo']");
    vivo.setAttribute("aria-pressed", String(!!st.ajustes.demoVivo));
    vivo.hidden = enServidor() || !BS.esEjemplo();
    var linkRes = $("[data-link-reservas]");
    if (linkRes) linkRes.href = enServidor() ? BS.linkReservas() : reservaDemo();
    var crearMia = $("[data-crear-mia]");
    if (crearMia) crearMia.hidden = enServidor() || !BS.esEjemplo();
    var perfil = $("[data-perfil-sub]");
    if (perfil) perfil.textContent = enServidor() ? "Dueño · " + ((BS.conexion.sesion && BS.conexion.sesion.usuario && BS.conexion.sesion.usuario.email) || "") : BS.esEjemplo() ? "Barbería de ejemplo" : "Dueño · Demo";
  }

  /* ---------------- Toasts ---------------- */
  var vistos = {};
  function marcarVistos() { BS.get().actividad.forEach(function (a) { vistos[a.id] = 1; }); }
  function revisarToasts() {
    var nuevas = BS.get().actividad.filter(function (a) { return !vistos[a.id]; });
    marcarVistos();
    nuevas.reverse().filter(function (a) { return a.toast; }).slice(-3).forEach(function (a, i) {
      setTimeout(function () { toast(a); }, i * 450);
    });
  }
  function toast(a) {
    var auto = a.auto ? BS.auto(a.auto) : null;
    var tipoClase = a.tipo === "plata" || a.plata ? "ok" : a.tipo === "fila" ? "info" : a.tipo === "x" ? "alerta" : "";
    var el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML = '<span class="toast-ico' + (tipoClase ? " toast-ico--" + tipoClase : "") + '">' + ico(icoTipo(a.tipo)) + "</span>" +
      "<div><small>" + (auto ? "Automatización · " + esc(auto.nombre) : esc(a.titulo || "Actividad")) + "</small><p>" + esc(a.texto) +
      (a.plata ? ' <b class="mov-pos">+' + U.pesos(a.plata) + "</b>" : "") + "</p></div>";
    toastsEl.appendChild(el);
    while (toastsEl.children.length > 3) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(function () { el.classList.add("is-saliendo"); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320); }, 5600);
  }
  APP.toastSimple = function (texto, tipo, titulo) { toast({ texto: texto, tipo: tipo || "check", titulo: titulo || "Listo" }); };

  /* ---------------- Capa: cajón y modal ---------------- */
  APP.capaActual = null;
  function abrir(tipo, html, opts) {
    capa.innerHTML = '<div class="' + tipo + '" role="dialog" aria-modal="true">' + html + "</div>";
    capa.hidden = false;
    document.body.style.overflow = "hidden";
    APP.capaActual = Object.assign({ tipo: tipo }, opts || {});
    var foco = $("[autofocus]", capa) || $("button, input, select, textarea, a[href]", capa);
    if (foco) setTimeout(function () { foco.focus(); }, 60);
  }
  APP.abrirCajon = function (html, opts) { abrir("cajon", html, opts); };
  APP.abrirModal = function (html, opts) { abrir("modal", html, opts); };
  APP.cerrarCapa = function () {
    if (capa.hidden) return;
    var actual = APP.capaActual;
    capa.hidden = true; capa.innerHTML = ""; document.body.style.overflow = "";
    APP.capaActual = null;
    if (actual && actual.alCerrar) actual.alCerrar();
    if (sucio) programarRender();
  };
  function refrescarCapa() {
    if (APP.capaActual && APP.capaActual.refrescar && !capa.hidden) {
      var cuerpo = $(".cajon-cuerpo", capa), sc = cuerpo ? cuerpo.scrollTop : 0;
      var html = APP.capaActual.refrescar();
      if (html == null) { APP.cerrarCapa(); return; }
      capa.firstChild.innerHTML = html;
      cuerpo = $(".cajon-cuerpo", capa); if (cuerpo) cuerpo.scrollTop = sc;
    }
  }
  function cabCajon(titulo, sub, extra) {
    return '<div class="cajon-cab"><div>' + (extra || "") + "<h2>" + titulo + "</h2>" + (sub ? "<p>" + sub + "</p>" : "") +
      '</div><button class="btn-ico" type="button" data-accion="cerrar" aria-label="Cerrar">' + ico("x") + "</button></div>";
  }
  APP.cabCajon = cabCajon;

  /* ==========================================================================
     VISTA: HOY
     ========================================================================== */
  function ingresosHasta(dia, minLimite) {
    var d0 = U.hoy0(); d0 = new Date(dia); d0.setHours(0, 0, 0, 0);
    return BS.movimientos(d0, U.addDias(d0, 1)).filter(function (m) {
      return m.tipo !== "liquidacion" && U.minDelDia(m.t) <= minLimite;
    }).reduce(function (s, m) { return s + m.monto; }, 0);
  }

  APP.vistas.hoy = {
    titulo: "Hoy",
    sub: function () { var f = U.fechaLarga(new Date()); return f.charAt(0).toUpperCase() + f.slice(1); },
    html: function () {
      var st = BS.get(), hoy = new Date(), nowMin = U.ahoraMin();
      var citasHoy = BS.citasDelDia(hoy).filter(BS.citaActiva);
      var pendientes = citasHoy.filter(function (c) { return c.estado === "pendiente"; }).length;
      var ingresos = ingresosHasta(hoy, nowMin);
      var pasada = ingresosHasta(U.addDias(U.hoy0(), -7), nowMin);
      var delta = pasada ? Math.round(((ingresos - pasada) / pasada) * 100) : 0;
      var fila = BS.filaOrdenada();
      var espera = fila.length ? BS.esperaFila(fila.length) : 0;
      var recuperado = BS.plataRecuperada();
      var activas = st.autos.filter(function (a) { return a.activa; }).length;
      var h = BS.horario(hoy);
      var abierto = BS.abiertoAhora();

      var html = '<div class="hoy-cab"><div><p class="eyebrow">' + esc(st.shop.nombre) + " · " + esc(st.shop.barrio) + "</p>" +
        '<h2 class="saludo">' + saludoHora() + ", <strong>" + esc(st.shop.dueno) + ".</strong></h2>" +
        '<p class="saludo-sub">' + (abierto ? "Hoy tenés <b>" + citasHoy.length + " citas</b>, <b>" + fila.length + " en la fila</b> y" : "La barbería está cerrada ahora. Mientras tanto,") +
        " tus automatizaciones llevan <b>" + U.pesos(recuperado) + "</b> recuperados esta semana.</p></div>" +
        '<div class="chips"><button class="btn btn--suave btn--sm" data-accion="ir" data-ruta="asistente">' + ico("chat") + "Probar el asistente</button></div></div>";
      if (APP.mostrarCompartir && APP.mostrarCompartir()) html += APP.compartirHTML({ compacta: true });

      // KPIs
      html += '<section class="kpis" aria-label="Resumen de hoy">' +
        '<div class="card kpi kpi--hero"><span class="kpi-k">' + ico("rayo") + "Plata recuperada esta semana</span>" +
        '<b class="kpi-v">' + U.pesos(recuperado) + '</b><span class="kpi-d">Por ' + activas + " automatizaciones prendidas · " +
        '<a class="link" href="#/automatizaciones">Ver detalle' + ico("flecha") + "</a></span></div>" +
        '<div class="card kpi"><span class="kpi-k">' + ico("plata") + "Ingresos de hoy</span><b class=\"kpi-v\">" + U.pesos(ingresos) + "</b>" +
        '<span class="kpi-d">' + (pasada ? '<span class="delta delta--' + (delta >= 0 ? "sube" : "baja") + '">' + (delta >= 0 ? "▲ " : "▼ ") + Math.abs(delta) + " %</span> vs. el " + U.DIAS[new Date().getDay()] + " pasado a esta hora" : "Sin datos del día anterior") + "</span></div>" +
        '<div class="card kpi"><span class="kpi-k">' + ico("cal") + "Citas de hoy</span><b class=\"kpi-v\">" + citasHoy.length + "</b>" +
        '<span class="kpi-d">' + (pendientes ? '<span class="estado estado--alerta">' + ico("reloj") + pendientes + " sin anticipo</span>" : '<span class="estado estado--ok">' + ico("check") + "Todas confirmadas</span>") + "</span></div>" +
        '<div class="card kpi"><span class="kpi-k">' + ico("fila") + "En la fila virtual</span><b class=\"kpi-v\">" + fila.length + "</b>" +
        '<span class="kpi-d">' + (fila.length ? "Espera aprox. " + espera + " min" : abierto ? "Nadie esperando" : "Fila cerrada") + "</span></div>" +
        "</section>";

      // Columna izquierda: sillas + próximas
      var col1 = '<section class="card"><div class="card-cab"><div><h2>Ahora en las sillas</h2><p>' + (h ? "Horario de hoy: " + U.horaMin(h[0]) + " a " + U.horaMin(h[1]) : "Hoy no abrimos") + "</p></div>" +
        '<a class="link" href="#/agenda">Agenda' + ico("flecha") + "</a></div><div class=\"sillas\">";
      st.barberos.forEach(function (b) {
        var citas = BS.citasDelDia(hoy, b.id).filter(BS.citaActiva);
        var actual = citas.filter(function (c) { return c.estado === "en-silla"; })[0];
        var proxima = citas.filter(function (c) { return new Date(c.inicio) > new Date() && c.estado !== "terminada" && c.estado !== "en-silla"; })[0];
        if (actual) {
          var cli = BS.cliente(actual.cliente), srv = BS.servicio(actual.servicio);
          var pct = Math.min(100, Math.max(4, ((Date.now() - new Date(actual.inicio)) / (actual.dur * 60000)) * 100));
          col1 += '<div class="silla">' + avatar(b.nombre) + '<div class="silla-txt"><b>' + esc(b.nombre) + ' <span class="sub" style="font-weight:400">cortando a ' + esc(U.nombreCorto(cli.nombre)) + "</span></b><small>" + esc(srv.nombre) + " · termina " + U.hora(BS.finCita(actual)) + "</small></div>" +
            '<button class="btn btn--suave btn--sm" data-accion="cita-cobrar" data-id="' + actual.id + '">Cobrar</button>' +
            '<div class="silla-barra"><span class="poste is-on" style="width:' + pct.toFixed(1) + '%"></span></div></div>';
        } else {
          var sig = fila[0];
          col1 += '<div class="silla silla--libre">' + avatar(b.nombre) + '<div class="silla-txt"><b>' + esc(b.nombre) + ' <span class="estado estado--ok" style="margin-left:4px">Libre</span></b><small>' +
            (proxima ? "Próxima: " + U.hora(proxima.inicio) + " · " + esc(U.nombreCorto(BS.cliente(proxima.cliente).nombre)) : abierto ? "Sin más citas por hoy" : "Cerrado") + "</small></div>" +
            (sig && abierto ? '<button class="btn btn--sm" data-accion="fila-silla" data-id="' + sig.id + '" data-barbero="' + b.id + '">' + ico("fila") + "Pasar a " + esc(U.primerNombre(sig.nombre)) + "</button>" : "<span></span>") + "</div>";
        }
      });
      col1 += "</div></section>";

      var proximas = citasHoy.filter(function (c) {
        return (c.estado === "confirmada" || c.estado === "pendiente") && BS.finCita(c) > new Date();
      }).slice(0, 6);
      col1 += '<section class="card"><div class="card-cab"><div><h2>Próximas citas</h2><p>' + (proximas.length ? "Las siguientes de hoy" : "No quedan citas por hoy") + '</p></div><button class="btn btn--suave btn--sm" data-accion="nueva-cita">' + ico("mas") + "Nueva</button></div>";
      if (proximas.length) {
        col1 += '<div class="lista-citas">' + proximas.map(filaCita).join("") + "</div>";
      } else {
        col1 += '<div class="vacio"><b>Día despejado</b>Cuando entren reservas por WhatsApp o por tu link aparecen aquí.</div>';
      }
      col1 += "</section>";

      // Columna derecha: actividad + semana
      var col2 = '<section class="card"><div class="card-cab"><div><h2>Lo que hicieron tus automatizaciones</h2><p>En vivo, mientras vos cortás</p></div><a class="link" href="#/automatizaciones">Todas' + ico("flecha") + "</a></div>" +
        feedHTML(st.actividad.slice(0, 8)) + "</section>";
      col2 += '<section class="card"><div class="card-cab"><div><h2>Ingresos de los últimos 7 días</h2><p>Hoy va en curso</p></div>' +
        '<button class="btn btn--suave btn--sm" data-accion="graf-tabla" aria-pressed="' + ui.grafTabla + '">' + (ui.grafTabla ? "Ver gráfica" : "Ver tabla") + "</button></div>" +
        graficaSemana() + "</section>";

      html += '<div class="hoy-grid"><div class="hoy-col">' + col1 + '</div><div class="hoy-col">' + col2 + "</div></div>";
      return html;
    },
    montar: function (raiz) { montarGrafica(raiz); }
  };

  function filaCita(c) {
    var cli = BS.cliente(c.cliente), srv = BS.servicio(c.servicio), b = BS.barbero(c.barbero);
    var mins = Math.round((new Date(c.inicio) - Date.now()) / 60000);
    var cuando = mins > 0 && mins < 120 ? "en " + mins + " min" : mins <= 0 ? "ahora" : "";
    return '<div class="fila-cita" data-accion="ver-cita" data-id="' + c.id + '" role="button" tabindex="0">' +
      '<span class="fila-cita-hora">' + U.horaCorta(U.minDelDia(c.inicio)) + "<small>" + (cuando || (U.minDelDia(c.inicio) < 720 ? "a. m." : "p. m.")) + "</small></span>" +
      '<span class="fila-cita-txt"><b>' + esc(cli.nombre) + "</b><small>" + ico(fuenteIco(c.fuente)) + esc(srv.nombre) + " · con " + esc(b.nombre) + "</small></span>" +
      estadoChip(c.estado) + "</div>";
  }

  function feedHTML(items) {
    if (!items.length) return '<div class="vacio"><b>Todavía nada</b>Cuando una automatización trabaje, lo vas a ver aquí.</div>';
    return '<div class="feed">' + items.map(function (a) {
      var auto = a.auto ? BS.auto(a.auto) : null;
      var abierto = ui.feedAbierto[a.id];
      return '<div class="feed-item"><span class="feed-ico' + (a.plata || a.tipo === "plata" ? " feed-ico--plata" : auto ? " feed-ico--auto" : "") + '">' + ico(icoTipo(a.tipo)) + "</span>" +
        '<div class="feed-txt">' + esc(a.texto) + '<div class="feed-meta"><span>' + U.hace(a.t) + "</span>" +
        (auto ? '<span class="feed-auto">' + esc(auto.nombre) + "</span>" : "") +
        (a.plata ? '<span class="feed-plata">+' + U.pesos(a.plata) + "</span>" : "") +
        (a.mensaje ? '<button class="feed-ver" data-accion="feed-ver" data-id="' + a.id + '">' + (abierto ? "Ocultar mensaje" : "Ver mensaje") + "</button>" : "") +
        "</div>" + (a.mensaje && abierto ? '<div class="feed-msg">' + esc(a.mensaje) + "</div>" : "") + "</div></div>";
    }).join("") + "</div>";
  }
  APP.feedHTML = feedHTML;

  /* ---- Gráfica de barras: una serie, hoy en el acento ---- */
  function datosSemana() {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = U.addDias(U.hoy0(), -i);
      out.push({ k: U.DIAS_CORTO[d.getDay()] + " " + d.getDate(), largo: U.fechaLarga(d), v: BS.ingresosDia(d), hoy: i === 0 });
    }
    return out;
  }
  function ticks(max) {
    var paso = [50000, 100000, 200000, 250000, 500000, 1000000, 2000000].filter(function (p) { return max / p <= 4; })[0] || 5000000;
    var t = []; for (var v = 0; v <= max + paso * 0.001; v += paso) t.push(v);
    if (t[t.length - 1] < max) t.push(t[t.length - 1] + paso);
    return t;
  }
  function etiquetaEje(v) { return v === 0 ? "$0" : v >= 1e6 ? "$" + (v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " M" : "$" + Math.round(v / 1000) + " mil"; }
  function graficaSemana() {
    var datos = datosSemana();
    if (ui.grafTabla) {
      return '<table class="tabla-mini"><thead><tr><th scope="col">Día</th><th scope="col">Ingresos</th></tr></thead><tbody>' +
        datos.map(function (d) { return "<tr><td>" + esc(d.largo) + (d.hoy ? " (en curso)" : "") + "</td><td>" + U.pesos(d.v) + "</td></tr>"; }).join("") + "</tbody></table>";
    }
    var W = 560, H = 230, ml = 58, mr = 8, mt = 26, mb = 28;
    var max = Math.max.apply(null, datos.map(function (d) { return d.v; })) || 1;
    var tk = ticks(max), top = tk[tk.length - 1];
    var iw = W - ml - mr, ih = H - mt - mb, banda = iw / datos.length, bw = Math.min(24, banda * 0.46);
    function y(v) { return mt + ih - (v / top) * ih; }
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Ingresos de los últimos 7 días, de ' + esc(datos[0].largo) + " a hoy\">";
    svg += '<g class="rejilla">' + tk.map(function (t) { return '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/>'; }).join("") + "</g>";
    svg += '<g class="eje">' + tk.map(function (t) { return '<text x="' + (ml - 10) + '" y="' + (y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + etiquetaEje(t) + "</text>"; }).join("");
    svg += datos.map(function (d, i) { return '<text x="' + (ml + banda * i + banda / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle"' + (d.hoy ? ' style="fill:var(--espuma);font-weight:600"' : "") + ">" + esc(d.k) + "</text>"; }).join("") + "</g>";
    datos.forEach(function (d, i) {
      var x = ml + banda * i + (banda - bw) / 2, yy = y(d.v), base = mt + ih, r = Math.min(4, (base - yy) / 2);
      var path = d.v > 0 ? "M" + x + "," + base + " V" + (yy + r) + " Q" + x + "," + yy + " " + (x + r) + "," + yy + " H" + (x + bw - r) + " Q" + (x + bw) + "," + yy + " " + (x + bw) + "," + (yy + r) + " V" + base + " Z" : "";
      svg += '<g class="barra-g" tabindex="0" data-tip="' + esc(d.largo) + '" data-valor="' + U.pesos(d.v) + (d.hoy ? " (en curso)" : "") + '" aria-label="' + esc(d.largo) + ": " + U.pesos(d.v) + '">' +
        '<rect class="hit" x="' + (ml + banda * i).toFixed(1) + '" y="' + mt + '" width="' + banda.toFixed(1) + '" height="' + ih + '"/>' +
        (path ? '<path class="dato" d="' + path + '" fill="' + (d.hoy ? "#FF4B2B" : "#4a4441") + '"/>' : "") + "</g>";
      if (d.hoy) svg += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (yy - 8).toFixed(1) + '" text-anchor="middle" style="font-family:var(--f-mono);font-size:11px;font-weight:600;fill:var(--espuma)">' + etiquetaEje(d.v) + "</text>";
    });
    svg += "</svg>";
    return '<div class="grafica">' + svg + '<div class="tooltip" data-tooltip></div></div>';
  }
  function montarGrafica(raiz) {
    var g = $(".grafica", raiz); if (!g) return;
    var tip = $("[data-tooltip]", g);
    function mostrar(el) {
      var r = el.getBoundingClientRect(), rg = g.getBoundingClientRect();
      var dato = $(".dato", el) || el; var rd = dato.getBoundingClientRect();
      tip.innerHTML = "<span>" + esc(el.getAttribute("data-tip")) + "</span><b>" + esc(el.getAttribute("data-valor")) + "</b>";
      tip.style.left = (r.left + r.width / 2 - rg.left) + "px";
      tip.style.top = (Math.min(rd.top, r.bottom - 10) - rg.top) + "px";
      tip.classList.add("is-on");
    }
    $$(".barra-g", g).forEach(function (el) {
      el.addEventListener("mouseover", function () { mostrar(el); });
      el.addEventListener("focus", function () { mostrar(el); });
      el.addEventListener("mouseout", function (e) { if (!el.contains(e.relatedTarget)) tip.classList.remove("is-on"); });
      el.addEventListener("blur", function () { tip.classList.remove("is-on"); });
    });
  }

  /* ==========================================================================
     VISTA: AGENDA
     ========================================================================== */
  var PX = 1.5;
  APP.vistas.agenda = {
    titulo: "Agenda",
    sub: function () { return "Tocá un espacio vacío para agendar · tocá una cita para ver el detalle"; },
    html: function () {
      var st = BS.get(), dia = ui.agendaDia;
      var esHoy = U.mismoDia(dia, new Date());
      var h = BS.horario(dia);
      var barberos = ui.agendaBarbero === "todos" ? st.barberos : st.barberos.filter(function (b) { return b.id === ui.agendaBarbero; });
      if (!barberos.length) { ui.agendaBarbero = "todos"; barberos = st.barberos; }
      var html = (APP.mostrarCompartir && APP.mostrarCompartir() && esHoy ? APP.compartirHTML({ compacta: true }) : "") + '<div class="herramientas"><div class="navdia">' +
        '<button class="btn-ico" data-accion="agenda-dia" data-delta="-1" aria-label="Día anterior">' + ico("chevI") + "</button>" +
        '<button class="chip' + (esHoy ? " is-on" : "") + '" data-accion="agenda-dia" data-delta="0">Hoy</button>' +
        '<button class="btn-ico" data-accion="agenda-dia" data-delta="1" aria-label="Día siguiente">' + ico("chevD") + "</button>" +
        '<span class="navdia-fecha">' + esc(U.fechaLarga(dia).charAt(0).toUpperCase() + U.fechaLarga(dia).slice(1)) + "</span></div><span class=\"espacio\"></span>" +
        '<div class="chips" role="group" aria-label="Filtrar por barbero"><button class="chip' + (ui.agendaBarbero === "todos" ? " is-on" : "") + '" data-accion="agenda-barbero" data-id="todos">Todos</button>' +
        st.barberos.map(function (b) { return '<button class="chip' + (ui.agendaBarbero === b.id ? " is-on" : "") + '" data-accion="agenda-barbero" data-id="' + b.id + '">' + esc(b.nombre) + "</button>"; }).join("") +
        "</div></div>";
      html += '<div class="leyenda" aria-label="Estados de las citas">' +
        '<span><i style="background:#222020;box-shadow:inset 3px 0 0 var(--ok)"></i>Confirmada</span>' +
        '<span><i style="background:repeating-linear-gradient(-45deg,rgba(255,181,71,.35) 0 3px,#2a2217 3px 6px);box-shadow:inset 3px 0 0 var(--alerta)"></i>Falta anticipo</span>' +
        '<span><i style="background:#2b1714;box-shadow:inset 0 0 0 1px var(--neon)"></i>En la silla</span>' +
        '<span><i style="background:#1b1a1a;opacity:.6;box-shadow:inset 3px 0 0 #555"></i>Terminada</span>' +
        '<span><i style="box-shadow:inset 0 0 0 1.5px rgba(255,90,78,.6)"></i>No llegó</span></div>';
      if (!h) return html + '<div class="card vacio"><b>Cerrado este día</b>Cambiá el horario en Ajustes si querés abrir.</div>';

      var ini = Math.floor(h[0] / 60) * 60, fin = Math.ceil(h[1] / 60) * 60, alto = (fin - ini) * PX;
      var cols = barberos.length;
      html += '<div class="agenda-envoltura" data-agenda-scroll><div class="agenda agenda-cabeza" style="--cols:' + cols + '">' +
        '<div class="agenda-esquina"></div>' +
        barberos.map(function (b) {
          var citas = BS.citasDelDia(dia, b.id).filter(BS.citaActiva);
          var ocup = Math.round(citas.reduce(function (s, c) { return s + c.dur; }, 0) / (h[1] - h[0]) * 100);
          return '<div class="agenda-cab">' + avatar(b.nombre, "avatar--sm") + "<span><b>" + esc(b.nombre) + "</b><small>" + citas.length + " citas</small></span><span class=\"agenda-ocup\">" + ocup + " %</span></div>";
        }).join("") + "</div>";
      html += '<div class="agenda agenda-cuerpo" style="--cols:' + cols + ";--hora:" + 60 * PX + 'px;position:relative">';
      html += '<div class="agenda-horas" style="height:' + alto + 'px">';
      for (var m = ini + 60; m < fin; m += 60) html += '<span style="top:' + (m - ini) * PX + 'px">' + U.horaCorta(m) + (m < 720 ? " a" : " p") + "</span>";
      html += "</div>";
      barberos.forEach(function (b) {
        html += '<div class="agenda-col" data-accion="agenda-slot" data-barbero="' + b.id + '" data-ini="' + ini + '" style="height:' + alto + 'px" aria-label="Agenda de ' + esc(b.nombre) + '">';
        if (h[0] > ini) html += '<div class="agenda-col es-cerrado" style="position:absolute;inset:0 0 auto 0;height:' + (h[0] - ini) * PX + 'px;border:0;pointer-events:none"></div>';
        BS.citasDelDia(dia, b.id).filter(function (c) { return c.estado !== "cancelada"; }).forEach(function (c) {
          var cli = BS.cliente(c.cliente), srv = BS.servicio(c.servicio);
          var top = (U.minDelDia(c.inicio) - ini) * PX, hgt = Math.max(18, c.dur * PX - 3);
          var corto = hgt < 46;
          html += '<div class="bloque bloque--' + c.estado + (corto ? " bloque--corto" : "") + (ui.nuevaId === c.id ? " bloque--nuevo" : "") + '" style="top:' + top + "px;height:" + hgt + 'px" data-accion="ver-cita" data-id="' + c.id + '" role="button" tabindex="0" aria-label="' + esc(cli.nombre + ", " + srv.nombre + ", " + U.hora(c.inicio) + ", " + BS.ESTADOS[c.estado].txt) + '">' +
            '<span class="bloque-hora">' + U.horaCorta(U.minDelDia(c.inicio)) + (corto ? "" : "–" + U.horaCorta(U.minDelDia(BS.finCita(c)))) + " " + ico(fuenteIco(c.fuente)) + "</span>" +
            "<b>" + esc(U.nombreCorto(cli.nombre)) + "</b><small>" + esc(srv.nombre) + "</small></div>";
        });
        html += "</div>";
      });
      if (esHoy) {
        var ahora = U.ahoraMin();
        if (ahora >= ini && ahora <= fin) html += '<div class="ahora-linea" style="top:' + (ahora - ini) * PX + 'px"><span>' + U.horaCorta(ahora) + "</span></div>";
      }
      html += "</div></div>";
      return html;
    },
    montar: function (raiz, info) {
      var sc = $("[data-agenda-scroll]", raiz);
      if (!sc) return;
      if (info.guardado) { sc.scrollTop = info.guardado.t; sc.scrollLeft = info.guardado.l; }
      else if (U.mismoDia(ui.agendaDia, new Date())) {
        var h = BS.horario(ui.agendaDia); var ini = Math.floor(h[0] / 60) * 60;
        sc.scrollTop = Math.max(0, (U.ahoraMin() - ini) * PX - 160);
      }
      if (ui.nuevaId) setTimeout(function () { ui.nuevaId = null; }, 1800);
    }
  };

  /* ==========================================================================
     CAJÓN: DETALLE DE CITA
     ========================================================================== */
  function abrirCita(id) {
    function html() {
      var c = BS.cita(id); if (!c) return null;
      var cli = BS.cliente(c.cliente), srv = BS.servicio(c.servicio), b = BS.barbero(c.barbero);
      var fin = BS.finCita(c), yaEmpezo = new Date(c.inicio) <= new Date();
      var autoEspera = BS.autoPorClave("espera"), autoPlanton = BS.autoPorClave("antiplanton");
      var out = cabCajon(esc(cli.nombre), esc(srv.nombre) + " · con " + esc(b.nombre), estadoChip(c.estado) + '<div style="height:10px"></div>');
      out += '<div class="cajon-cuerpo"><div class="datos">' +
        '<div class="dato"><small>Día</small><b>' + esc(U.fechaCorta(c.inicio)) + "</b></div>" +
        '<div class="dato"><small>Hora</small><b>' + U.hora(c.inicio) + " – " + U.hora(fin) + "</b></div>" +
        '<div class="dato"><small>Precio</small><b>' + U.pesos(c.precio) + "</b></div>" +
        '<div class="dato"><small>Anticipo</small><b>' + (c.anticipo ? (c.anticipo.pagado ? U.pesos(c.anticipo.monto) + " · " + BS.MEDIOS[c.anticipo.medio] : "Pendiente") : "No aplica") + "</b></div></div>";
      if (c.estado === "pendiente") {
        out += '<div class="aviso-auto">' + ico("reloj") + '<div><b>Falta el anticipo.</b> El recordatorio de 24 h le reenvía el link de pago. Si te pagó por fuera, marcalo aquí.' +
          '<div style="margin-top:10px"><button class="btn btn--suave btn--sm" data-accion="cita-anticipo" data-id="' + c.id + '">' + ico("check") + "Marcar anticipo pagado</button></div></div></div>";
      }
      if ((c.estado === "confirmada" || c.estado === "pendiente") && !yaEmpezo && autoEspera && autoEspera.activa) {
        out += '<div class="aviso-auto">' + ico("rayo") + "<div>Si se cancela, se activa <b>«" + esc(autoEspera.nombre) + "»</b>: le ofrecemos el turno a la lista de espera y el primero que responda se lo queda.</div></div>";
      }
      out += '<div><p class="seccion-k">Ficha de corte</p><div class="ficha">' + (cli.ficha ? esc(cli.ficha) : '<span class="sub">Sin ficha todavía.</span>') + '</div><p style="margin-top:8px"><button class="link" data-accion="ver-cliente" data-id="' + cli.id + '">Ver cliente' + ico("flecha") + "</button></p></div>";
      var lt = [];
      lt.push(["cal", "Reservó por " + (BS.FUENTES[c.fuente] || c.fuente), U.hace(c.creada)]);
      if (c.fuente === "whatsapp" || c.fuente === "web") lt.push(["chat", "Confirmación automática enviada", "Automatización"]);
      if (c.anticipo && c.anticipo.pagado) lt.push(["plata", "Anticipo de " + U.pesos(c.anticipo.monto) + " por " + BS.MEDIOS[c.anticipo.medio], U.hace(c.anticipo.fecha)]);
      if (c.recordatorio) lt.push(["reloj", "Recordatorio enviado", "Automatización"]);
      if (c.estado === "en-silla") lt.push(["tijeras", "En la silla con " + b.nombre, "Ahora"]);
      if (c.estado === "terminada" && c.pago) lt.push(["check", "Cobrado " + U.pesos(c.pago.monto + c.pago.propina) + " por " + BS.MEDIOS[c.pago.medio] + (c.pago.propina ? " (propina " + U.pesos(c.pago.propina) + ")" : ""), U.hace(c.pago.fecha)]);
      if (c.estado === "no-show") lt.push(["escudo", "No llegó" + (autoPlanton && autoPlanton.activa ? " · se activó el anti-plantón" : ""), ""]);
      if (c.estado === "cancelada") lt.push(["x", "Cancelada", ""]);
      out += '<div><p class="seccion-k">Historia de esta cita</p><div class="linea-tiempo">' + lt.map(function (x) {
        return '<div class="lt-item"><i>' + ico(x[0]) + "</i><div>" + esc(x[1]) + (x[2] ? "<small>" + esc(x[2]) + "</small>" : "") + "</div></div>";
      }).join("") + "</div></div></div>";
      var acc = "";
      if (c.estado === "confirmada" || c.estado === "pendiente") {
        acc += '<button class="btn" data-accion="cita-llego" data-id="' + c.id + '">' + ico("tijeras") + "Llegó, a la silla</button>";
        if (yaEmpezo) acc += '<button class="btn btn--ghost" data-accion="cita-noshow" data-id="' + c.id + '">No llegó</button>';
        acc += '<button class="btn btn--ghost" data-accion="cita-cancelar" data-id="' + c.id + '">Cancelar cita</button>';
      } else if (c.estado === "en-silla") {
        acc += '<button class="btn" data-accion="cita-cobrar" data-id="' + c.id + '">' + ico("plata") + "Cobrar y cerrar</button>";
      } else {
        acc += '<button class="btn btn--suave" data-accion="cerrar">Cerrar</button>';
      }
      out += '<div class="cajon-pie">' + acc + "</div>";
      return out;
    }
    var h = html(); if (!h) return;
    APP.abrirCajon(h, { refrescar: html });
  }
  APP.abrirCita = abrirCita;

  function modalCobro(id) {
    var c = BS.cita(id); if (!c) return;
    var cli = BS.cliente(c.cliente), srv = BS.servicio(c.servicio);
    var medios = Object.keys(BS.MEDIOS).filter(function (k) { return BS.get().shop.medios[k]; });
    var estado = { medio: medios.indexOf("nequi") >= 0 ? "nequi" : medios[0], propina: 0 };
    var abono = c.anticipo && c.anticipo.pagado ? c.anticipo.monto : 0;
    function cuerpo() {
      var total = c.precio - abono + estado.propina;
      return "<h2>Cobrar a " + esc(U.primerNombre(cli.nombre)) + "</h2><p>" + esc(srv.nombre) + " · " + U.pesos(c.precio) + (abono ? " · ya pagó " + U.pesos(abono) + " de anticipo" : "") + "</p>" +
        '<div class="campo"><span class="campo-k">¿Cómo paga?</span><div class="chips">' + medios.map(function (m) {
          return '<button class="chip' + (estado.medio === m ? " is-on" : "") + '" data-accion="cobro-medio" data-m="' + m + '">' + BS.MEDIOS[m] + "</button>";
        }).join("") + "</div></div>" +
        '<div class="campo"><span class="campo-k">Propina para ' + esc(BS.barbero(c.barbero).nombre) + '</span><div class="chips">' + [0, 2000, 5000, 10000].map(function (p) {
          return '<button class="chip' + (estado.propina === p ? " is-on" : "") + '" data-accion="cobro-propina" data-p="' + p + '">' + (p ? U.pesos(p) : "Sin propina") + "</button>";
        }).join("") + "</div></div>" +
        '<div class="total-cobro"><span class="sub">Total a cobrar</span><b class="num">' + U.pesos(total) + "</b></div>" +
        '<div class="modal-acc"><button class="btn btn--ghost" data-accion="cerrar">Cancelar</button><button class="btn" data-accion="cobro-ok">' + ico("check") + "Cobrar " + U.pesos(total) + "</button></div>";
    }
    APP.abrirModal(cuerpo(), {
      cobro: { estado: estado, id: id, repintar: function () { capa.firstChild.innerHTML = cuerpo(); } }
    });
  }
  APP.modalCobro = modalCobro;

  function modalCancelar(id) {
    var c = BS.cita(id); if (!c) return;
    var cli = BS.cliente(c.cliente);
    var a = BS.autoPorClave("espera");
    var futuro = new Date(c.inicio) > new Date(Date.now() + 20 * 60000);
    APP.abrirModal("<h2>¿Cancelar la cita de " + esc(U.primerNombre(cli.nombre)) + "?</h2><p>" + esc(U.fechaCorta(c.inicio)) + ", " + U.hora(c.inicio) + " · el turno queda libre.</p>" +
      (a && a.activa && futuro ? '<div class="aviso-auto">' + ico("rayo") + "<div>Se va a activar <b>«" + esc(a.nombre) + "»</b>: le ofrecemos el turno a 3 clientes de la lista de espera. Mirá lo que pasa en las notificaciones.</div></div>" : "") +
      '<div class="modal-acc"><button class="btn btn--ghost" data-accion="cerrar">No, dejarla</button><button class="btn" data-accion="cancelar-ok" data-id="' + id + '">Sí, cancelar</button></div>');
  }

  /* ==========================================================================
     CAJÓN: NUEVA CITA
     ========================================================================== */
  function abrirNuevaCita(pre) {
    pre = pre || {};
    var st = BS.get();
    var nc = {
      cliente: pre.cliente || null, nombre: "", tel: "", busca: "", servicio: pre.servicio || "s1",
      barbero: pre.barbero || "cualquiera", dia: pre.dia ? new Date(pre.dia) : U.hoy0(), min: pre.min != null ? pre.min : null, anticipo: false
    };
    if (!BS.horario(nc.dia)) nc.dia = U.addDias(nc.dia, 1);
    function slots() { return BS.slotsLibres(nc.dia, nc.servicio, nc.barbero); }
    function cuerpo() {
      var cli = nc.cliente ? BS.cliente(nc.cliente) : null;
      var lista = slots();
      if (nc.min != null && !lista.some(function (s) { return s.min === nc.min; })) {
        var cerca = lista.filter(function (s) { return s.min >= nc.min; })[0];
        nc.min = cerca ? cerca.min : null;
      }
      var out = cabCajon("Nueva cita", "Agendala en segundos. Si pedís anticipo, le llega el link por WhatsApp.");
      out += '<div class="cajon-cuerpo"><div class="campo"><span class="campo-k">Cliente</span>';
      if (cli) {
        out += '<div class="silla">' + avatar(cli.nombre) + '<div class="silla-txt"><b>' + esc(cli.nombre) + "</b><small>" + esc(U.telefonoBonito(cli.tel)) + " · " + cli.visitas + " visitas</small></div>" +
          '<button class="btn btn--suave btn--sm" data-accion="nc-cambiar-cliente">Cambiar</button></div>';
      } else if (nc.nombre) {
        out += '<div class="form-fila"><input class="input" data-nc="nombre" value="' + esc(nc.nombre) + '" aria-label="Nombre del cliente nuevo" placeholder="Nombre">' +
          '<input class="input" data-nc="tel" value="' + esc(nc.tel) + '" inputmode="tel" aria-label="Celular" placeholder="Celular (WhatsApp)"></div>' +
          '<button class="link" data-accion="nc-cambiar-cliente">Buscar un cliente existente</button>';
      } else {
        out += '<div class="buscar" style="max-width:none">' + ico("buscar") + '<input class="input" data-nc="busca" placeholder="Buscá por nombre o celular" autocomplete="off" autofocus aria-label="Buscar cliente"><div class="sugerencias" data-nc-sug hidden></div></div>';
      }
      out += "</div>";
      out += '<div class="campo"><span class="campo-k">Servicio</span><div class="chips">' + st.servicios.map(function (s) {
        return '<button class="chip' + (nc.servicio === s.id ? " is-on" : "") + '" data-accion="nc-servicio" data-id="' + s.id + '">' + esc(s.nombre) + " · " + U.pesosCorto(s.precio) + "</button>";
      }).join("") + "</div></div>";
      out += '<div class="campo"><span class="campo-k">Barbero</span><div class="chips"><button class="chip' + (nc.barbero === "cualquiera" ? " is-on" : "") + '" data-accion="nc-barbero" data-id="cualquiera">El que esté libre</button>' +
        st.barberos.map(function (b) { return '<button class="chip' + (nc.barbero === b.id ? " is-on" : "") + '" data-accion="nc-barbero" data-id="' + b.id + '">' + esc(b.nombre) + "</button>"; }).join("") + "</div></div>";
      out += '<div class="campo"><span class="campo-k">Día</span><div class="chips">';
      for (var i = 0; i < 7; i++) {
        var d = U.addDias(U.hoy0(), i);
        if (!BS.horario(d)) continue;
        var et = i === 0 ? "Hoy" : i === 1 ? "Mañana" : U.fechaCorta(d);
        out += '<button class="chip' + (U.mismoDia(d, nc.dia) ? " is-on" : "") + '" data-accion="nc-dia" data-i="' + i + '">' + et + "</button>";
      }
      out += "</div></div>";
      out += '<div class="campo"><span class="campo-k">Hora' + (lista.length ? " · " + lista.length + " turnos libres" : "") + "</span>" +
        (lista.length ? '<div class="slots">' + lista.map(function (s) {
          return '<button class="slot' + (nc.min === s.min ? " is-on" : "") + '" data-accion="nc-slot" data-min="' + s.min + '">' + U.horaMin(s.min).replace(" a. m.", " am").replace(" p. m.", " pm").replace(" m.", " m") + "</button>";
        }).join("") + "</div>" : '<div class="vacio"><b>No hay turnos libres</b>Probá otro día u otro barbero.</div>') + "</div>";
      out += '<div class="interruptor-fila"><span><b>Pedir anticipo por WhatsApp</b><small>Le llega el link de ' + U.pesos(BS.montoAnticipo(BS.servicio(nc.servicio).precio)) + '. La cita queda «falta anticipo» hasta que pague.</small></span>' +
        '<label class="switch"><input type="checkbox" data-nc="anticipo"' + (nc.anticipo ? " checked" : "") + ' aria-label="Pedir anticipo"><span></span></label></div>';
      out += "</div>";
      var listo = (nc.cliente || nc.nombre.trim()) && nc.min != null;
      out += '<div class="cajon-pie"><button class="btn btn--ghost" data-accion="cerrar">Cancelar</button><button class="btn' + (listo ? "" : " is-disabled") + '" data-accion="nc-ok">' + ico("check") + "Agendar cita</button></div>";
      return out;
    }
    APP.abrirCajon(cuerpo(), { nc: nc, repintar: function () { capa.firstChild.innerHTML = cuerpo(); }, slots: slots });
  }
  APP.abrirNuevaCita = abrirNuevaCita;

  function sugerirClientes(texto) {
    var cont = $("[data-nc-sug]", capa); if (!cont) return;
    var t = U.normalizar(texto);
    if (!t) { cont.hidden = true; cont.innerHTML = ""; return; }
    var lista = BS.get().clientes.filter(function (c) { return U.normalizar(c.nombre).indexOf(t) >= 0 || c.tel.indexOf(t.replace(/\D/g, "") || "~") >= 0; }).slice(0, 6);
    cont.innerHTML = lista.map(function (c) {
      return '<button type="button" data-accion="nc-cliente" data-id="' + c.id + '">' + avatar(c.nombre, "avatar--sm") + esc(c.nombre) + "<small>" + esc(U.telefonoBonito(c.tel)) + "</small></button>";
    }).join("") + '<button type="button" data-accion="nc-cliente-nuevo">' + ico("mas") + "Crear «" + esc(texto.trim()) + "» como cliente nuevo</button>";
    cont.hidden = false;
  }

  /* ==========================================================================
     VISTA: FILA VIRTUAL
     ========================================================================== */
  function qrSVG(texto) {
    var n = 25, s = 0;
    for (var i = 0; i < texto.length; i++) s = (s * 31 + texto.charCodeAt(i)) >>> 0;
    function r() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    var celdas = "";
    function finder(x, y) {
      return '<rect x="' + x + '" y="' + y + '" width="7" height="7"/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" fill="#f5f1ea"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3"/>';
    }
    function enFinder(x, y) { return (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9); }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (enFinder(x, y)) continue;
      if (r() < 0.47) celdas += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 25 25" fill="#141212" shape-rendering="crispEdges" role="img" aria-label="Código QR de ejemplo para la fila virtual">' + celdas + finder(0, 0) + finder(n - 7, 0) + finder(0, n - 7) + "</svg>";
  }
  APP.qrSVG = qrSVG;
  APP.descargarAfiche = function (op) { descargarAfiche(op); };
  // QR de verdad (librería qrcode-generator de cdnjs). Si no cargó, devuelve null y se usa el de ejemplo.
  function qrReal(texto) {
    if (typeof window.qrcode !== "function") return null;
    try {
      var qr = window.qrcode(0, "M"); qr.addData(texto); qr.make();
      var n = qr.getModuleCount(), m = 2, t = n + m * 2, d = "";
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (qr.isDark(y, x)) d += "M" + (x + m) + " " + (y + m) + "h1v1h-1z";
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" shape-rendering="crispEdges" role="img" aria-label="Código QR de la fila virtual">' +
        '<rect width="' + t + '" height="' + t + '" fill="#f5f1ea"/><path fill="#141212" d="' + d + '"/></svg>';
    } catch (e) { return null; }
  }
  // Afiche listo para imprimir: título, QR, nombre de la barbería y el link escrito
  function descargarAfiche(op) {
    op = Object.assign({ link: BS.linkFila(), kicker: "FILA VIRTUAL · SIN CITA", linea1: "Escaneá y esperá", linea2: "desde donde estés",
      pie: "Te avisamos por WhatsApp cuando se acerque tu turno", archivo: "qr-fila-" + BS.get().shop.slug + ".png" }, op || {});
    var link = op.link, svg = qrReal(link), shop = BS.get().shop;
    if (!svg) { toast({ tipo: "x", titulo: "QR", texto: "No pudimos generar el QR. Revisá tu internet y recargá la página." }); return; }
    var url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })), img = new Image();
    var fuentes = document.fonts && document.fonts.load ? Promise.all(['800 84px "Bricolage Grotesque"', '500 34px "Inter"', '500 28px "JetBrains Mono"'].map(function (f) { return document.fonts.load(f); })) : Promise.resolve();
    img.onload = function () {
      fuentes.catch(function () {}).then(function () {
        var W = 1200, H = 1650, c = document.createElement("canvas"); c.width = W; c.height = H;
        var g = c.getContext("2d");
        g.fillStyle = "#f5f1ea"; g.fillRect(0, 0, W, H);
        g.fillStyle = "#ff4b2b"; g.fillRect(0, 0, W, 26);
        g.textAlign = "center"; g.fillStyle = "#c2381c"; g.font = '600 30px "JetBrains Mono", monospace';
        g.fillText(op.kicker, W / 2, 140);
        g.fillStyle = "#141212"; g.font = '800 88px "Bricolage Grotesque", sans-serif';
        g.fillText(op.linea1, W / 2, 255); g.fillText(op.linea2, W / 2, 350);
        g.imageSmoothingEnabled = false; g.drawImage(img, 220, 420, 760, 760);
        g.font = '800 58px "Bricolage Grotesque", sans-serif'; g.fillText(shop.nombre, W / 2, 1300);
        g.fillStyle = "#4a4545"; g.font = '500 34px "Inter", sans-serif';
        g.fillText(op.pie, W / 2, 1370);
        g.font = '500 26px "JetBrains Mono", monospace'; g.fillText(link.replace(/^https?:\/\//, ""), W / 2, 1530);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = op.archivo;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        }, "image/png");
      });
    };
    img.src = url;
  }

  var ESTADO_FILA = { casa: ["Esperando en la casa", "neutro"], camino: ["En camino", "info"], local: ["En el local", "ok"] };
  APP.vistas.fila = {
    titulo: "Fila virtual",
    sub: function () { return "Los que llegan sin cita esperan desde la casa · " + BS.linkFila().replace(/^https?:\/\//, ""); },
    html: function () {
      var st = BS.get(), fila = BS.filaOrdenada(), abierto = BS.abiertoAhora();
      var libres = st.barberos.filter(function (b) {
        return !BS.citasDelDia(new Date(), b.id).some(function (c) { return c.estado === "en-silla"; });
      });
      var atendidos = BS.citasDelDia(new Date()).filter(function (c) { return c.fuente === "fila"; }).length;
      var html = '<div class="fila-resumen">' +
        '<div class="card"><b>' + fila.length + "</b><small>personas en la fila</small></div>" +
        '<div class="card"><b>' + (fila.length ? "~" + BS.esperaFila(fila.length) + " min" : "—") + "</b><small>espera para el último</small></div>" +
        '<div class="card"><b>' + libres.length + " de " + st.barberos.length + "</b><small>barberos libres ahora</small></div>" +
        '<div class="card"><b>' + atendidos + "</b><small>atendidos hoy desde la fila</small></div></div>";
      html += '<div class="fila-grid"><section class="card"><div class="card-cab"><div><h2>Turnos</h2><p>Cuando le faltan 2 turnos, le llega un WhatsApp para que salga.</p></div>' +
        (fila.length && libres.length ? '<button class="btn btn--sm" data-accion="fila-silla" data-id="' + fila[0].id + '" data-barbero="' + libres[0].id + '">' + ico("tijeras") + "Llamar al siguiente</button>" : "") + "</div>";
      if (fila.length && !libres.length) {
        var pronto = st.barberos.map(function (b) { return BS.citasDelDia(new Date(), b.id).filter(function (c) { return c.estado === "en-silla"; })[0]; })
          .filter(Boolean).sort(function (a, b) { return BS.finCita(a) - BS.finCita(b); })[0];
        html += '<div class="aviso-auto" style="margin-bottom:12px;background:#1a1818;box-shadow:inset 0 0 0 1px var(--linea)">' + ico("reloj") + "<div>Todos los barberos están cortando." + (pronto ? " El primero en quedar libre es <b>" + esc(BS.barbero(pronto.barbero).nombre) + "</b> a las " + U.hora(BS.finCita(pronto)) + "." : "") + " Ahí llamás al siguiente.</div></div>";
      }
      if (!fila.length) {
        html += '<div class="vacio"><b>Nadie en la fila</b>' + (abierto ? "Cuando alguien escanee tu QR o escriba «fila» al WhatsApp, aparece aquí." : "La fila abre con la barbería.") + "</div>";
      } else {
        fila.forEach(function (f, i) {
          var srv = BS.servicio(f.servicio) || { nombre: "Corte" };
          var e = ESTADO_FILA[f.estado] || ESTADO_FILA.casa;
          html += '<div class="turno"><span class="turno-n">' + (i + 1) + '</span><div class="turno-txt"><b>' + esc(f.nombre) + "</b><small>" + esc(srv.nombre) + " · por " + (f.via === "qr" ? "QR" : f.via === "web" ? "link" : "WhatsApp") + " · " + U.hace(f.entro) +
            ' <span class="estado estado--' + e[1] + '">' + e[0] + "</span>" + (f.avisado ? ' <span class="estado estado--ok">' + ico("check") + "Avisado</span>" : "") + "</small></div>" +
            '<div class="turno-acc"><button class="btn btn--suave btn--sm" data-accion="fila-silla" data-id="' + f.id + '"' + (libres[0] ? ' data-barbero="' + libres[0].id + '"' : " disabled title=\"Todos los barberos están ocupados\"") + ">A la silla</button>" +
            '<button class="btn-ico" data-accion="fila-quitar" data-id="' + f.id + '" aria-label="Quitar de la fila">' + ico("x") + "</button></div></div>";
        });
      }
      html += "</section>";
      var qrDeVerdad = enServidor() ? qrReal(BS.linkFila()) : null;
      var notaQR = function (t) { return '<p class="nota-ejemplo" style="font-family:var(--f-mono);font-size:11px;color:var(--humo-2)">' + t + "</p>"; };
      html += '<div class="hoy-col"><section class="card qr-card"><div class="card-cab" style="width:100%;margin:0"><div style="text-align:left"><h2>Tu QR de la puerta</h2><p>Imprimilo y pegalo en la entrada</p></div></div>' +
        '<div class="qr">' + (qrDeVerdad || qrSVG(st.shop.slug)) + '</div><span class="qr-link">' + esc(BS.linkFila().replace(/^https?:\/\//, "")) + "</span>" +
        '<div class="chips" style="justify-content:center"><a class="btn btn--suave btn--sm" href="' + (enServidor() ? esc(BS.linkFila()) : reservaDemo("modo=fila")) + '" target="_blank" rel="noopener">' + ico("externo") + "Abrir como cliente</a>" +
        (qrDeVerdad ? '<button class="btn btn--sm" data-accion="qr-descargar">' + ico("descargar") + "Descargar afiche</button></div>"
          : enServidor() ? "</div>" + notaQR("No pudimos generar el QR. Revisá tu internet y recargá.")
          : '<button class="btn btn--sm" data-accion="fila-simular">' + ico("qr") + "Simular un escaneo</button></div>" + notaQR("QR de ejemplo")) + "</section>";
      html += '<section class="card"><div class="card-cab"><h2>Sillas</h2></div><div class="sillas">' + st.barberos.map(function (b) {
        var actual = BS.citasDelDia(new Date(), b.id).filter(function (c) { return c.estado === "en-silla"; })[0];
        return '<div class="silla' + (actual ? "" : " silla--libre") + '">' + avatar(b.nombre, "avatar--sm") + '<div class="silla-txt"><b>' + esc(b.nombre) + "</b><small>" +
          (actual ? "Termina " + U.hora(BS.finCita(actual)) : "Libre") + "</small></div>" + (actual ? '<span class="estado estado--neon">' + ico("tijeras") + "Ocupado</span>" : '<span class="estado estado--ok">Libre</span>') + "</div>";
      }).join("") + "</div></section></div></div>";
      return html;
    }
  };

  /* ==========================================================================
     VISTA: AUTOMATIZACIONES
     ========================================================================== */
  APP.vistas.automatizaciones = {
    titulo: "Automatizaciones",
    sub: function () { return "Recetas que trabajan solas · cada una dice cuánta plata recuperó"; },
    html: function () {
      var st = BS.get();
      var enviados = st.autos.reduce(function (s, a) { return s + a.stats.enviados; }, 0);
      var activas = st.autos.filter(function (a) { return a.activa; });
      var lista = st.autos.filter(function (a) { return ui.autosFiltro === "todas" ? true : ui.autosFiltro === "prendidas" ? a.activa : !a.activa; });
      var html = '<div class="auto-cab"><div class="card kpi kpi--hero"><span class="kpi-k">' + ico("rayo") + "Plata recuperada esta semana</span><b class=\"kpi-v\">" + U.pesos(BS.plataRecuperada()) + "</b>" +
        '<span class="kpi-d">' + enviados.toLocaleString("es-CO") + " mensajes enviados · " + activas.length + " de " + st.autos.length + " prendidas</span></div>" +
        '<div class="card auto-cab-txt"><h2 class="titulo-sec">Creemos una <span style="color:var(--neon)">nueva</span>.</h2><p>Elegí cuándo se activa, para quién y qué mensaje manda. Las variables como {nombre} o {hora} se llenan solas.</p>' +
        '<button class="btn" data-accion="auto-nueva">' + ico("mas") + "Crear automatización</button></div></div>";
      html += '<div class="herramientas"><div class="chips" role="group" aria-label="Filtrar">' + [["todas", "Todas", st.autos.length], ["prendidas", "Prendidas", activas.length], ["apagadas", "Apagadas", st.autos.length - activas.length]].map(function (f) {
        return '<button class="chip' + (ui.autosFiltro === f[0] ? " is-on" : "") + '" data-accion="auto-filtro" data-f="' + f[0] + '">' + f[1] + '<span class="badge">' + f[2] + "</span></button>";
      }).join("") + "</div></div>";
      html += '<div class="autos">' + lista.map(function (a) {
        var d = BS.DISPARADORES[a.disparador] || { txt: a.disparador, ico: "rayo" };
        var tiempo = BS.esDeTiempo(a);
        return '<article class="card auto-card ' + (a.activa ? "is-on" : "is-off") + '">' +
          '<div class="auto-card-cab"><span class="auto-ico">' + ico(a.ico) + '</span><label class="switch" title="' + (a.activa ? "Apagar" : "Prender") + '"><input type="checkbox" data-accion="auto-toggle" data-id="' + a.id + '"' + (a.activa ? " checked" : "") + ' aria-label="' + (a.activa ? "Apagar " : "Prender ") + esc(a.nombre) + '"><span></span></label></div>' +
          "<div><h3>" + esc(a.nombre) + "</h3><p>" + esc(a.desc || "") + "</p></div>" +
          '<span class="auto-cuando">' + ico(d.ico) + "Cuando: " + esc(d.txt) + "</span>" +
          '<div class="auto-stats"><div><b>' + a.stats.enviados + "</b><small>enviados</small></div><div><b>" + a.stats.resultados + "</b><small>" + esc(a.stats.txt || "resultados") + "</small></div><div><b>" + (a.stats.plata ? U.pesosCorto(a.stats.plata) : "—") + "</b><small>recuperado</small></div></div>" +
          '<div class="auto-acc"><button class="btn btn--suave btn--sm" data-accion="auto-editar" data-id="' + a.id + '">' + ico("editar") + "Editar</button>" +
          (tiempo ? '<button class="btn btn--sm" data-accion="auto-ejecutar" data-id="' + a.id + '"' + (a.activa ? "" : " disabled") + ">" + ico("play") + "Ejecutar ahora</button>" : "") + "</div>" +
          (!tiempo && d.como ? '<p class="auto-pista">' + esc(d.como) + "</p>" : "") + "</article>";
      }).join("") + "</div>";
      return html;
    }
  };

  /* ---- Editor de automatizaciones ---- */
  function abrirEditor(id) {
    var base = id ? BS.auto(id) : null;
    var ed = base ? U.clonar(base) : {
      id: U.uid("a"), clave: "custom-" + Date.now().toString(36), nombre: "", ico: "rayo", disparador: "cita.terminada", espera: 30, publico: "todos",
      desc: "", plantilla: "¡Gracias por venir, {nombre}! 💈 ¿Te guardo turno con {barbero} para dentro de 3 semanas? {link}",
      activa: true, custom: true, stats: { enviados: 0, resultados: 0, plata: 0, txt: "respuestas" }
    };
    var sistema = !!(base && !base.custom);
    function preview() { return BS.render(ed.plantilla, BS.varsEjemplo()); }
    function cuerpo() {
      var d = BS.DISPARADORES[ed.disparador] || {};
      var out = cabCajon(base ? "Editar automatización" : "Nueva automatización", base ? esc(ed.nombre) : "Armala como una receta: cuándo, para quién y qué mensaje.");
      out += '<div class="cajon-cuerpo"><div class="campo"><label for="ed-nombre">Nombre</label><input class="input" id="ed-nombre" data-ed="nombre" value="' + esc(ed.nombre) + '" placeholder="Ej.: Volvé en 3 semanas"' + (base ? "" : " autofocus") + "></div>";
      out += '<div class="receta-vis">';
      out += '<div class="rv-paso"><span class="rv-k">' + ico(d.ico || "rayo") + "Cuando</span>" +
        '<select class="input" data-ed="disparador"' + (sistema ? " disabled" : "") + ' aria-label="Cuándo se activa">' + Object.keys(BS.DISPARADORES).map(function (k) {
          return '<option value="' + k + '"' + (k === ed.disparador ? " selected" : "") + ">" + esc(BS.DISPARADORES[k].txt) + "</option>";
        }).join("") + "</select>" +
        (d.unidad ? '<div class="form-fila"><input class="input" type="number" min="0" data-ed="espera" value="' + Math.abs(ed.espera || 0) + '" aria-label="' + esc(d.unidad) + '"><span class="sub" style="align-self:center">' + esc(d.unidad) + "</span></div>" : "") +
        (sistema ? '<span class="campo-ayuda">Esta receta viene con Barber SaaS: podés cambiar el mensaje y el público.</span>' : "") + "</div>";
      out += '<div class="rv-paso"><span class="rv-k">' + ico("usuario") + 'Para quién</span><select class="input" data-ed="publico" aria-label="Para quién">' + Object.keys(BS.PUBLICOS).map(function (k) {
        return '<option value="' + k + '"' + (k === (ed.publico || "todos") ? " selected" : "") + ">" + esc(BS.PUBLICOS[k]) + "</option>";
      }).join("") + "</select></div>";
      out += '<div class="rv-paso"><span class="rv-k">' + ico("chat") + 'Entonces: mandar este WhatsApp</span>' +
        '<textarea class="input" data-ed="plantilla" rows="4" aria-label="Mensaje">' + esc(ed.plantilla) + "</textarea>" +
        '<div class="vars" aria-label="Variables">' + BS.VARIABLES.map(function (v) { return '<button type="button" class="var" data-accion="ed-var" data-v="' + v[0] + '" title="' + esc(v[1]) + '">{' + v[0] + "}</button>"; }).join("") + "</div></div>";
      out += "</div>";
      out += '<div><p class="seccion-k">Así le llega al cliente</p><div class="vista-previa"><div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + 'Automático</span><span data-ed-preview>' + esc(preview()) + '</span><span class="msg-meta">' + U.hora(new Date()) + "</span></div></div></div>";
      out += "</div>";
      out += '<div class="cajon-pie">' + (base && base.custom ? '<button class="btn btn--ghost" data-accion="ed-eliminar">' + ico("basura") + "Eliminar</button>" : "") +
        '<button class="btn btn--suave" data-accion="ed-probar">' + ico("enviar") + "Enviarme una prueba</button>" +
        '<button class="btn" data-accion="ed-guardar">' + ico("check") + (base ? "Guardar" : "Crear y prender") + "</button></div>";
      return out;
    }
    APP.abrirCajon(cuerpo(), { ed: ed, base: base, preview: preview, repintar: function () { capa.firstChild.innerHTML = cuerpo(); } });
  }
  APP.abrirEditor = abrirEditor;

  /* ==========================================================================
     VISTA: CLIENTES
     ========================================================================== */
  function cicloCelda(cli) {
    var e = BS.estadoCiclo(cli);
    if (e.estado === "agendado") return '<div class="ciclo-txt"><span><b>Agendado</b> · ' + esc(U.fechaCorta(e.proxima.inicio)) + " " + U.hora(e.proxima.inicio) + '</span></div><div class="ciclo-barra"><span style="width:100%;background:var(--ok)"></span></div>';
    if (e.estado === "dormido") return '<div class="ciclo-txt"><span><b>Dormido</b> · ' + e.dias + ' días sin venir</span></div><div class="ciclo-barra"><span style="width:100%;background:var(--error)"></span></div>';
    if (e.estado === "toca") return '<div class="ciclo-txt"><span><b>Le toca corte</b></span><span>' + e.dias + " de " + e.ciclo + ' días</span></div><div class="ciclo-barra"><span class="poste" style="width:' + Math.min(100, e.pct * 100).toFixed(0) + '%"></span></div>';
    return '<div class="ciclo-txt"><span>Al día</span><span>' + e.dias + " de " + e.ciclo + ' días</span></div><div class="ciclo-barra"><span style="width:' + Math.min(100, e.pct * 100).toFixed(0) + '%"></span></div>';
  }
  function etiquetasHTML(cli) {
    var out = cli.etiquetas.map(function (t) { return '<span class="etq' + (t === "VIP" ? " etq--vip" : t === "Nuevo" ? " etq--nuevo" : "") + '">' + esc(t) + "</span>"; });
    if (BS.esCumpleProximo(cli, 7) >= 0) out.push('<span class="etq etq--vip">🎂 Cumpleaños</span>');
    if (cli.sinPromos) out.push('<span class="etq">Sin promociones</span>');
    return out.join("");
  }
  // El cliente de prueba del simulador del asistente no es un cliente de verdad
  function clientesReales() { return BS.get().clientes.filter(function (c) { return !c.prueba && c.etiquetas.indexOf("Prueba") < 0; }); }
  APP.vistas.clientes = {
    titulo: "Clientes",
    sub: function () { return clientesReales().length + " clientes · el ciclo de corte se aprende solo"; },
    html: function () {
      var st = BS.get();
      var todos = clientesReales();
      var grupos = {
        todos: todos,
        toca: todos.filter(function (c) { return BS.estadoCiclo(c).estado === "toca"; }),
        dormidos: todos.filter(function (c) { return BS.estadoCiclo(c).estado === "dormido"; }),
        vip: todos.filter(function (c) { return c.etiquetas.indexOf("VIP") >= 0; }),
        nuevos: todos.filter(function (c) { return c.visitas <= 2; }),
        cumple: todos.filter(function (c) { return BS.esCumpleProximo(c, 7) >= 0; })
      };
      var nombres = { todos: "Todos", toca: "Les toca corte", dormidos: "Dormidos", vip: "VIP", nuevos: "Nuevos", cumple: "Cumpleaños" };
      var lista = grupos[ui.clientesFiltro] || todos;
      var q = U.normalizar(ui.clientesBusqueda);
      if (q) lista = lista.filter(function (c) { return U.normalizar(c.nombre).indexOf(q) >= 0 || c.tel.indexOf(q) >= 0; });
      var RANGO = { toca: 0, dormido: 1, "al-dia": 2, agendado: 3 };
      lista = lista.map(function (c) { return { c: c, e: BS.estadoCiclo(c) }; })
        .sort(function (a, b) { return (RANGO[a.e.estado] - RANGO[b.e.estado]) || (a.e.faltan - b.e.faltan); })
        .map(function (x) { return x.c; });
      var html = '<div class="herramientas"><div class="buscar">' + ico("buscar") + '<input class="input" type="search" data-accion="clientes-buscar" value="' + esc(ui.clientesBusqueda) + '" placeholder="Buscar por nombre o celular" aria-label="Buscar clientes"></div>' +
        '<div class="chips">' + Object.keys(nombres).map(function (k) {
          return '<button class="chip' + (ui.clientesFiltro === k ? " is-on" : "") + '" data-accion="clientes-filtro" data-f="' + k + '">' + nombres[k] + '<span class="badge">' + grupos[k].length + "</span></button>";
        }).join("") + "</div></div>";
      if (ui.clientesFiltro === "toca" && grupos.toca.length) {
        var ciclo = BS.autoPorClave("ciclo");
        html += '<div class="aviso-auto" style="margin-bottom:14px">' + ico("ciclo") + "<div>A estos " + grupos.toca.length + " ya les toca corte. <b>«" + esc(ciclo.nombre) + "»</b> les escribe con horarios de su barbero de siempre." +
          (ciclo.activa ? ' <button class="link" data-accion="auto-ejecutar" data-id="' + ciclo.id + '">Escribirles ahora' + ico("flecha") + "</button>" : "") + "</div></div>";
      }
      html += '<section class="card" style="padding:8px 8px 4px"><table class="tabla tabla-clientes"><thead><tr><th scope="col">Cliente</th><th scope="col">Ciclo de corte</th><th scope="col" class="oc-movil">Última visita</th><th scope="col" class="num oc-movil">Visitas</th><th scope="col" class="num">Gastado</th><th scope="col" class="oc-movil">Barbero</th></tr></thead><tbody>';
      html += lista.map(function (c) {
        var b = BS.barbero(c.barbero);
        return '<tr data-accion="ver-cliente" data-id="' + c.id + '" tabindex="0"><td><div class="celda-cli">' + avatar(c.nombre) + "<span><b>" + esc(c.nombre) + '</b><small>' + esc(U.telefonoBonito(c.tel)) + '</small><span class="etiquetas">' + etiquetasHTML(c) + "</span></span></div></td>" +
          '<td class="ciclo">' + cicloCelda(c) + '</td><td class="oc-movil">' + U.hace(c.ultima) + '</td><td class="num oc-movil">' + c.visitas + '</td><td class="num">' + U.pesos(c.gasto) + '</td><td class="oc-movil">' + esc(b ? b.nombre : "—") + "</td></tr>";
      }).join("") + "</tbody></table>" + (lista.length ? "" : todos.length ? '<div class="vacio"><b>Sin resultados</b>Probá con otro nombre o filtro.</div>'
        : '<div class="vacio"><b>Todavía no tenés clientes</b>Aparecen solos cuando reservan por tu link, por WhatsApp o cuando agendás una cita a mano.</div>') + "</section>";
      return html;
    }
  };

  function abrirCliente(id) {
    function html() {
      var c = BS.cliente(id); if (!c) return null;
      var e = BS.estadoCiclo(c), b = BS.barbero(c.barbero);
      var historia = BS.get().citas.filter(function (x) { return x.cliente === c.id; }).sort(function (a, z) { return new Date(z.inicio) - new Date(a.inicio); }).slice(0, 6);
      var out = cabCajon(esc(c.nombre), esc(U.telefonoBonito(c.tel)) + " · cliente desde " + esc(U.MESES[new Date(c.desde).getMonth()]) + " de " + new Date(c.desde).getFullYear(), '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">' + avatar(c.nombre, "avatar--lg") + '<span class="etiquetas">' + etiquetasHTML(c) + "</span></div>");
      out += '<div class="cajon-cuerpo"><div class="datos">' +
        '<div class="dato"><small>Visitas</small><b>' + c.visitas + "</b></div>" +
        '<div class="dato"><small>Ha gastado</small><b>' + U.pesos(c.gasto) + "</b></div>" +
        '<div class="dato"><small>Se motila cada</small><b>' + c.ciclo + " días</b></div>" +
        '<div class="dato"><small>Barbero de siempre</small><b>' + esc(b ? b.nombre : "—") + "</b></div></div>";
      out += '<div><p class="seccion-k">Ciclo de corte</p>' + cicloCelda(c) + "</div>";
      out += '<div class="interruptor-fila"><span><b>Recibe promociones por WhatsApp</b><small>' + (c.sinPromos ? "Sin promociones desde el " + esc(U.fechaCorta(c.sinPromos)) + ". Igual le llegan la confirmación y el recordatorio de sus citas." : "Ciclo de corte, turnos libres, cumpleaños. Si escribe «BAJA», se apaga solo.") + "</small></span>" +
        '<label class="switch"><input type="checkbox" data-accion="cliente-promos" data-id="' + c.id + '"' + (c.sinPromos ? "" : " checked") + ' aria-label="Recibe promociones por WhatsApp"><span></span></label></div>';
      out += '<div class="campo"><label for="ficha-' + c.id + '" class="seccion-k" style="margin:0">Ficha de corte</label><textarea class="input" id="ficha-' + c.id + '" data-ficha="' + c.id + '" rows="3" placeholder="Ej.: Fade medio, #1 a los lados, tijera arriba">' + esc(c.ficha) + '</textarea><span class="campo-ayuda">Cualquier barbero lo puede dejar igual. Se guarda solo.</span></div>';
      out += '<div><p class="seccion-k">Últimas citas</p><div class="lista-citas">' + (historia.length ? historia.map(function (x) {
        var s = BS.servicio(x.servicio);
        return '<div class="fila-cita" data-accion="ver-cita" data-id="' + x.id + '" role="button" tabindex="0"><span class="fila-cita-hora">' + esc(U.fechaCorta(x.inicio).split(" ").slice(0, 2).join(" ")) + "<small>" + U.horaCorta(U.minDelDia(x.inicio)) + '</small></span><span class="fila-cita-txt"><b>' + esc(s.nombre) + "</b><small>con " + esc(BS.barbero(x.barbero).nombre) + " · " + U.pesos(x.precio) + "</small></span>" + estadoChip(x.estado) + "</div>";
      }).join("") : '<div class="vacio">Sin citas registradas.</div>') + "</div></div></div>";
      out += '<div class="cajon-pie"><button class="btn btn--suave" data-accion="cliente-whatsapp" data-id="' + c.id + '">' + ico("chat") + "Escribirle</button><button class=\"btn\" data-accion=\"cliente-agendar\" data-id=\"" + c.id + '">' + ico("cal") + "Agendar cita</button></div>";
      return out;
    }
    var h = html(); if (!h) return;
    APP.abrirCajon(h, { refrescar: html });
  }
  APP.abrirCliente = abrirCliente;

  /* ==========================================================================
     VISTA: CAJA Y PAGOS
     ========================================================================== */
  APP.vistas.caja = {
    titulo: "Caja y pagos",
    sub: function () { return "Cada peso unido a su cita · liquidación de barberos con un toque"; },
    html: function () {
      var hoy = U.hoy0(), semana = BS.inicioSemana(hoy);
      var desde = ui.cajaPeriodo === "hoy" ? hoy : semana, hasta = ui.cajaPeriodo === "hoy" ? U.addDias(hoy, 1) : U.addDias(semana, 7);
      var movs = BS.movimientos(desde, hasta);
      var entradas = movs.filter(function (m) { return m.tipo !== "liquidacion"; });
      var total = entradas.reduce(function (s, m) { return s + m.monto; }, 0);
      var anticipos = entradas.filter(function (m) { return m.tipo === "anticipo"; }).reduce(function (s, m) { return s + m.monto; }, 0);
      var propinas = entradas.filter(function (m) { return m.tipo === "propina"; }).reduce(function (s, m) { return s + m.monto; }, 0);
      var liq = BS.liquidacion(semana, U.addDias(semana, 7)).filter(function (l) { return l.barbero.modo !== "dueno"; });
      var porPagar = liq.reduce(function (s, l) { return s + l.pendiente; }, 0);
      var periodoTxt = ui.cajaPeriodo === "hoy" ? "hoy" : "esta semana";

      var html = '<div class="herramientas"><div class="chips" role="group" aria-label="Periodo">' +
        '<button class="chip' + (ui.cajaPeriodo === "hoy" ? " is-on" : "") + '" data-accion="caja-periodo" data-p="hoy">Hoy</button>' +
        '<button class="chip' + (ui.cajaPeriodo === "semana" ? " is-on" : "") + '" data-accion="caja-periodo" data-p="semana">Esta semana</button></div></div>';
      html += '<section class="caja-kpis">' +
        '<div class="card kpi"><span class="kpi-k">' + ico("plata") + "Entró " + periodoTxt + '</span><b class="kpi-v">' + U.pesos(total) + '</b><span class="kpi-d">' + entradas.length + " movimientos</span></div>" +
        '<div class="card kpi"><span class="kpi-k">' + ico("cal") + 'Anticipos</span><b class="kpi-v">' + U.pesos(anticipos) + '</b><span class="kpi-d">Plata que llegó antes de la silla</span></div>' +
        '<div class="card kpi"><span class="kpi-k">' + ico("estrella") + 'Propinas</span><b class="kpi-v">' + U.pesos(propinas) + '</b><span class="kpi-d">Van directo a cada barbero</span></div>' +
        '<div class="card kpi"><span class="kpi-k">' + ico("usuario") + 'Por pagar a barberos</span><b class="kpi-v">' + U.pesos(porPagar) + '</b><span class="kpi-d">Liquidación de la semana</span></div></section>';

      var por = {};
      entradas.forEach(function (m) { por[m.medio] = (por[m.medio] || 0) + m.monto; });
      var medios = Object.keys(por).sort(function (a, b) { return por[b] - por[a]; });
      var maxM = medios.length ? por[medios[0]] : 1;
      var col1 = '<section class="card"><div class="card-cab"><div><h2>Por medio de pago</h2><p>Lo que entró ' + periodoTxt + "</p></div></div>" +
        (medios.length ? '<div class="medios-barras" role="list">' + medios.map(function (m) {
          return '<div class="medio-fila" role="listitem"><span class="medio-n">' + BS.MEDIOS[m] + '</span><span class="pista"><span style="width:' + Math.max(1, (por[m] / maxM) * 100).toFixed(1) + '%"></span></span><span class="monto">' + U.pesos(por[m]) + "</span></div>";
        }).join("") + "</div>" : '<div class="vacio">Todavía no entra plata ' + periodoTxt + ".</div>") + "</section>";
      col1 += '<section class="card" style="margin-top:14px;padding:8px 8px 4px"><div class="card-cab" style="padding:12px 12px 0"><div><h2>Movimientos</h2><p>Los últimos ' + Math.min(30, movs.length) + "</p></div></div>" +
        '<div style="overflow-x:auto"><table class="tabla"><thead><tr><th scope="col">Hora</th><th scope="col">Concepto</th><th scope="col">Medio</th><th scope="col" class="num">Monto</th></tr></thead><tbody>' +
        movs.slice(0, 30).map(function (m) {
          return "<tr style=\"cursor:default\"><td class=\"mono\" style=\"font-size:12.5px;white-space:nowrap\">" + (ui.cajaPeriodo === "hoy" ? U.horaCorta(U.minDelDia(m.t)) : esc(U.fechaCorta(m.t))) + "</td><td><b style=\"font-weight:600\">" + esc(m.concepto) + '</b><br><small class="sub">' + esc(m.detalle) + "</small></td><td>" + BS.MEDIOS[m.medio] + '</td><td class="num ' + (m.monto > 0 ? "mov-pos" : "") + '" style="font-weight:600">' + (m.monto > 0 ? "+" : "") + U.pesos(m.monto) + "</td></tr>";
        }).join("") + "</tbody></table></div>" + (movs.length ? "" : '<div class="vacio">Sin movimientos.</div>') + "</section>";

      var col2 = '<section class="card"><div class="card-cab"><div><h2>Liquidación de la semana</h2><p>Del ' + esc(U.fechaCorta(semana)) + " al " + esc(U.fechaCorta(U.addDias(semana, 6))) + '</p></div></div><div class="liq">' +
        liq.map(function (l) {
          var modo = l.barbero.modo === "porcentaje" ? Math.round(l.barbero.comision * 100) + " % de " + U.pesos(l.ventas) : "Alquiler de silla (" + U.pesos(l.barbero.alquiler) + "/sem)";
          return '<div class="liq-fila">' + avatar(l.barbero.nombre) + "<span><b>" + esc(l.barbero.nombre) + "</b><small>" + l.servicios + " servicios · " + modo + "</small><small>Propinas " + U.pesos(l.propinas) + "</small></span>" +
            '<span class="liq-total"><b class="num">' + U.pesos(l.pendiente) + "</b><small>" + (l.pagado ? "ya pagado " + U.pesos(l.pagado) : "por pagar") + "</small></span>" +
            (l.pendiente > 0 ? '<button class="btn btn--sm" data-accion="liq-pagar" data-id="' + l.barbero.id + '" data-monto="' + l.pendiente + '">' + ico("plata") + "Pagar por Bre-B</button>" : '<span class="estado estado--ok" style="grid-column:1/-1;justify-self:start">' + ico("check") + "Al día</span>") + "</div>";
        }).join("") + "</div>" +
        '<p class="auto-pista" style="margin-top:12px">El sábado a las 9 p. m. la automatización «Liquidación de barberos» le manda a cada uno su resumen por WhatsApp.</p></section>';
      return html + '<div class="caja-grid"><div>' + col1 + "</div><div>" + col2 + "</div></div>";
    }
  };

  /* ==========================================================================
     VISTA: AJUSTES
     ========================================================================== */
  var BARRIOS = APP.BARRIOS = ["Laureles", "El Poblado", "Belén", "Envigado", "Robledo", "Bello", "Itagüí", "Sabaneta", "Manrique", "Castilla", "La América", "Buenos Aires", "Aranjuez", "La Estrella", "Otro"];
  APP.vistas.ajustes = {
    titulo: "Ajustes",
    sub: function () { return "Tu barbería, tus servicios y cómo cobrás"; },
    html: function () {
      var st = BS.get(), s = st.shop;
      var html = '<div class="ajustes-grid"><section class="card"><div class="card-cab"><div><h2>Tu link de reservas</h2><p>Mandáselo a tus clientes: reservan solos y cae en tu agenda</p></div></div>' + APP.compartirHTML() + '</section><section class="card"><div class="card-cab"><h2>Tu barbería</h2></div><div class="form" data-form-shop>' +
        '<div class="campo"><label for="aj-nombre">Nombre</label><input class="input" id="aj-nombre" name="nombre" value="' + esc(s.nombre) + '"></div>' +
        '<div class="form-fila"><div class="campo"><label for="aj-barrio">Barrio o municipio</label><select class="input" id="aj-barrio" name="barrio">' + BARRIOS.map(function (b) { return "<option" + (b === s.barrio ? " selected" : "") + ">" + b + "</option>"; }).join("") + "</select></div>" +
        '<div class="campo"><label for="aj-dueno">Tu nombre</label><input class="input" id="aj-dueno" name="dueno" value="' + esc(s.dueno) + '"></div></div>' +
        '<div class="campo"><label for="aj-dir">Dirección</label><input class="input" id="aj-dir" name="direccion" value="' + esc(s.direccion) + '"></div>' +
        '<div class="form-fila"><div class="campo"><label for="aj-wa">Tu WhatsApp (alertas y cierre de caja)</label><input class="input" id="aj-wa" name="whatsapp" inputmode="tel" placeholder="300 123 4567" value="' + esc(s.whatsapp || "") + '"></div>' +
        '<div class="campo"><label for="aj-resena">Link para reseñas (Google)</label><input class="input" id="aj-resena" name="linkResena" placeholder="https://g.page/r/…" value="' + esc(s.linkResena || "") + '"></div></div>' +
        '<div><button class="btn" data-accion="ajustes-guardar">' + ico("check") + "Guardar cambios</button></div></div></section>";
      html += '<section class="card"><div class="card-cab"><div><h2>Anticipo y medios de pago</h2><p>El anticipo frena los plantones</p></div></div>' +
        '<div class="interruptor-fila"><span><b>Pedir anticipo al reservar</b><small>Por WhatsApp y por el link de reservas</small></span><label class="switch"><input type="checkbox" data-accion="aj-anticipo"' + (s.anticipo.activo ? " checked" : "") + ' aria-label="Pedir anticipo"><span></span></label></div>' +
        '<div class="form-fila" style="margin:12px 0"><div class="campo"><span class="campo-k">Tipo</span><div class="chips"><button class="chip' + (s.anticipo.tipo === "fijo" ? " is-on" : "") + '" data-accion="aj-anticipo-tipo" data-t="fijo">Monto fijo</button><button class="chip' + (s.anticipo.tipo === "porcentaje" ? " is-on" : "") + '" data-accion="aj-anticipo-tipo" data-t="porcentaje">Porcentaje</button></div></div>' +
        '<div class="campo"><label for="aj-ant-valor">' + (s.anticipo.tipo === "fijo" ? "Monto (COP)" : "Porcentaje (%)") + '</label><input class="input" id="aj-ant-valor" type="number" min="0" step="' + (s.anticipo.tipo === "fijo" ? 1000 : 5) + '" data-accion="aj-anticipo-valor" value="' + (s.anticipo.tipo === "fijo" ? s.anticipo.valor : s.anticipo.porcentaje) + '"></div></div>' +
        Object.keys(BS.MEDIOS).map(function (m) {
          return '<div class="interruptor-fila"><span><b>' + BS.MEDIOS[m] + "</b><small>" + (m === "breb" ? "Pagos al instante entre bancos" : m === "efectivo" ? "En el local" : m === "pse" ? "Desde la cuenta del banco" : "Habilitado para tus clientes") + '</small></span><label class="switch"><input type="checkbox" data-accion="aj-medio" data-m="' + m + '"' + (s.medios[m] ? " checked" : "") + ' aria-label="' + BS.MEDIOS[m] + '"><span></span></label></div>';
        }).join("") + "</section>";
      html += '<section class="card"><div class="card-cab"><div><h2>Servicios y precios</h2><p>El primero es tu servicio principal</p></div></div>' + APP.editores.serviciosHTML(st.servicios) +
        '<div style="margin-top:14px"><button class="btn btn--suave" data-accion="servicios-guardar">' + ico("check") + "Guardar servicios</button></div></section>";
      html += '<section class="card"><div class="card-cab"><div><h2>Tu equipo</h2><p>Cada barbero tiene su columna en la agenda</p></div></div>' + APP.editores.barberosHTML(st.barberos, s.dueno) +
        '<div style="margin-top:14px"><button class="btn btn--suave" data-accion="equipo-guardar">' + ico("check") + "Guardar equipo</button></div></section>";
      html += '<section class="card"><div class="card-cab"><div><h2>Horario</h2><p>Así ven tus clientes cuándo hay turnos</p></div></div>' + APP.editores.horarioHTML(s.horario) +
        '<div style="margin-top:14px"><button class="btn btn--suave" data-accion="horario-guardar">' + ico("check") + "Guardar horario</button></div></section>";
      if (enServidor()) html += conexionesHTML();
      else if (!BS.esEjemplo()) html += '<section class="card"><div class="card-cab"><div><h2>Esta es una demo</h2><p>Tu barbería vive en este navegador</p></div></div>' +
        '<p class="sub" style="font-size:14px">Todo lo que creaste queda guardado aquí. Con la cuenta real, tus clientes reservan desde cualquier celular y el asistente responde en tu WhatsApp.</p>' +
        '<div class="chips" style="margin-top:14px"><a class="btn btn--suave" href="index.html?demo=1">' + ico("tienda") + 'Ver una barbería de ejemplo</a><button class="btn btn--ghost" data-accion="borrar-mia">' + ico("basura") + "Borrar y empezar de nuevo</button></div></section>";
      else html += '<section class="card"><div class="card-cab"><div><h2>Barbería de ejemplo</h2><p>Datos inventados para que veas todo funcionando</p></div></div>' +
        '<div class="interruptor-fila"><span><b>Demo en vivo</b><small>Simula clientes reservando y llegando a la fila cada minuto</small></span><label class="switch"><input type="checkbox" data-accion="aj-vivo"' + (st.ajustes.demoVivo ? " checked" : "") + ' aria-label="Demo en vivo"><span></span></label></div>' +
        '<div style="margin-top:14px"><button class="btn btn--ghost" data-accion="reset-demo">' + ico("ciclo") + "Reiniciar datos de ejemplo</button></div></section>";
      return html + "</div>";
    }
  };

  /* ---- Ajustes conectados: WhatsApp, pagos y cuenta ---- */
  function conexionesHTML() {
    var ses = BS.conexion.sesion || {}, it = ses.integraciones || {};
    function estado(ok, si, no) { return '<span class="estado estado--' + (ok ? "ok" : "alerta") + '">' + ico(ok ? "check" : "reloj") + (ok ? si : no) + "</span>"; }
    function campo(nombre, etiqueta, actual, ayuda) {
      return '<div class="campo"><label for="cx-' + nombre + '">' + etiqueta + '</label><input class="input" id="cx-' + nombre + '" name="' + nombre + '" autocomplete="off" spellcheck="false" placeholder="' + esc(actual || "Sin configurar") + '">' + (ayuda ? '<span class="campo-ayuda">' + ayuda + "</span>" : "") + "</div>";
    }
    return '<section class="card"><div class="card-cab"><div><h2>Conexiones</h2><p>Las llaves se guardan solo en el servidor y nunca vuelven al navegador</p></div></div><div class="form" data-form-conexiones>' +
      '<div class="interruptor-fila"><span><b>WhatsApp</b><small>' + (it.whatsapp === "meta" ? "API oficial de Meta (WhatsApp Business)" : "Simulador: los mensajes quedan en la actividad, no salen a celulares") + "</small></span>" + estado(it.whatsapp === "meta", "Conectado", "Simulador") + "</div>" +
      campo("whatsapp_phone_number_id", "ID del número de WhatsApp Business", it.whatsappNumero, "Lo encontrás en Meta for Developers → WhatsApp → Configuración de la API. Si lo dejás vacío se usa el del servidor.") +
      '<div class="interruptor-fila"><span><b>Pagos de anticipos</b><small>' + (it.pagos === "wompi" ? "Wompi · " + esc(it.wompiAmbiente || "") : "Simulador: página de pago de prueba, no se cobra plata real") + "</small></span>" + estado(it.pagos === "wompi", "Conectado", "Simulador") + "</div>" +
      campo("wompi_llave_privada", "Llave privada de Wompi", it.wompiLlave, "Empieza por prv_test_ (pruebas) o prv_prod_ (real).") +
      campo("wompi_secreto_eventos", "Secreto de eventos de Wompi", it.wompiEventos, "En Wompi → Desarrolladores. Sirve para verificar que los avisos de pago son auténticos.") +
      (it.webhookWompi ? '<div class="campo"><span class="campo-k">URL de eventos para pegar en Wompi</span><div class="chips"><span class="chip mono" style="cursor:text;user-select:all;font-size:12px">' + esc(it.webhookWompi) + "</span></div></div>" : "") +
      '<div><button class="btn" data-accion="conexiones-guardar">' + ico("check") + "Guardar conexiones</button></div></div></section>" +
      '<section class="card"><div class="card-cab"><div><h2>Tu cuenta</h2><p>' + esc(ses.usuario ? ses.usuario.email : "") + "</p></div></div>" +
      '<div class="interruptor-fila"><span><b>Link de reservas</b><small>' + esc(BS.linkReservas()) + '</small></span><button class="btn btn--suave btn--sm" data-accion="copiar-link">' + ico("copiar") + "Copiar</button></div>" +
      '<div class="interruptor-fila"><span><b>Cerrar sesión</b><small>En este dispositivo</small></span><button class="btn btn--ghost btn--sm" data-accion="salir">Salir</button></div></section>';
  }

  /* ---- Más (móvil) ---- */
  APP.vistas.mas = {
    titulo: "Más",
    sub: function () { return BS.get().shop.nombre; },
    html: function () {
      return '<div class="mas-lista">' + RUTAS.filter(function (r) { return ["hoy", "agenda", "fila", "automatizaciones"].indexOf(r.id) < 0; }).map(function (r) {
        return '<a href="#/' + r.id + '">' + ico(r.ico) + r.txt + "</a>";
      }).join("") + '<a href="' + (enServidor() ? esc(BS.linkReservas()) : reservaDemo()) + '" target="_blank" rel="noopener">' + ico("web") + "Página de reservas<small>Así reservan tus clientes</small></a>" +
        (enServidor() ? '<button type="button" data-accion="salir">' + ico("flecha") + "Cerrar sesión<small>En este dispositivo</small></button>" : "") +
        '<a href="../index.html">' + ico("flecha") + "Volver a la web<small>barbersaas</small></a></div>";
    }
  };

  /* ==========================================================================
     ONBOARDING
     ========================================================================== */
  /* ==========================================================================
     DEMO EN VIVO
     ========================================================================== */
  var NOMBRES_NUEVOS = ["Sergio Arboleda", "Alejo Restrepo", "Johan Valencia", "Maicol Ocampo", "Duván Ramírez", "Yeison Ruiz", "Andrés Camilo Lopera", "Stiven Gaviria", "Jacobo Mesa", "Emiliano Vargas"];
  var proximoEvento = Date.now() + 14000;
  function avanzarDemo() {
    var st = BS.get(), ahora = new Date(), cambio = false;
    BS.citasDelDia(ahora).forEach(function (c) {
      var ini = new Date(c.inicio), fin = BS.finCita(c);
      if ((c.estado === "confirmada" || c.estado === "pendiente") && ini <= ahora && fin > ahora && (ahora - ini) < 10 * 60000) {
        c.estado = "en-silla"; cambio = true;
      } else if ((c.estado === "confirmada" || c.estado === "pendiente") && fin <= ahora) {
        c.estado = "terminada"; c.pago = { medio: ["nequi", "efectivo", "breb", "tarjeta"][Math.floor(Math.random() * 4)], monto: c.precio, propina: 0, fecha: fin.toISOString() }; cambio = true;
      } else if (c.estado === "en-silla" && ahora - fin > 8 * 60000) {
        c.estado = "terminada"; c.pago = { medio: ["nequi", "efectivo", "breb"][Math.floor(Math.random() * 3)], monto: c.precio, propina: Math.random() < 0.2 ? 5000 : 0, fecha: fin.toISOString() }; cambio = true;
      }
    });
    if (cambio) BS.commit("demo");
    return st;
  }
  function eventoDemo() {
    var st = BS.get();
    var abierto = BS.abiertoAhora();
    var r = Math.random();
    var pendientes = st.citas.filter(function (c) { return c.estado === "pendiente" && new Date(c.inicio) > new Date(); });
    if (r < 0.3 && abierto && st.fila.length < 6) {
      var nombre = Math.random() < 0.5 ? NOMBRES_NUEVOS[Math.floor(Math.random() * NOMBRES_NUEVOS.length)] : st.clientes[Math.floor(Math.random() * st.clientes.length)].nombre;
      BS.unirseFila({ nombre: nombre, via: Math.random() < 0.6 ? "qr" : "whatsapp", servicio: Math.random() < 0.6 ? "s1" : "s2" });
      return;
    }
    if (r < 0.45 && pendientes.length) {
      var p = pendientes[Math.floor(Math.random() * pendientes.length)];
      BS.pagarAnticipo(p.id, Math.random() < 0.5 ? "nequi" : "breb");
      return;
    }
    var cli = st.clientes[Math.floor(Math.random() * st.clientes.length)];
    var sid = Math.random() < 0.55 ? "s1" : "s2";
    for (var d = 0; d <= 2; d++) {
      var dia = U.addDias(U.hoy0(), d);
      var slots = BS.slotsLibres(dia, sid, "cualquiera");
      if (!slots.length) continue;
      var s = slots[Math.floor(Math.random() * Math.min(6, slots.length))];
      var fuente = Math.random() < 0.65 ? "whatsapp" : "web";
      var pagado = Math.random() < 0.6;
      BS.crearCita({ cliente: cli.id, barbero: s.barbero, servicio: sid, inicio: U.enMin(dia, s.min), fuente: fuente, estado: pagado ? "confirmada" : "pendiente",
        anticipo: { monto: BS.montoAnticipo(BS.servicio(sid).precio), medio: Math.random() < 0.5 ? "breb" : "nequi", pagado: pagado, fecha: new Date().toISOString() } });
      return;
    }
  }
  function tickDemo() {
    var st = BS.get();
    if (enServidor() || !st.ajustes.demoVivo || document.visibilityState !== "visible") return;
    if (Date.now() >= proximoEvento && capa.hidden) {
      proximoEvento = Date.now() + 38000 + Math.random() * 30000;
      try { eventoDemo(); } catch (e) { console.warn("[demo]", e); }
    }
  }

  /* ==========================================================================
     ACCIONES (delegación de eventos)
     ========================================================================== */
  function accion(el, e) {
    var a = el.getAttribute("data-accion"), id = el.getAttribute("data-id");
    var c = APP.capaActual || {};
    switch (a) {
      case "ir": APP.cerrarCapa(); APP.ir(el.getAttribute("data-ruta")); break;
      case "cerrar": APP.cerrarCapa(); break;
      case "toggle-vivo": BS.ajuste("demoVivo", !BS.get().ajustes.demoVivo); APP.toastSimple(BS.get().ajustes.demoVivo ? "Demo en vivo prendida: van a llegar reservas y gente a la fila." : "Demo en vivo apagada. Todo queda quieto para que pruebes a mano.", "rayo", "Demo"); break;
      case "nueva-cita": abrirNuevaCita({}); break;
      case "ver-cita": abrirCita(id); break;
      case "ver-cliente": abrirCliente(id); break;
      case "feed-ver": ui.feedAbierto[id] = !ui.feedAbierto[id]; render(true); break;
      case "graf-tabla": ui.grafTabla = !ui.grafTabla; render(true); break;

      case "cita-llego": BS.marcarLlegada(id); break;
      case "cita-cobrar": modalCobro(id); break;
      case "cita-cancelar": modalCancelar(id); break;
      case "cancelar-ok": APP.cerrarCapa(); BS.cancelarCita(id); break;
      case "cita-noshow": BS.noShow(id); break;
      case "cita-anticipo": BS.pagarAnticipo(id, "nequi"); break;
      case "cobro-medio": c.cobro.estado.medio = el.getAttribute("data-m"); c.cobro.repintar(); break;
      case "cobro-propina": c.cobro.estado.propina = Number(el.getAttribute("data-p")); c.cobro.repintar(); break;
      case "cobro-ok": var cb = c.cobro; APP.cerrarCapa(); BS.cobrarCita(cb.id, cb.estado.medio, cb.estado.propina); APP.toastSimple("Cobro registrado. En 2 horas sale el pedido de reseña.", "plata", "Caja"); break;

      case "agenda-dia":
        var delta = Number(el.getAttribute("data-delta"));
        ui.agendaDia = delta === 0 ? U.hoy0() : U.addDias(ui.agendaDia, delta);
        render(true); break;
      case "agenda-barbero": ui.agendaBarbero = id; render(true); break;
      case "agenda-slot":
        if (e.target.closest(".bloque")) return;
        var rect = el.getBoundingClientRect();
        var min = Number(el.getAttribute("data-ini")) + (e.clientY - rect.top) / PX;
        abrirNuevaCita({ barbero: el.getAttribute("data-barbero"), dia: ui.agendaDia, min: Math.floor(min / 20) * 20 });
        break;

      case "nc-servicio": c.nc.servicio = id; c.repintar(); break;
      case "nc-barbero": c.nc.barbero = id; c.repintar(); break;
      case "nc-dia": c.nc.dia = U.addDias(U.hoy0(), Number(el.getAttribute("data-i"))); c.nc.min = null; c.repintar(); break;
      case "nc-slot": c.nc.min = Number(el.getAttribute("data-min")); c.repintar(); break;
      case "nc-cliente": c.nc.cliente = id; c.nc.nombre = ""; c.repintar(); break;
      case "nc-cliente-nuevo": var inp = $("[data-nc='busca']", capa); c.nc.nombre = inp ? inp.value.trim() : ""; c.nc.cliente = null; c.repintar(); var t = $("[data-nc='tel']", capa); if (t) t.focus(); break;
      case "nc-cambiar-cliente": c.nc.cliente = null; c.nc.nombre = ""; c.repintar(); break;
      case "nc-ok":
        var nc = c.nc;
        if (!(nc.cliente || nc.nombre.trim()) || nc.min == null) return;
        var slot = c.slots().filter(function (s) { return s.min === nc.min; })[0];
        var barbero = nc.barbero === "cualquiera" ? (slot ? slot.barbero : BS.get().barberos[0].id) : nc.barbero;
        var srv = BS.servicio(nc.servicio);
        var cita = BS.crearCita({
          cliente: nc.cliente || null, nombre: nc.nombre, tel: nc.tel, barbero: barbero, servicio: nc.servicio, inicio: U.enMin(nc.dia, nc.min),
          fuente: nc.anticipo ? "whatsapp" : "manual", estado: nc.anticipo ? "pendiente" : "confirmada",
          anticipo: nc.anticipo ? { monto: BS.montoAnticipo(srv.precio), medio: "nequi", pagado: false, fecha: new Date().toISOString() } : null
        });
        ui.nuevaId = cita.id; ui.agendaDia = U.hoy0(); ui.agendaDia = new Date(nc.dia);
        APP.cerrarCapa();
        if (rutaActual() !== "agenda") APP.ir("agenda"); else render(true);
        break;

      case "fila-silla": BS.pasarASilla(id, el.getAttribute("data-barbero")); APP.toastSimple("Pasó a la silla. La fila avanzó y avisamos al siguiente.", "tijeras", "Fila virtual"); break;
      case "fila-quitar": BS.salirFila(id); break;
      case "qr-descargar": descargarAfiche(); break;
      case "fila-simular":
        if (enServidor()) break;
        var nombres = NOMBRES_NUEVOS.concat(BS.get().clientes.map(function (x) { return x.nombre; }));
        BS.unirseFila({ nombre: nombres[Math.floor(Math.random() * nombres.length)], via: "qr", servicio: Math.random() < 0.6 ? "s1" : "s2" });
        break;

      case "auto-filtro": ui.autosFiltro = el.getAttribute("data-f"); render(true); break;
      case "auto-nueva": abrirEditor(null); break;
      case "auto-editar": abrirEditor(id); break;
      case "auto-ejecutar":
        var res = BS.ejecutarAuto(id);
        if (res && res.pendiente) APP.toastSimple("Ejecutando en el servidor. El resultado llega a tus notificaciones.", "rayo", "Automatización");
        else if (res && !res.enviados && res.resultado !== "agenda llena") APP.toastSimple("No había a quién escribirle ahora mismo.", "rayo", "Automatización");
        break;
      case "ed-var":
        var ta = $("[data-ed='plantilla']", capa);
        var v = "{" + el.getAttribute("data-v") + "}";
        var ini = ta.selectionStart || ta.value.length, fin = ta.selectionEnd || ta.value.length;
        ta.value = ta.value.slice(0, ini) + v + ta.value.slice(fin);
        c.ed.plantilla = ta.value;
        $("[data-ed-preview]", capa).textContent = c.preview();
        ta.focus(); ta.selectionStart = ta.selectionEnd = ini + v.length;
        break;
      case "ed-probar":
        leerEditor(c);
        var textoPrueba = BS.render(c.ed.plantilla, BS.varsEjemplo());
        if (enServidor()) {
          BS.conexion.post("whatsapp/prueba", { texto: textoPrueba }).then(function (r) {
            APP.toastSimple(r.mensaje || "Prueba enviada a tu WhatsApp.", "enviar", "Prueba");
          }).catch(function (err) { APP.toastSimple(err.message, "x", "Prueba"); });
        } else APP.toastSimple("Te mandamos la prueba a tu WhatsApp: «" + textoPrueba.slice(0, 70) + "…»", "enviar", "Prueba enviada");
        break;
      case "salir": BS.conexion.salir(); break;
      case "conexiones-guardar":
        var formC = $("[data-form-conexiones]", vistaEl), datosC = {};
        $$("input[name]", formC).forEach(function (i) { if (i.value.trim()) datosC[i.name] = i.value.trim(); });
        BS.conexion.put("integraciones", datosC).then(function (r) {
          if (BS.conexion.sesion) BS.conexion.sesion.integraciones = r.integraciones;
          render(true);
          APP.toastSimple("Conexiones guardadas. Las llaves quedan solo en el servidor.", "check", "Ajustes");
        }).catch(function (err) { APP.toastSimple(err.message, "x", "Ajustes"); });
        break;
      case "ed-guardar":
        leerEditor(c);
        if (!c.ed.nombre.trim()) { var n = $("[data-ed='nombre']", capa); n.focus(); n.setAttribute("aria-invalid", "true"); APP.toastSimple("Ponele un nombre a la automatización.", "editar", "Falta algo"); return; }
        var d = BS.DISPARADORES[c.ed.disparador];
        c.ed.ico = d ? d.ico : "rayo";
        if (!c.ed.desc || c.ed.custom) c.ed.desc = "Cuando " + (d ? d.txt.charAt(0).toLowerCase() + d.txt.slice(1) : "pasa algo") + ", manda un WhatsApp" + (c.ed.publico && c.ed.publico !== "todos" ? " (" + BS.PUBLICOS[c.ed.publico].toLowerCase() + ")" : "") + ".";
        var nueva = !c.base;
        BS.guardarAuto(c.ed);
        if (nueva) BS.actividad({ tipo: "rayo", texto: "Creaste la automatización «" + c.ed.nombre + "» y quedó prendida", auto: c.ed.id, toast: true });
        BS.commit("auto");
        APP.cerrarCapa();
        if (!nueva) APP.toastSimple("Cambios guardados en «" + c.ed.nombre + "».", "check", "Automatización");
        break;
      case "ed-eliminar":
        BS.get().autos = BS.get().autos.filter(function (x) { return x.id !== c.ed.id; });
        BS.commit("auto"); APP.cerrarCapa(); APP.toastSimple("Automatización eliminada.", "basura", "Listo");
        break;

      case "clientes-filtro": ui.clientesFiltro = el.getAttribute("data-f"); render(true); break;
      case "cliente-agendar": APP.cerrarCapa(); abrirNuevaCita({ cliente: id }); break;
      case "cliente-whatsapp":
        var cw = BS.cliente(id), num = String(cw && cw.tel || "").replace(/\D/g, "");
        if (num.length === 10 && num.charAt(0) === "3") num = "57" + num;
        if (enServidor() && !cw.ejemplo && /^573\d{9}$/.test(num)) window.open("https://wa.me/" + num, "_blank", "noopener");
        else APP.toastSimple(enServidor() ? "Este cliente no tiene un celular válido (o es de los datos de ejemplo)." : "En la versión real se abre el chat de WhatsApp con " + U.primerNombre(cw.nombre) + ".", "chat", "WhatsApp");
        break;

      case "caja-periodo": ui.cajaPeriodo = el.getAttribute("data-p"); render(true); break;
      case "liq-pagar":
        var b = BS.barbero(id), monto = Number(el.getAttribute("data-monto"));
        APP.abrirModal("<h2>Pagarle a " + esc(b.nombre) + "</h2><p>Liquidación de la semana por Bre-B. Le llega al instante a su llave.</p>" +
          '<div class="total-cobro"><span class="sub">Monto</span><b class="num">' + U.pesos(monto) + "</b></div>" +
          '<div class="aviso-auto">' + ico("escudo") + "<div>" + (enServidor()
            ? "Se registra en tu caja y " + esc(b.nombre) + " recibe el comprobante por WhatsApp. La transferencia la autorizás desde la app de tu banco."
            : "Demo: no se mueve plata real. En producción se valida el titular de la llave Bre-B y se autoriza desde tu celular.") + "</div></div>" +
          '<div class="modal-acc"><button class="btn btn--ghost" data-accion="cerrar">Cancelar</button><button class="btn" data-accion="liq-ok" data-id="' + id + '" data-monto="' + monto + '">' + ico("enviar") + "Enviar " + U.pesos(monto) + "</button></div>");
        break;
      case "liq-ok":
        var desdeS = BS.inicioSemana(new Date());
        APP.cerrarCapa();
        BS.pagarLiquidacion(id, Number(el.getAttribute("data-monto")), "semana del " + U.fechaCorta(desdeS));
        APP.toastSimple("Pago enviado a " + BS.barbero(id).nombre + ". Ya le llegó el comprobante por WhatsApp.", "plata", "Bre-B");
        break;

      case "ajustes-guardar":
        var f = $("[data-form-shop]", vistaEl);
        var datos = {};
        $$("input[name], select[name]", f).forEach(function (i) { datos[i.name] = i.value.trim(); });
        if (datos.nombre && !enServidor()) datos.slug = U.normalizar(datos.nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
        if (datos.whatsapp) datos.whatsapp = datos.whatsapp.replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
        BS.get().barberos[0].nombre = datos.dueno || BS.get().barberos[0].nombre;
        BS.actualizarShop(datos);
        render(true);
        APP.toastSimple("Guardado. Tu página de reservas ya muestra los cambios.", "check", "Ajustes");
        break;
      case "servicios-guardar":
        var ed = APP.editores, stS = BS.get();
        var servs = ed.leerServicios($("[data-editor='servicios']", vistaEl), stS.servicios);
        var errS = ed.validarServicios(servs) || conCitas(stS.servicios, servs, "servicio");
        if (errS) { APP.toastSimple(errS, "x", "Servicios"); break; }
        stS.servicios = servs;
        BS.commit("servicios"); render(true);
        APP.toastSimple("Servicios guardados. Tu página de reservas ya muestra los precios nuevos.", "check", "Ajustes");
        break;
      case "equipo-guardar":
        var stE = BS.get();
        var barbs = APP.editores.leerBarberos($("[data-editor='barberos']", vistaEl), stE.barberos, stE.shop.dueno, stE.shop.whatsapp);
        var errE = APP.editores.validarBarberos(barbs) || conCitas(stE.barberos, barbs, "barbero");
        if (errE) { APP.toastSimple(errE, "x", "Equipo"); break; }
        stE.barberos = barbs;
        BS.commit("barberos"); render(true);
        APP.toastSimple("Equipo guardado. La agenda ya tiene una columna por barbero.", "check", "Ajustes");
        break;
      case "horario-guardar":
        var hor = APP.editores.leerHorario($("[data-editor='horario']", vistaEl));
        var errH = APP.editores.validarHorario(hor);
        if (errH) { APP.toastSimple(errH, "x", "Horario"); break; }
        BS.get().shop.horario = hor;
        BS.commit("shop"); render(true);
        APP.toastSimple("Horario guardado. Solo se puede reservar dentro de estas horas.", "check", "Ajustes");
        break;
      case "borrar-mia":
        APP.abrirModal("<h2>¿Borrar " + esc(BS.get().shop.nombre) + " de este navegador?</h2><p>Se borran las citas, clientes y ajustes de esta demo y volvés a crear tu barbería desde cero. No se puede deshacer.</p>" +
          '<div class="modal-acc"><button class="btn btn--ghost" data-accion="cerrar">Cancelar</button><button class="btn" data-accion="borrar-mia-ok">Sí, borrar</button></div>');
        break;
      case "borrar-mia-ok": BS.borrarLocal(); location.replace("index.html?nuevo=1"); break;
      case "aj-anticipo-tipo": BS.get().shop.anticipo.tipo = el.getAttribute("data-t"); BS.commit("shop"); render(true); break;
      case "copiar-link":
        var link = /^https?:/.test(BS.linkReservas()) ? BS.linkReservas() : "https://" + BS.linkReservas();
        try { navigator.clipboard.writeText(link); } catch (err) { /* sin portapapeles */ }
        APP.toastSimple("Link copiado: " + link, "copiar", "Listo");
        break;
      case "reset-demo":
        APP.abrirModal("<h2>¿Reiniciar los datos de ejemplo?</h2><p>Se borran las citas, clientes y automatizaciones que creaste en esta demo y vuelve todo al estado inicial. No se puede deshacer.</p>" +
          '<div class="modal-acc"><button class="btn btn--ghost" data-accion="cerrar">Cancelar</button><button class="btn" data-accion="reset-ok">Sí, reiniciar</button></div>');
        break;
      case "reset-ok": APP.cerrarCapa(); BS.reset(); marcarVistos(); render(true); APP.toastSimple("Datos de ejemplo reiniciados.", "ciclo", "Listo"); break;

      default: return false;
    }
    return true;
  }

  /** Un servicio o barbero con citas no se puede quitar: la agenda y la caja los necesitan. */
  function conCitas(antes, despues, tipo) {
    var quedan = {}; despues.forEach(function (x) { quedan[x.id] = 1; });
    var campo = tipo === "servicio" ? "servicio" : "barbero";
    var quitado = antes.filter(function (x) { return !quedan[x.id] && BS.get().citas.some(function (c) { return c[campo] === x.id; }); })[0];
    if (!quitado) return "";
    return tipo === "servicio" ? "«" + quitado.nombre + "» ya tiene citas: no lo podés quitar. Cambiale el nombre o el precio."
      : quitado.nombre + " ya tiene citas en la agenda: no lo podés quitar todavía.";
  }

  function leerEditor(c) {
    var ed = c.ed;
    var n = $("[data-ed='nombre']", capa); if (n) ed.nombre = n.value;
    var d = $("[data-ed='disparador']", capa); if (d && !d.disabled) ed.disparador = d.value;
    var es = $("[data-ed='espera']", capa); if (es) ed.espera = Number(es.value) || 0;
    var p = $("[data-ed='publico']", capa); if (p) ed.publico = p.value;
    var t = $("[data-ed='plantilla']", capa); if (t) ed.plantilla = t.value;
  }

  function enlazarEventos() {
    document.addEventListener("click", function (e) {
      var el = e.target.closest("[data-accion]");
      if (!el) return;
      if (el.tagName === "INPUT") return; // los switches van por «change»
      if (el.tagName === "A" && el.getAttribute("href") && el.getAttribute("href").charAt(0) !== "#") return;
      var hecho = accion(el, e);
      if (hecho !== false && el.tagName !== "A") e.preventDefault();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !capa.hidden) { APP.cerrarCapa(); return; }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-accion][role='button'], tr[data-accion]")) {
        e.preventDefault(); accion(e.target, e);
      }
    });
    capa.addEventListener("click", function (e) { if (e.target === capa) APP.cerrarCapa(); });
    document.addEventListener("change", function (e) {
      var el = e.target, a = el.getAttribute("data-accion");
      if (a === "auto-toggle") { BS.toggleAuto(el.getAttribute("data-id")); return; }
      if (a === "aj-anticipo") { BS.get().shop.anticipo.activo = el.checked; BS.commit("shop"); return; }
      if (a === "aj-medio") { BS.get().shop.medios[el.getAttribute("data-m")] = el.checked; BS.commit("shop"); return; }
      if (a === "aj-vivo") { BS.ajuste("demoVivo", el.checked); return; }
      if (a === "aj-anticipo-valor") {
        var an = BS.get().shop.anticipo, v = Math.max(0, Number(el.value) || 0);
        if (an.tipo === "fijo") an.valor = v; else an.porcentaje = Math.min(100, v);
        BS.commit("shop"); return;
      }
      if (el.matches("[data-nc='anticipo']") && APP.capaActual && APP.capaActual.nc) { APP.capaActual.nc.anticipo = el.checked; APP.capaActual.repintar(); return; }
      if (el.matches("[data-ed='disparador']") && APP.capaActual && APP.capaActual.ed) {
        leerEditor(APP.capaActual); APP.capaActual.repintar(); return;
      }
      if (a === "cliente-promos") {
        var cp = BS.cliente(el.getAttribute("data-id"));
        if (cp) {
          cp.sinPromos = el.checked ? false : new Date().toISOString(); // false (no borrar): el servidor fusiona campos
          BS.commit("cliente");
          APP.toastSimple(el.checked ? U.primerNombre(cp.nombre) + " vuelve a recibir promociones." : U.primerNombre(cp.nombre) + " ya no recibe promociones. Sus citas sí le llegan.", "chat", "Cliente");
        }
        return;
      }
      if (el.matches("[data-ficha]")) {
        var cli = BS.cliente(el.getAttribute("data-ficha"));
        if (cli) { cli.ficha = el.value.trim(); BS.commit("cliente"); APP.toastSimple("Ficha de corte guardada.", "tijeras", "Cliente"); }
      }
    });
    document.addEventListener("input", function (e) {
      var el = e.target;
      if (el.matches("[data-nc='busca']")) { sugerirClientes(el.value); return; }
      if (el.matches("[data-nc='nombre']") && APP.capaActual && APP.capaActual.nc) {
        APP.capaActual.nc.nombre = el.value;
        var ok = $("[data-accion='nc-ok']", capa); if (ok) ok.classList.toggle("is-disabled", !(el.value.trim() && APP.capaActual.nc.min != null));
        return;
      }
      if (el.matches("[data-nc='tel']") && APP.capaActual && APP.capaActual.nc) { APP.capaActual.nc.tel = el.value; return; }
      if (el.matches("[data-ed='plantilla']") && APP.capaActual && APP.capaActual.ed) {
        APP.capaActual.ed.plantilla = el.value;
        var pv = $("[data-ed-preview]", capa); if (pv) pv.textContent = APP.capaActual.preview();
        return;
      }
      if (el.matches("[data-accion='clientes-buscar']")) {
        ui.clientesBusqueda = el.value;
        clearTimeout(enlazarEventos.t);
        enlazarEventos.t = setTimeout(function () {
          var pos = el.selectionStart;
          render(true);
          var nuevo = $("[data-accion='clientes-buscar']", vistaEl);
          if (nuevo) { nuevo.focus(); try { nuevo.setSelectionRange(pos, pos); } catch (err) { /* type=search */ } }
        }, 180);
      }
    });
    document.addEventListener("focusout", function () { if (sucio) setTimeout(function () { if (sucio) programarRender(); }, 50); });
    window.addEventListener("hashchange", function () { APP.cerrarCapa(); render(); });
  }

  /* ==========================================================================
     ARRANQUE
     ========================================================================== */
  function enServidor() { return BS.conexion && BS.conexion.modo === "servidor"; }
  APP.enServidor = enServidor;
  /** Página de reservas en la demo: la de ejemplo lleva ?demo=1 para no mezclarse con la barbería del dueño. */
  function reservaDemo(extra) { var q = (BS.esEjemplo() ? ["demo=1"] : []).concat(extra ? [extra] : []); return "../reserva/index.html" + (q.length ? "?" + q.join("&") : ""); }
  function demoActiva() { return !enServidor() && BS.get().ajustes.demoVivo; }

  function boot() {
    vistaEl = $("#vista"); capa = $("[data-capa]"); toastsEl = $("[data-toasts]");
    document.body.classList.toggle("modo-servidor", enServidor());
    marcarVistos();
    if (demoActiva()) avanzarDemo();
    enlazarEventos();
    BS.subscribe(function () { programarRender(); refrescarCapa(); revisarToasts(); });
    render(true);
    var params = new URLSearchParams(location.search);
    if (params.get("nuevo") || params.get("demo")) history.replaceState(null, "", location.pathname + (params.get("demo") ? "?demo=1" : "") + location.hash);
    setInterval(function () {
      if (demoActiva()) avanzarDemo();
      if (["hoy", "agenda", "fila"].indexOf(ui.ruta) >= 0) programarRender();
    }, 30000);
    setInterval(tickDemo, 4000);
    APP.listo = true;
  }
  function errorArranque(err) {
    var v = $("#vista");
    v.innerHTML = '<div class="card vacio" style="margin-top:40px"><b>No pudimos abrir tu barbería</b>' + esc((err && err.message) || "Revisá tu conexión") +
      '<p style="margin-top:16px"><button class="btn" onclick="location.reload()">Intentar de nuevo</button></p></div>';
  }
  // Los scripts van con «defer»: se espera a DOMContentLoaded (app-bot.js ya registró su vista) y a que la conexión decida el modo
  function arrancar() {
    (BS.listo || Promise.resolve()).then(function () {
      var params = new URLSearchParams(location.search), st = BS.get();
      // Servidor: la cuenta recién creada configura su barbería. Demo: sin barbería propia, o «Probar gratis» (?nuevo=1)
      var registrar = enServidor() ? !st.shop.onboarded : !BS.esEjemplo() && (!st || params.get("nuevo") === "1");
      if (registrar && APP.registro) APP.registro.abrir({ alTerminar: boot, previa: !enServidor() && st ? st.shop.nombre : "" });
      else boot();
    }).catch(errorArranque);
  }
  if (document.readyState === "complete") arrancar(); else document.addEventListener("DOMContentLoaded", arrancar);
})();
