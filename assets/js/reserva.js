/* ==========================================================================
   Barber SaaS — Página de reservas del cliente
   Reservar cita (servicio → barbero → día y hora → datos → anticipo) o hacer
   fila virtual. Usa los mismos datos del panel: lo que pase aquí aparece allá.
   ========================================================================== */
(function () {
  "use strict";
  var BS = window.BS, U = BS.util, esc = U.escapar;
  var KEY_YO = "barbersaas.yo", KEY_FILA = "barbersaas.miFila";

  var IC = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    ubicacion: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    estrella: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    chat: '<path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.2A8.5 8.5 0 1 1 20.5 11.5z"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    rayo: '<path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13z"/>',
    fila: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18.5 14.8c1.7.7 2.7 2.4 3 5.2"/>',
    escudo: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    tijeras: '<circle cx="6" cy="6.5" r="3"/><circle cx="6" cy="17.5" r="3"/><path d="M8.6 8.1L20 18M8.6 15.9L20 6"/>',
    ciclo: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>',
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'
  };
  function ico(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || "") + "</svg>"; }
  function $(s, r) { return (r || document).querySelector(s); }
  function leer(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function escribirLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }

  var yo = leer(KEY_YO) || {};
  var params = new URLSearchParams(location.search);
  var R = {
    modo: params.get("modo") === "fila" ? "fila" : "cita",
    servicio: null, barbero: null, dia: null, min: null,
    nombre: yo.nombre || "", tel: yo.tel || "", acepto: !!yo.tel, datosOk: false, errores: {},
    medio: "breb", confirmada: null, filaId: leer(KEY_FILA), filaServicio: "s1", ultimaPos: null, teToca: null,
    cambiando: null, movida: false, calif: {}, califTxt: {}, aCancelar: null
  };
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  var cuerpo, capa, toastsEl;

  /* ---------------- Conectado al servidor ---------------- */
  function enServidor() { return BS.conexion && BS.conexion.modo === "servidor"; }
  var remoto = { cita: null, token: null, sondeoCita: null, fila: null, sondeoFila: null, mis: [] };
  function claveFila() { return KEY_FILA + ":" + (BS.conexion.slug || ""); }
  function tecleando() { var a = document.activeElement; return a && a.matches && a.matches("input, textarea"); }

  function reservarRemoto() {
    var btn = cuerpo.querySelector("[data-rs='pagar'], [data-rs='reservar']");
    if (btn) { btn.disabled = true; btn.textContent = "Reservando…"; }
    BS.conexion.reservar({
      servicio: R.servicio, barbero: R.barbero, fecha: U.claveDia(R.dia), min: R.min, nombre: R.nombre.trim(),
      tel: R.tel.replace(/\D/g, ""), acepto: R.acepto, medio: R.medio
    }).then(function (res) {
      guardarYo();
      guardarMia(res.cita.id, res.token);
      if (res.pagoUrl) { location.href = res.pagoUrl; return; }
      remoto.cita = res.cita; remoto.token = res.token;
      render(); window.scrollTo({ top: 0, behavior: "smooth" });
      // La pasarela no respondió: el turno queda apartado y seguimos revisando
      if (res.pagoError) { toast("La pasarela de pago no respondió. Te mandamos el link por WhatsApp."); cargarCitaRemota(res.cita.id, res.token); }
    }).catch(function (err) {
      toast(err.message);
      if (err.status === 409) { R.min = null; BS.conexion.recargarPublico().then(render, render); } else render();
    });
  }
  function cargarCitaRemota(id, token, intentos) {
    BS.conexion.estadoReserva(id, token).then(function (c) {
      remoto.cita = c; remoto.token = token;
      if (!tecleando()) render();
      if (c.anticipo && !c.anticipo.pagado && c.estado !== "cancelada" && (intentos || 0) < 40) {
        clearTimeout(remoto.sondeoCita);
        remoto.sondeoCita = setTimeout(function () { cargarCitaRemota(id, token, (intentos || 0) + 1); }, 3000);
      }
    }).catch(function (err) { toast(err.message); });
  }
  function htmlConfirmadaRemota() {
    var c = remoto.cita, pendiente = c.anticipo && !c.anticipo.pagado;
    if (c.estado === "cancelada") return '<div class="rs-ok"><h2>Esta reserva se canceló</h2><p>Su turno ya quedó libre para otro cliente. Si querés, hacé una nueva.</p><button class="btn btn--lg rs-cta" data-rs="otra">Hacer otra reserva</button></div>';
    var cn = normRemota(Object.assign({ token: remoto.token }, c));
    // Visita que ya pasó (por ejemplo, desde el link para calificar): se califica aquí mismo
    if (c.estado === "terminada" || c.estado === "no-show" || new Date(c.inicio).getTime() + c.dur * 60000 < Date.now()) {
      return '<div class="rs-ok"><h2>Tu visita del ' + esc(U.fechaLarga(c.inicio)) + "</h2><p>" + esc(c.servicio) + " con " + esc(c.barbero) + " en " + esc(c.barberia) + ".</p>" +
        (cn.puedeCalificar ? htmlCalificar(cn) : cn.calificacion ? '<p class="rs-gracias">' + ico("estrella") + " Calificaste con " + cn.calificacion.estrellas + " de 5. ¡Gracias!</p>" : "") +
        '<div class="rs-acciones"><button class="btn btn--lg rs-cta" data-rs="repetir" data-s="' + esc(cn.servicioId) + '" data-b="' + esc(cn.barberoId) + '">' + ico("ciclo") + "Reservar otra vez</button></div></div>";
    }
    var abono = c.anticipo && c.anticipo.pagado ? c.anticipo.monto : 0;
    return '<div class="rs-ok">' + (pendiente
        ? '<span class="rs-ok-ico" style="background:var(--alerta);box-shadow:0 0 0 10px var(--alerta-suave)">' + ico("reloj") + "</span><h2>Falta el anticipo</h2><p>Tu turno está apartado mientras confirmamos el pago. Esta página se actualiza sola.</p>"
        : '<span class="rs-ok-ico">' + ico("check") + "</span><h2>" + (R.movida ? "¡Listo, movimos tu turno!" : "¡Listo" + (c.cliente ? ", " + esc(c.cliente) : "") + "!") + "</h2><p>" + (R.movida ? "Te llega la confirmación con la hora nueva por WhatsApp." : "Tu turno quedó reservado. Te esperamos en " + esc(c.barberia) + ".") + "</p>") +
      '<div class="rs-resumen"><div><span>Servicio</span><b>' + esc(c.servicio) + "</b></div><div><span>Barbero</span><b>" + esc(c.barbero) + "</b></div>" +
      "<div><span>Día</span><b>" + esc(U.fechaLarga(c.inicio)) + "</b></div><div><span>Hora</span><b>" + U.hora(c.inicio) + "</b></div>" +
      (abono ? "<div><span>Anticipo pagado</span><b>" + U.pesos(abono) + " · " + (BS.MEDIOS[c.anticipo.medio] || "") + "</b></div>" : "") +
      '<div class="total"><span>Pagás en la barbería</span><b>' + U.pesos(c.precio - abono) + "</b></div></div>" +
      (pendiente && c.pagoUrl ? '<a class="btn btn--lg rs-cta" href="' + esc(c.pagoUrl) + '">Pagar el anticipo de ' + U.pesos(c.anticipo.monto) + "</a>" : "") +
      (pendiente && !c.pagoUrl ? '<p class="rs-nota">El link para pagar el anticipo de ' + U.pesos(c.anticipo.monto) + " te llega por WhatsApp en unos minutos.</p>" : "") +
      (!pendiente && c.mensaje ? '<div class="rs-wa"><p class="rs-wa-k">' + ico("chat") + 'Te llegó esto a tu WhatsApp</p><div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + "Automático</span>" + esc(c.mensaje) + "</div></div>" : "") +
      '<div class="rs-acciones">' + (!pendiente ? '<button class="btn" data-rs="ics">' + ico("cal") + "Agregar a mi calendario</button>" : "") +
      botonesCambio(cn) +
      '<button class="btn btn--ghost" data-rs="otra">Hacer otra reserva</button></div>' +
      (c.direccion ? '<p class="rs-nota">' + ico("ubicacion").replace('class="ic"', 'class="ic" style="width:14px;height:14px;display:inline;vertical-align:-2px"') + " " + esc(c.direccion) + "</p>" : "") + "</div>";
  }

  function unirseRemoto() {
    BS.conexion.unirseFila({ nombre: R.nombre.trim(), tel: R.tel.replace(/\D/g, ""), servicio: R.filaServicio, acepto: R.acepto }).then(function (res) {
      guardarYo();
      remoto.fila = { id: res.id, token: res.token, datos: res };
      escribirLS(claveFila(), { id: res.id, token: res.token });
      render(); sondearFila();
    }).catch(function (err) { toast(err.message); });
  }
  function sondearFila() {
    clearTimeout(remoto.sondeoFila);
    if (!remoto.fila) return;
    BS.conexion.estadoFila(remoto.fila.id, remoto.fila.token).then(function (d) {
      var antes = remoto.fila && remoto.fila.datos && remoto.fila.datos.posicion;
      if (!remoto.fila) return;
      remoto.fila.datos = d;
      remoto.fila.cambio = antes != null && d.posicion !== antes;
      if (!tecleando()) render();
      if (d.estado === "en-fila") remoto.sondeoFila = setTimeout(sondearFila, 5000);
    }).catch(function () { remoto.sondeoFila = setTimeout(sondearFila, 8000); });
  }
  function htmlTurnoRemoto() {
    var d = remoto.fila.datos || {};
    if (d.estado === "te-toca") {
      return '<div class="rs-turno rs-turno--ya"><span class="k">Fila virtual</span><span class="rs-turno-pos">¡Te toca!</span><p>Pasá a la silla de <b>' + esc(d.barbero) + "</b>. Que te quede bien bacano 💈</p></div>" +
        '<button class="btn btn--ghost rs-cta" data-rs="fila-fin">Listo</button>';
    }
    if (d.estado !== "en-fila") {
      return '<div class="rs-turno"><span class="k">Fila virtual</span><p style="font-size:16px">Ya no estás en la fila.</p></div><button class="btn rs-cta" data-rs="fila-fin">Volver a hacer fila</button>';
    }
    var pos = d.posicion;
    var html = '<div class="rs-turno"><span class="k">Tu turno</span><span class="rs-turno-pos' + (remoto.fila.cambio ? " cambia" : "") + '">' + pos + "º</span>" +
      "<p>" + (pos <= 2 ? "<b>¡Ya casi!</b> Salí ya para la barbería 🏃" : "Te toca en unos <b>" + d.espera + " min</b>. Esperá tranquilo en la casa.") + "</p>" +
      '<span class="rs-turno-barra"><span class="poste is-on" style="width:' + Math.max(8, 100 - (pos - 1) * 18) + '%"></span></span></div>';
    html += d.mensaje
      ? '<div class="rs-wa" style="margin-top:14px"><p class="rs-wa-k">' + ico("chat") + 'Te llegó por WhatsApp</p><div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + "Automático</span>" + esc(d.mensaje) + "</div></div>"
      : '<p class="rs-nota" style="margin-top:14px">Te avisamos por WhatsApp cuando falten 2 turnos.</p>';
    html += '<div class="rs-acciones" style="margin-top:14px">' + (d.filaEstado !== "local" ? '<button class="btn" data-rs="fila-llegue">Ya llegué a la barbería</button>' : '<span class="estado estado--ok" style="align-self:center">' + ico("check") + "Estás en el local</span>") +
      '<button class="btn btn--ghost" data-rs="fila-salir">Salir de la fila</button></div>';
    return html;
  }

  /* ---------------- Cabecera de la barbería ---------------- */
  function pintarMarca() {
    var st = BS.get(), s = st.shop, hoy = new Date(), h = BS.horario(hoy), abierto = BS.abiertoAhora();
    $("[data-nombre]").textContent = s.nombre;
    $("[data-lugar]").textContent = s.barrio + ", " + s.ciudad;
    document.title = "Reservá en " + s.nombre + " · Barber SaaS";
    var estado;
    if (abierto) estado = '<span class="punto"></span>Abierto · cierra ' + U.horaMin(h[1]);
    else {
      var prox = null;
      for (var i = 0; i < 8 && !prox; i++) {
        var d = U.addDias(U.hoy0(), i), hh = BS.horario(d);
        if (hh && (i > 0 || U.ahoraMin() < hh[0])) prox = { d: d, h: hh, i: i };
      }
      estado = "Cerrado ahora" + (prox ? " · abre " + (prox.i === 0 ? "hoy" : prox.i === 1 ? "mañana" : U.DIAS[prox.d.getDay()]) + " " + U.horaMin(prox.h[0]) : "");
    }
    $("[data-estado-local]").innerHTML = estado;
    var dias = [1, 2, 3, 4, 5, 6, 0];
    $("[data-datos]").innerHTML =
      // Las reseñas solo aparecen si hay; las de la barbería de ejemplo van marcadas
      (function () {
        var rep = BS.reputacion();
        return rep.total ? '<span class="rs-dato">' + ico("estrella") + "<span>" + String(rep.promedio).replace(".", ",") + " <small>· " + rep.total +
          (rep.ejemplo ? " reseñas (datos de ejemplo)" : rep.total === 1 ? " calificación de clientes" : " calificaciones de clientes") + "</small></span></span>" : "";
      })() +
      '<span class="rs-dato">' + ico("ubicacion") + "<span>" + esc(s.direccion) + "</span></span>" +
      '<span class="rs-dato">' + ico("chat") + "<span>También podés reservar por WhatsApp <small>· responde al instante</small></span></span>" +
      '<div class="rs-horario">' + dias.map(function (d) {
        var hh = s.horario[d], esHoy = d === hoy.getDay();
        return '<b class="' + (esHoy ? "es-hoy" : "") + '">' + U.DIAS[d] + "</b><span" + (esHoy ? ' class="es-hoy"' : "") + ">" + (hh ? U.horaMin(hh[0]) + " – " + U.horaMin(hh[1]) : "Cerrado") + "</span>";
      }).join("") + "</div>";
    var n = st.fila.length;
    var badge = $("[data-fila-n]");
    badge.textContent = abierto && n ? String(n) : "";
    badge.title = n + " personas esperando";
  }

  /* ---------------- Tus citas: ver, mover, cancelar, calificar, repetir ----------------
     Demo: se reconocen por el celular guardado en este navegador.
     Servidor: cada reserva guarda su link firmado (id + token) en este navegador. */
  var KEY_MIS = "barbersaas.misCitas";
  function claveMis() { return KEY_MIS + ":" + ((BS.conexion && BS.conexion.slug) || ""); }
  function guardarMia(id, token) {
    var l = (leer(claveMis()) || []).filter(function (x) { return x.id !== id; });
    l.unshift({ id: id, token: token });
    escribirLS(claveMis(), l.slice(0, 10));
  }
  function cargarMisRemotas() {
    var l = leer(claveMis()) || [];
    if (!l.length) { remoto.mis = []; return Promise.resolve(); }
    return Promise.all(l.map(function (x) {
      return BS.conexion.estadoReserva(x.id, x.token).then(function (c) { return Object.assign({ token: x.token }, c); }, function () { return null; });
    })).then(function (res) { remoto.mis = res.filter(Boolean); if (!tecleando() && capa.hidden) render(); });
  }
  function normRemota(c) {
    return { id: c.id, token: c.token, servicio: c.servicio, barbero: c.barbero, servicioId: c.servicioId, barberoId: c.barberoId, inicio: c.inicio, dur: c.dur,
      estado: c.estado, puedeCambiar: !!c.puedeCambiar, puedeCalificar: !!c.puedeCalificar, calificacion: c.calificacion, anticipo: c.anticipo, pagoUrl: c.pagoUrl };
  }
  function normDemo(c) {
    var s = BS.servicio(c.servicio), b = BS.barbero(c.barbero);
    return { id: c.id, servicio: s ? s.nombre : "Servicio", barbero: b ? b.nombre : "tu barbero", servicioId: c.servicio, barberoId: c.barbero, inicio: c.inicio, dur: c.dur,
      estado: c.estado, puedeCambiar: BS.puedeCambiar(c), puedeCalificar: BS.puedeCalificar(c), calificacion: c.calificacion || null, anticipo: c.anticipo };
  }
  function misCitas() {
    if (enServidor()) return (remoto.mis || []).map(normRemota);
    var tel = String(R.tel || "").replace(/\D/g, "");
    if (!/^3\d{9}$/.test(tel)) return [];
    var cli = BS.get().clientes.filter(function (c) { return String(c.tel).replace(/\D/g, "") === tel; })[0];
    return cli ? BS.get().citas.filter(function (c) { return c.cliente === cli.id; }).map(normDemo) : [];
  }
  function buscarMia(id) {
    var c = misCitas().filter(function (x) { return x.id === id; })[0];
    if (!c && remoto.cita && remoto.cita.id === id) c = normRemota(Object.assign({ token: remoto.token }, remoto.cita));
    if (!c && !enServidor() && BS.cita(id)) c = normDemo(BS.cita(id));
    return c || null;
  }

  function botonesCambio(c) {
    if (!c || !(c.estado === "confirmada" || c.estado === "pendiente")) return "";
    if (!c.puedeCambiar) return '<p class="rs-nota rs-nota--izq">Faltan menos de 2 horas: para cambios escribile a la barbería por WhatsApp.</p>';
    return '<button class="btn btn--suave" data-rs="mover" data-id="' + esc(c.id) + '">' + ico("cal") + 'Cambiar hora</button><button class="btn btn--ghost" data-rs="cancelar-cita" data-id="' + esc(c.id) + '">Cancelar turno</button>';
  }
  function htmlCalificar(c) {
    var n = R.calif[c.id] || 0;
    return '<div class="rs-calif"><b>¿Cómo te fue con ' + esc(c.barbero) + "?</b><small>" + esc(c.servicio) + " · " + esc(U.diaRelativo(c.inicio)) + ". Tu calificación ayuda a otros clientes a escoger.</small>" +
      '<div class="rs-estrellas" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">' + [1, 2, 3, 4, 5].map(function (i) {
        return '<button class="rs-estrella' + (i <= n ? " is-on" : "") + '" role="radio" aria-checked="' + (i === n) + '" aria-label="' + i + (i === 1 ? " estrella" : " estrellas") + '" data-rs="estrella" data-id="' + esc(c.id) + '" data-n="' + i + '">' + ico("estrella") + "</button>";
      }).join("") + "</div>" +
      (n ? '<textarea class="rs-input" rows="2" maxlength="280" data-rs-calif="' + esc(c.id) + '" placeholder="Contale a la barbería qué te gustó (opcional)">' + esc(R.califTxt[c.id] || "") + "</textarea>" +
        '<button class="btn" data-rs="calificar" data-id="' + esc(c.id) + '">Enviar calificación</button>' : "") + "</div>";
  }
  /** Arriba de la página: la próxima cita, la visita por calificar y «¿lo de siempre?». */
  function htmlMisCitas() {
    var mis = misCitas(), ahora = Date.now();
    if (!mis.length) return "";
    var proximas = mis.filter(function (c) { return (c.estado === "confirmada" || c.estado === "pendiente" || c.estado === "en-silla") && new Date(c.inicio).getTime() + c.dur * 60000 > ahora; })
      .sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });
    var porCalificar = mis.filter(function (c) { return c.puedeCalificar && ahora - new Date(c.inicio).getTime() < 30 * 86400000; })
      .sort(function (a, b) { return new Date(b.inicio) - new Date(a.inicio); })[0];
    var ultima = mis.filter(function (c) { return c.estado === "terminada" || (c.estado !== "cancelada" && c.estado !== "no-show" && new Date(c.inicio).getTime() < ahora); })
      .sort(function (a, b) { return new Date(b.inicio) - new Date(a.inicio); })[0];
    var html = proximas.slice(0, 2).map(function (c, i) {
      var falta = c.anticipo && !c.anticipo.pagado;
      return '<div class="rs-mia"><div class="rs-mia-cab"><span class="rs-mia-k">' + (i === 0 ? "Tu próxima cita" : "También tenés") + "</span>" +
        (falta ? '<span class="rs-chip rs-chip--alerta">' + ico("reloj") + "Falta el anticipo</span>" : '<span class="rs-chip rs-chip--ok">' + ico("check") + "Confirmada</span>") + "</div>" +
        "<b>" + esc(c.servicio) + " con " + esc(c.barbero) + "</b><span>" + esc(cap(U.diaRelativo(c.inicio))) + " · " + U.hora(c.inicio) + "</span>" +
        '<div class="rs-mia-acc">' + botonesCambio(c) + (falta && c.pagoUrl ? '<a class="btn" href="' + esc(c.pagoUrl) + '">Pagar anticipo</a>' : "") + "</div></div>";
    }).join("");
    if (porCalificar) html += htmlCalificar(porCalificar);
    if (!proximas.length && ultima && BS.servicio(ultima.servicioId)) {
      html += '<button class="rs-repetir" data-rs="repetir" data-s="' + esc(ultima.servicioId) + '" data-b="' + esc(ultima.barberoId) + '">' + ico("ciclo") +
        "<span><b>¿Lo de siempre?</b><small>" + esc(ultima.servicio) + " con " + esc(ultima.barbero) + " · elegí la hora y listo</small></span>" + ico("flecha") + "</button>";
    }
    return html ? '<section class="rs-mis" aria-label="Tus citas">' + html + "</section>" : "";
  }

  function limpiarSeleccion() { R.servicio = null; R.barbero = null; R.dia = null; R.min = null; }
  function irAlPaso(selector) {
    setTimeout(function () {
      var el = cuerpo.querySelector(selector); if (!el) return;
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 16, behavior: "smooth" });
    }, 30);
  }
  function confirmarCambio() {
    var cb = R.cambiando, btn = cuerpo.querySelector("[data-rs='confirmar-cambio']");
    if (btn) { btn.disabled = true; btn.textContent = "Moviendo tu turno…"; }
    if (enServidor()) {
      BS.conexion.cambiarReserva(cb.id, cb.token, { fecha: U.claveDia(R.dia), min: R.min, barbero: R.barbero }).then(function (c) {
        R.cambiando = null; R.movida = true; limpiarSeleccion();
        remoto.cita = c; remoto.token = cb.token;
        cargarMisRemotas(); render(); window.scrollTo({ top: 0, behavior: "smooth" });
      }).catch(function (err) {
        toast(err.message);
        if (err.status === 409) { R.min = null; BS.conexion.recargarPublico().then(render, render); } else render();
      });
      return;
    }
    var c = BS.moverCita(cb.id, U.enMin(R.dia, R.min), R.barbero);
    if (!c) { R.min = null; toast("Ese turno se acaba de ocupar. Elegí otro, porfa."); render(); return; }
    R.cambiando = null; R.movida = true; R.confirmada = c.id; limpiarSeleccion();
    render(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function pedirCancelar(id) {
    var c = buscarMia(id); if (!c) return;
    R.aCancelar = c;
    var pagado = c.anticipo && c.anticipo.pagado;
    capa.innerHTML = '<div class="rs-pago rs-confirmar" role="dialog" aria-modal="true" aria-labelledby="rs-cancelar-t"><h3 id="rs-cancelar-t">¿Cancelar tu turno?</h3>' +
      "<p>" + esc(c.servicio) + " con " + esc(c.barbero) + ", " + esc(U.diaRelativo(c.inicio)) + " a las " + U.hora(c.inicio) + "</p>" +
      (pagado ? "<p>Pagaste un anticipo de " + U.pesos(c.anticipo.monto) + ": hablalo con la barbería, normalmente queda como abono para tu próxima cita.</p>" : "") +
      "<p>El turno queda libre y se le ofrece a otro cliente.</p>" +
      '<div class="rs-acciones"><button class="btn" data-rs="cancelar-no">No, lo mantengo</button><button class="btn btn--ghost" data-rs="cancelar-si">Sí, cancelar</button></div></div>';
    capa.hidden = false;
    var b = capa.querySelector("[data-rs='cancelar-no']"); if (b) b.focus();
  }
  function cancelarSi() {
    var c = R.aCancelar; R.aCancelar = null;
    capa.hidden = true; capa.innerHTML = "";
    if (!c) return;
    if (enServidor()) {
      BS.conexion.cancelarReserva(c.id, c.token).then(function (cita) {
        if (remoto.cita && remoto.cita.id === c.id) remoto.cita = cita;
        toast("Cancelaste tu turno. Ya quedó libre para otro cliente.", true);
        cargarMisRemotas(); BS.conexion.recargarPublico().then(render, render);
      }).catch(function (err) { toast(err.message); });
      return;
    }
    BS.cancelarCita(c.id, "lo canceló desde su link");
    if (R.confirmada === c.id) { R.confirmada = null; R.movida = false; }
    toast("Cancelaste tu turno. Ya quedó libre para otro cliente.", true);
    render();
  }
  function enviarCalificacion(id) {
    var c = buscarMia(id), n = R.calif[id];
    if (!c || !n) return;
    var txt = (R.califTxt[id] || "").trim();
    if (enServidor()) {
      BS.conexion.calificarReserva(c.id, c.token, { estrellas: n, comentario: txt }).then(function (cita) {
        if (remoto.cita && remoto.cita.id === id) remoto.cita = cita;
        toast("¡Gracias! Tu calificación ya cuenta para " + (BS.get().shop.nombre || "la barbería") + ".", true);
        cargarMisRemotas(); render();
      }).catch(function (err) { toast(err.message); });
      return;
    }
    BS.calificarCita(id, n, txt);
    toast("¡Gracias! Tu calificación ya cuenta para " + BS.get().shop.nombre + ".", true);
    render();
  }
  /** Llegó desde el buscador con servicio, día y hora elegidos: arranca con eso marcado. */
  function preseleccion() {
    var s = params.get("s"), d = params.get("d"), m = params.get("m"), b = params.get("bb");
    if (!s || !BS.servicio(s)) return;
    R.servicio = s; R.barbero = b && BS.barbero(b) ? b : "cualquiera";
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { var p = d.split("-").map(Number); R.dia = new Date(p[0], p[1] - 1, p[2]); }
    if (R.dia && m != null && BS.slotsLibres(R.dia, R.servicio, R.barbero).some(function (x) { return x.min === Number(m); })) R.min = Number(m);
  }

  /* ---------------- Reservar cita ---------------- */
  function diasDisponibles() {
    var out = [];
    for (var i = 0; i < 12 && out.length < 9; i++) {
      var d = U.addDias(U.hoy0(), i);
      if (!BS.horario(d)) continue;
      out.push({ d: d, i: i, libres: R.servicio ? BS.slotsLibres(d, R.servicio, R.barbero || "cualquiera").length : 1 });
    }
    return out;
  }

  /** Debajo del nombre del barbero: sus especialidades y su calificación real (si ya tiene). */
  function textoBarbero(b) {
    var rep = BS.reputacion(b.id), cal = rep.ejemplo ? String(rep.promedio).replace(".", ",") + " ★" : rep.total ? String(rep.promedio).replace(".", ",") + " ★ (" + rep.total + ")" : "";
    return [(b.especialidades || []).join(" · "), cal].filter(Boolean).join(" · ") || (b.modo === "dueno" ? "Dueño" : "Barbero");
  }
  function paso(n, titulo, estado, resumen, contenido) {
    return '<section class="rs-paso ' + estado + '" aria-labelledby="paso-' + n + '"><div class="rs-paso-cab"><span class="rs-paso-n">' + (estado.indexOf("is-hecho") >= 0 ? ico("check") : n) + "</span>" +
      '<h2 id="paso-' + n + '">' + titulo + "</h2>" + (resumen || "") + '</div><div class="rs-paso-cuerpo">' + contenido + "</div></section>";
  }

  function htmlCita() {
    if (enServidor() && BS.conexion.noEncontrada) return '<div class="rs-ok"><h2>No encontramos esta barbería</h2><p>Revisá el link que te pasaron.</p></div>';
    if (enServidor() && remoto.cita) return htmlConfirmadaRemota();
    if (R.confirmada) return htmlConfirmada();
    var st = BS.get(), cb = R.cambiando;
    var s1 = !!R.servicio, s2 = !!R.barbero, s3 = R.min != null && R.dia, s4 = cb ? true : R.datosOk;
    var srv = R.servicio ? BS.servicio(R.servicio) : null;
    // Moviendo una cita: se avisa arriba; si no, arriba van las citas del cliente
    var html = cb ? '<div class="rs-cambio">' + ico("cal") + "<div><b>Estás moviendo tu turno de " + esc(U.diaRelativo(cb.inicio)) + ", " + U.hora(cb.inicio) + "</b>" +
      "<span>Elegí la nueva hora. Tu anticipo, si lo pagaste, sigue valiendo.</span></div>" + '<button class="btn btn--ghost btn--sm" data-rs="cambio-no">No cambiar</button></div>' : htmlMisCitas();

    html += paso(1, "¿Qué te vas a hacer?", s1 ? "is-hecho is-plegado" : "",
      s1 ? (cb ? '<span class="resumen">' + esc(srv.nombre) + "</span>" : '<button class="resumen" data-rs="editar" data-p="1">' + esc(srv.nombre) + " · " + U.pesos(srv.precio) + "</button>") : "",
      '<div class="rs-servicios">' + st.servicios.map(function (s) {
        return '<button class="rs-opcion' + (R.servicio === s.id ? " is-on" : "") + '" data-rs="servicio" data-id="' + s.id + '"><b>' + esc(s.nombre) + "</b><small>" + esc(s.desc || "") + " · " + s.dur + ' min</small><span class="precio">' + U.pesos(s.precio) + "</span></button>";
      }).join("") + "</div>");

    var bNombre = R.barbero === "cualquiera" ? "El que esté libre" : R.barbero ? BS.barbero(R.barbero).nombre : "";
    html += paso(2, "¿Con quién?", !s1 ? "is-bloqueado" : s2 ? "is-hecho is-plegado" : "",
      s2 ? '<button class="resumen" data-rs="editar" data-p="2">' + esc(bNombre) + "</button>" : "",
      '<div class="rs-barberos"><button class="rs-barbero rs-barbero--libre' + (R.barbero === "cualquiera" ? " is-on" : "") + '" data-rs="barbero" data-id="cualquiera"><span class="avatar"><span class="poste is-on"></span></span><b>El que esté libre</b><small>Más turnos disponibles</small></button>' +
      st.barberos.map(function (b) {
        return '<button class="rs-barbero' + (R.barbero === b.id ? " is-on" : "") + '" data-rs="barbero" data-id="' + b.id + '"><span class="avatar">' + esc(U.iniciales(b.nombre)) + "</span><b>" + esc(b.nombre) + (b.alias ? ' <small style="display:inline">«' + esc(b.alias) + "»</small>" : "") + "</b><small>" + esc(textoBarbero(b)) + "</small></button>";
      }).join("") + "</div>");

    var contenido3 = "";
    if (s1 && s2) {
      var dias = diasDisponibles();
      if (!R.dia) { var primero = dias.filter(function (x) { return x.libres > 0; })[0]; if (primero) R.dia = primero.d; }
      contenido3 += '<div class="rs-dias" role="group" aria-label="Día">' + dias.map(function (x) {
        var on = R.dia && U.mismoDia(R.dia, x.d);
        return '<button class="rs-dia' + (on ? " is-on" : "") + '" data-rs="dia" data-i="' + x.i + '"' + (x.libres ? "" : " disabled") + ' aria-pressed="' + on + '"><small>' + (x.i === 0 ? "hoy" : x.i === 1 ? "mañana" : U.DIAS_CORTO[x.d.getDay()]) + "</small><b>" + x.d.getDate() + "</b></button>";
      }).join("") + "</div>";
      var slots = R.dia ? BS.slotsLibres(R.dia, R.servicio, R.barbero) : [];
      if (!slots.length) contenido3 += '<p class="sub">No quedan turnos este día. Probá otro.</p>';
      [["Mañana", 0, 719], ["Tarde", 720, 1079], ["Noche", 1080, 1440]].forEach(function (f) {
        var g = slots.filter(function (s) { return s.min >= f[1] && s.min <= f[2]; });
        if (!g.length) return;
        contenido3 += '<p class="rs-franja">' + f[0] + '</p><div class="rs-slots">' + g.map(function (s) {
          return '<button class="rs-slot' + (R.min === s.min ? " is-on" : "") + '" data-rs="slot" data-min="' + s.min + '">' + U.horaCorta(s.min) + "</button>";
        }).join("") + "</div>";
      });
    }
    html += paso(3, "¿Cuándo?", !(s1 && s2) ? "is-bloqueado" : s3 ? "is-hecho is-plegado" : "",
      s3 ? '<button class="resumen" data-rs="editar" data-p="3">' + esc(U.diaRelativo(R.dia).replace(/^el /, "")) + " · " + U.horaMin(R.min) + "</button>" : "", contenido3);

    if (cb) {
      var bN = R.barbero === "cualquiera" ? "El que esté libre" : R.barbero ? BS.barbero(R.barbero).nombre : "";
      html += paso(4, "Confirmá el cambio", !s3 ? "is-bloqueado" : "", "", s3 ? '<div class="rs-resumen"><div><span>Antes</span><b class="rs-tachado">' + esc(cap(U.diaRelativo(cb.inicio))) + " · " + U.hora(cb.inicio) + "</b></div>" +
        "<div><span>Ahora</span><b>" + esc(cap(U.diaRelativo(U.enMin(R.dia, R.min)))) + " · " + U.horaMin(R.min) + "</b></div><div><span>Con</span><b>" + esc(bN) + "</b></div></div>" +
        '<button class="btn btn--lg rs-cta" data-rs="confirmar-cambio">Mover mi turno</button>' : "");
      return html;
    }

    var contenido4 = '<div class="rs-form"><div class="rs-campo"><label for="rs-nombre">Tu nombre</label><input class="rs-input" id="rs-nombre" data-rs-campo="nombre" autocomplete="name" value="' + esc(R.nombre) + '"' + (R.errores.nombre ? ' aria-invalid="true"' : "") + ' placeholder="Como te dicen en la barbería"></div>' +
      '<div class="rs-campo"><label for="rs-tel">Celular con WhatsApp</label><div class="rs-tel"><span>+57</span><input class="rs-input" id="rs-tel" data-rs-campo="tel" inputmode="numeric" autocomplete="tel-national" maxlength="12" value="' + esc(R.tel) + '"' + (R.errores.tel ? ' aria-invalid="true"' : "") + ' placeholder="300 123 4567"></div>' +
      (R.errores.tel ? '<span class="rs-error">' + esc(R.errores.tel) + "</span>" : "") + "</div>" +
      '<label class="rs-check"><input type="checkbox" data-rs-campo="acepto"' + (R.acepto ? " checked" : "") + "><span>Acepto que " + esc(st.shop.nombre) + " me escriba por WhatsApp para confirmar y recordar mi cita.</span></label>" +
      (R.errores.acepto ? '<span class="rs-error">' + esc(R.errores.acepto) + "</span>" : "") +
      '<button class="btn rs-cta" data-rs="datos">Continuar' + ico("flecha") + "</button></div>";
    html += paso(4, "Tus datos", !s3 ? "is-bloqueado" : s4 ? "is-hecho is-plegado" : "",
      s4 ? '<button class="resumen" data-rs="editar" data-p="4">' + esc(U.primerNombre(R.nombre)) + " · " + esc(U.telefonoBonito(R.tel)) + "</button>" : "", contenido4);

    var contenido5 = "";
    if (s4) {
      var a = st.shop.anticipo, anticipo = BS.montoAnticipo(srv.precio);
      if (a.activo && anticipo > 0) {
        var medios = ["breb", "nequi", "daviplata", "pse", "tarjeta"].filter(function (m) { return st.shop.medios[m]; });
        if (medios.indexOf(R.medio) < 0) R.medio = medios[0];
        var desc = { breb: ["Bre-B", "Desde la app de tu banco, al instante"], nequi: ["Nequi", "Te llega la notificación a la app"], daviplata: ["Daviplata", "Desde tu Daviplata"], pse: ["PSE", "Débito desde tu cuenta"], tarjeta: ["Tarjeta", "Crédito o débito"] };
        contenido5 += '<p class="sub" style="margin-bottom:12px;font-size:14px">Para separar tu turno pagás ' + U.pesos(anticipo) + " ahora y el resto en la barbería. Si no podés ir, avisás y lo movemos.</p>" +
          '<div class="rs-medios" role="radiogroup" aria-label="Medio de pago">' + medios.map(function (m) {
            return '<button class="rs-medio' + (R.medio === m ? " is-on" : "") + '" role="radio" aria-checked="' + (R.medio === m) + '" data-rs="medio" data-m="' + m + '"><span class="rs-medio-radio"></span><span><b>' + desc[m][0] + "</b><small>" + desc[m][1] + "</small></span>" + (m === "breb" ? '<span class="rs-medio-tag">Al instante</span>' : "") + "</button>";
          }).join("") + "</div>";
        contenido5 += '<div class="rs-resumen"><div><span>' + esc(srv.nombre) + " · " + esc(bNombre) + "</span><b>" + U.pesos(srv.precio) + "</b></div>" +
          "<div><span>" + esc(U.fechaLarga(R.dia)) + "</span><b>" + U.horaMin(R.min) + "</b></div>" +
          "<div><span>Pagás en la barbería</span><b>" + U.pesos(srv.precio - anticipo) + '</b></div><div class="total"><span>Anticipo hoy</span><b>' + U.pesos(anticipo) + "</b></div></div>" +
          '<button class="btn btn--lg rs-cta" data-rs="pagar">Pagar ' + U.pesos(anticipo) + " y reservar</button>" +
          '<p class="rs-nota">' + ico("escudo").replace('class="ic"', 'class="ic" style="width:14px;height:14px;display:inline;vertical-align:-2px"') + (enServidor() ? " Te llevamos a la pasarela de pago segura de la barbería." : " Demo: no se cobra plata real.") + "</p>";
      } else {
        contenido5 += '<div class="rs-resumen"><div><span>' + esc(srv.nombre) + " · " + esc(bNombre) + "</span><b>" + U.pesos(srv.precio) + "</b></div><div><span>" + esc(U.fechaLarga(R.dia)) + "</span><b>" + U.horaMin(R.min) + "</b></div></div>" +
          '<button class="btn btn--lg rs-cta" data-rs="reservar">Reservar turno</button>';
      }
    }
    html += paso(5, st.shop.anticipo.activo ? "Separá tu turno" : "Confirmá", !s4 ? "is-bloqueado" : "", "", contenido5);
    return html;
  }

  function htmlConfirmada() {
    var c = BS.cita(R.confirmada);
    if (!c) { R.confirmada = null; return htmlCita(); }
    var srv = BS.servicio(c.servicio), b = BS.barbero(c.barbero), cli = BS.cliente(c.cliente);
    var auto = BS.autoPorClave("confirmacion");
    var msg = auto && auto.activa ? BS.render(auto.plantilla, BS.varsCita(c)) : "";
    var abono = c.anticipo && c.anticipo.pagado ? c.anticipo.monto : 0;
    return '<div class="rs-ok"><span class="rs-ok-ico">' + ico("check") + "</span><h2>" + (R.movida ? "¡Listo, movimos tu turno!" : "¡Listo, " + esc(U.primerNombre(cli.nombre)) + "!") + "</h2><p>" +
      (R.movida ? "Te llega la confirmación con la hora nueva por WhatsApp." : "Tu turno quedó reservado. Te esperamos en " + esc(BS.get().shop.nombre) + ".") + "</p>" +
      '<div class="rs-resumen"><div><span>Servicio</span><b>' + esc(srv.nombre) + "</b></div><div><span>Barbero</span><b>" + esc(b.nombre) + "</b></div>" +
      "<div><span>Día</span><b>" + esc(U.fechaLarga(c.inicio)) + "</b></div><div><span>Hora</span><b>" + U.hora(c.inicio) + "</b></div>" +
      (abono ? "<div><span>Anticipo pagado</span><b>" + U.pesos(abono) + " · " + BS.MEDIOS[c.anticipo.medio] + '</b></div><div class="total"><span>Pagás en la barbería</span><b>' + U.pesos(c.precio - abono) + "</b></div>" : '<div class="total"><span>Pagás en la barbería</span><b>' + U.pesos(c.precio) + "</b></div>") + "</div>" +
      (msg ? '<div class="rs-wa"><p class="rs-wa-k">' + ico("chat") + 'Te llegó esto a tu WhatsApp</p><div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + "Automático</span>" + esc(msg) + '<span class="msg-meta">' + U.hora(new Date()) + "</span></div></div>" : "") +
      '<div class="rs-acciones"><button class="btn" data-rs="ics">' + ico("cal") + "Agregar a mi calendario</button>" + botonesCambio(normDemo(c)) + '<button class="btn btn--ghost" data-rs="otra">Hacer otra reserva</button>' +
      '<a class="btn btn--suave" href="../app/index.html' + (BS.esEjemplo() ? "?demo=1" : "") + '#/agenda" target="_blank" rel="noopener">Ver la cita en el panel de la barbería (demo)' + ico("flecha") + "</a></div></div>";
  }

  /* ---------------- Fila virtual ---------------- */
  function miFila() { return R.filaId ? BS.get().fila.filter(function (f) { return f.id === R.filaId; })[0] || null : null; }

  function htmlFila() {
    if (enServidor() && BS.conexion.noEncontrada) return '<div class="rs-ok"><h2>No encontramos esta barbería</h2><p>Revisá el link que te pasaron.</p></div>';
    if (enServidor() && remoto.fila) return htmlTurnoRemoto();
    var st = BS.get(), abierto = BS.abiertoAhora(), fila = BS.filaOrdenada();
    R.filaServicio = BS.servicioValido(R.filaServicio); // cada barbería tiene sus propios servicios
    var mia = miFila();
    if (R.filaId && !mia) {
      var c = st.citas.filter(function (x) { return x.fuente === "fila" && x.estado === "en-silla" && R.teTocaCliente && x.cliente === R.teTocaCliente; })[0];
      R.teToca = c ? c.id : R.teToca;
      R.filaId = null; escribirLS(KEY_FILA, null);
    }
    if (R.teToca) {
      var ct = BS.cita(R.teToca);
      return '<div class="rs-turno rs-turno--ya"><span class="k">Fila virtual</span><span class="rs-turno-pos">¡Te toca!</span><p>Pasá a la silla de <b>' + esc(ct ? BS.barbero(ct.barbero).nombre : "tu barbero") + "</b>. Que te quede bien bacano 💈</p></div>" +
        '<button class="btn btn--ghost rs-cta" data-rs="fila-fin">Listo</button>';
    }
    if (mia) {
      var pos = fila.map(function (f) { return f.id; }).indexOf(mia.id) + 1;
      var cambio = R.ultimaPos != null && pos !== R.ultimaPos;
      R.ultimaPos = pos;
      var espera = BS.esperaFila(pos);
      var auto = BS.autoPorClave("fila");
      var html = '<div class="rs-turno"><span class="k">Tu turno</span><span class="rs-turno-pos' + (cambio ? " cambia" : "") + '">' + pos + "º</span>" +
        "<p>" + (pos <= 2 ? "<b>¡Ya casi!</b> Salí ya para la barbería 🏃" : "Te toca en unos <b>" + espera + " min</b>. Esperá tranquilo en la casa.") + "</p>" +
        '<span class="rs-turno-barra"><span class="poste is-on" style="width:' + Math.max(8, 100 - (pos - 1) * 18) + '%"></span></span></div>';
      if (pos <= 2 && mia.avisado && auto) {
        html += '<div class="rs-wa" style="margin-top:14px"><p class="rs-wa-k">' + ico("chat") + 'Te llegó por WhatsApp</p><div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + "Automático</span>" +
          esc(BS.render(auto.plantilla, Object.assign(BS.varsEjemplo(), { nombre: U.primerNombre(mia.nombre), posicion: pos + "º" }))) + "</div></div>";
      } else {
        html += '<p class="rs-nota" style="margin-top:14px">' + ico("chat").replace('class="ic"', 'class="ic" style="width:14px;height:14px;display:inline;vertical-align:-2px"') + " Te avisamos por WhatsApp cuando falten 2 turnos.</p>";
      }
      html += '<div class="rs-acciones" style="margin-top:14px">' + (mia.estado !== "local" ? '<button class="btn" data-rs="fila-llegue">Ya llegué a la barbería</button>' : '<span class="estado estado--ok" style="align-self:center">' + ico("check") + "Estás en el local</span>") +
        '<button class="btn btn--ghost" data-rs="fila-salir">Salir de la fila</button></div>';
      return html;
    }
    if (!abierto) {
      return '<div class="rs-turno"><span class="k">Fila virtual</span><p style="font-size:16px">La fila abre cuando abre la barbería.</p><p>Mientras tanto podés reservar una cita.</p></div><button class="btn rs-cta" data-rs="modo" data-m="cita">Reservar cita</button>';
    }
    var html2 = '<div class="rs-fila-vivo"><div><b>' + fila.length + "</b><small>" + (fila.length === 1 ? "persona esperando" : "personas esperando") + "</small></div><div><b>~" + BS.esperaFila(fila.length + 1) + ' min</b><small>espera si entrás ya</small></div></div>' +
      '<p class="sub" style="font-size:14px;margin-bottom:14px">¿Llegaste sin cita? Hacé la fila desde tu casa: te avisamos por WhatsApp cuando falten 2 turnos.</p>' +
      '<div class="rs-form"><div class="rs-campo"><span class="rs-campo-k" style="font-size:13px;color:var(--humo);font-weight:500">¿Qué te vas a hacer?</span><div class="rs-servicios">' +
      BS.get().servicios.slice(0, 3).map(function (sv) { return sv.id; }).map(function (id) {
        var s = BS.servicio(id);
        return '<button class="rs-opcion' + (R.filaServicio === id ? " is-on" : "") + '" data-rs="fila-servicio" data-id="' + id + '"><b>' + esc(s.nombre) + "</b><small>" + s.dur + ' min</small><span class="precio">' + U.pesos(s.precio) + "</span></button>";
      }).join("") + "</div></div>" +
      '<div class="rs-campo"><label for="rs-fnombre">Tu nombre</label><input class="rs-input" id="rs-fnombre" data-rs-campo="nombre" value="' + esc(R.nombre) + '"' + (R.errores.nombre ? ' aria-invalid="true"' : "") + ' placeholder="Como te dicen en la barbería"></div>' +
      '<div class="rs-campo"><label for="rs-ftel">Celular con WhatsApp</label><div class="rs-tel"><span>+57</span><input class="rs-input" id="rs-ftel" data-rs-campo="tel" inputmode="numeric" maxlength="12" value="' + esc(R.tel) + '"' + (R.errores.tel ? ' aria-invalid="true"' : "") + ' placeholder="300 123 4567"></div>' + (R.errores.tel ? '<span class="rs-error">' + esc(R.errores.tel) + "</span>" : "") + "</div>" +
      '<label class="rs-check"><input type="checkbox" data-rs-campo="acepto"' + (R.acepto ? " checked" : "") + "><span>Acepto que me escriban por WhatsApp para avisarme mi turno.</span></label>" +
      (R.errores.acepto ? '<span class="rs-error">' + esc(R.errores.acepto) + "</span>" : "") +
      '<button class="btn btn--lg rs-cta" data-rs="fila-unirme">' + ico("fila") + "Hacer fila</button></div>";
    return html2;
  }

  /* ---------------- Render y acciones ---------------- */
  function render() {
    pintarMarca();
    document.querySelectorAll("[data-modo]").forEach(function (b) {
      var on = b.getAttribute("data-modo") === R.modo;
      b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on));
    });
    cuerpo.innerHTML = R.modo === "fila" ? htmlFila() : htmlCita();
  }

  function validarDatos() {
    R.errores = {};
    var tel = R.tel.replace(/\D/g, "");
    if (R.nombre.trim().length < 2) R.errores.nombre = "Escribí tu nombre";
    if (!/^3\d{9}$/.test(tel)) R.errores.tel = "Revisá el celular: son 10 dígitos y empieza por 3.";
    if (!R.acepto) R.errores.acepto = "Necesitamos tu permiso para mandarte la confirmación por WhatsApp.";
    return !Object.keys(R.errores).length;
  }
  function guardarYo() { escribirLS(KEY_YO, { nombre: R.nombre.trim(), tel: R.tel.replace(/\D/g, "") }); }

  function toast(texto, ok) {
    var el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML = '<span class="toast-ico toast-ico--' + (ok ? "ok" : "alerta") + '">' + ico(ok ? "check" : "reloj") + "</span><div><small>" + (ok ? "Listo" : "Ojo") + "</small><p>" + esc(texto) + "</p></div>";
    toastsEl.appendChild(el);
    setTimeout(function () { el.classList.add("is-saliendo"); setTimeout(function () { el.remove(); }, 320); }, 4500);
  }

  function crearReserva(medio) {
    var srv = BS.servicio(R.servicio);
    var libre = BS.slotsLibres(R.dia, R.servicio, R.barbero).filter(function (s) { return s.min === R.min; })[0];
    if (!libre) { R.min = null; toast("Ese turno se acaba de ocupar. Elegí otro, porfa."); render(); return null; }
    var conAnticipo = !!medio;
    var cita = BS.crearCita({
      nombre: R.nombre.trim(), tel: R.tel.replace(/\D/g, ""), barbero: R.barbero === "cualquiera" ? libre.barbero : R.barbero, servicio: R.servicio,
      inicio: U.enMin(R.dia, R.min), fuente: "web", estado: "confirmada",
      anticipo: conAnticipo ? { monto: BS.montoAnticipo(srv.precio), medio: medio, pagado: true, fecha: new Date().toISOString() } : null
    });
    if (conAnticipo) BS.actividad({ tipo: "plata", texto: "Anticipo recibido por " + BS.MEDIOS[medio] + " · " + U.nombreCorto(R.nombre) + " reservó desde el link", monto: cita.anticipo.monto, toast: true });
    BS.commit("reserva-web");
    guardarYo();
    R.confirmada = cita.id;
    return cita;
  }

  function pagoSimulado() {
    var srv = BS.servicio(R.servicio), monto = BS.montoAnticipo(srv.precio);
    var medio = R.medio;
    capa.innerHTML = '<div class="rs-pago" role="dialog" aria-modal="true" aria-label="Pago del anticipo"><span class="rs-pago-marca">' + BS.MEDIOS[medio] + " · pago simulado</span><h3>Confirmá el pago</h3>" +
      '<span class="rs-pago-monto num">' + U.pesos(monto) + "</span><p>Anticipo para " + esc(srv.nombre) + " · " + esc(BS.get().shop.nombre) + '</p><span class="poste"></span><p>Esperando la aprobación de tu banco…</p></div>';
    capa.hidden = false;
    setTimeout(function () {
      var cita = crearReserva(medio);
      if (!cita) { capa.hidden = true; return; }
      capa.innerHTML = '<div class="rs-pago" role="dialog" aria-modal="true" aria-label="Pago aprobado"><span class="rs-pago-ok">' + ico("check") + '</span><h3>Pago aprobado</h3><p>' + U.pesos(monto) + " · " + BS.MEDIOS[medio] + " · Ref. " + Math.floor(100000 + Math.random() * 900000) + "</p></div>";
      setTimeout(function () { capa.hidden = true; capa.innerHTML = ""; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }, 1100);
    }, 1900);
  }

  function descargarICS() {
    var st = BS.get(), datos;
    if (enServidor() && remoto.cita) {
      var rc = remoto.cita;
      datos = { id: rc.id, inicio: rc.inicio, fin: new Date(new Date(rc.inicio).getTime() + rc.dur * 60000), servicio: rc.servicio, barbero: rc.barbero, barberia: rc.barberia, direccion: rc.direccion };
    } else {
      var c = BS.cita(R.confirmada); if (!c) return;
      datos = { id: c.id, inicio: c.inicio, fin: BS.finCita(c), servicio: BS.servicio(c.servicio).nombre, barbero: BS.barbero(c.barbero).nombre, barberia: st.shop.nombre, direccion: st.shop.direccion + ", " + st.shop.ciudad };
    }
    function f(d) { return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Barber SaaS//Reservas//ES", "BEGIN:VEVENT",
      "UID:" + datos.id + "@barbersaas", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(datos.inicio), "DTEND:" + f(datos.fin),
      "SUMMARY:" + datos.servicio + " en " + datos.barberia, "DESCRIPTION:Con " + datos.barbero + ". Reservado con Barber SaaS.", "LOCATION:" + datos.direccion,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Tu turno en la barbería", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url; a.download = "turno-barberia.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function accion(el) {
    var a = el.getAttribute("data-rs");
    switch (a) {
      case "servicio": R.servicio = el.getAttribute("data-id"); R.min = null; break;
      case "barbero": R.barbero = el.getAttribute("data-id"); R.min = null; break;
      case "dia": R.dia = U.addDias(U.hoy0(), Number(el.getAttribute("data-i"))); R.min = null; break;
      case "slot": R.min = Number(el.getAttribute("data-min")); break;
      case "editar":
        var p = Number(el.getAttribute("data-p"));
        if (p === 1) { R.servicio = null; R.min = null; }
        if (p === 2) { R.barbero = null; R.min = null; }
        if (p === 3) { R.min = null; }
        if (p === 4) { R.datosOk = false; }
        break;
      case "datos":
        if (!validarDatos()) break;
        R.datosOk = true; guardarYo(); break;
      case "medio": R.medio = el.getAttribute("data-m"); break;
      case "pagar": if (enServidor()) reservarRemoto(); else pagoSimulado(); return;
      case "reservar":
        if (enServidor()) { reservarRemoto(); return; }
        if (crearReserva(null)) { render(); window.scrollTo({ top: 0, behavior: "smooth" }); } return;
      case "ics": descargarICS(); return;
      case "otra":
        R.confirmada = null; R.servicio = null; R.barbero = null; R.min = null; R.dia = null; R.datosOk = false; R.movida = false; R.cambiando = null;
        if (remoto.cita) { remoto.cita = null; clearTimeout(remoto.sondeoCita); history.replaceState(null, "", location.pathname + "?b=" + encodeURIComponent(BS.conexion.slug)); BS.conexion.recargarPublico().then(render, render); }
        break;
      case "modo": R.modo = el.getAttribute("data-m"); break;
      case "fila-servicio": R.filaServicio = el.getAttribute("data-id"); break;
      case "fila-unirme":
        if (!validarDatos()) break;
        if (enServidor()) { unirseRemoto(); break; }
        guardarYo();
        var f = BS.unirseFila({ nombre: R.nombre.trim(), tel: R.tel.replace(/\D/g, ""), via: "web", servicio: R.filaServicio });
        R.filaId = f.id; R.teTocaCliente = f.cliente; R.ultimaPos = null; escribirLS(KEY_FILA, f.id);
        break;
      case "fila-llegue":
        if (enServidor() && remoto.fila) {
          BS.conexion.post("publico/" + encodeURIComponent(BS.conexion.slug) + "/fila/" + encodeURIComponent(remoto.fila.id) + "/llegue?t=" + encodeURIComponent(remoto.fila.token), {})
            .then(function (d) { remoto.fila.datos = d; render(); }).catch(function (err) { toast(err.message); });
          return;
        }
        var mia = miFila(); if (mia) { mia.estado = "local"; BS.commit("fila"); }
        break;
      case "fila-salir":
        if (enServidor() && remoto.fila) {
          var fs = remoto.fila;
          remoto.fila = null; escribirLS(claveFila(), null); clearTimeout(remoto.sondeoFila);
          BS.conexion.salirFila(fs.id, fs.token).catch(function () {}).then(function () { BS.conexion.recargarPublico().then(render, render); });
          break;
        }
        if (R.filaId) BS.salirFila(R.filaId);
        R.filaId = null; escribirLS(KEY_FILA, null);
        break;
      case "fila-fin":
        R.teToca = null;
        if (enServidor()) { remoto.fila = null; escribirLS(claveFila(), null); clearTimeout(remoto.sondeoFila); }
        break;
      /* Tus citas */
      case "mover":
        var cm = buscarMia(el.getAttribute("data-id")); if (!cm) return;
        R.cambiando = cm; R.modo = "cita"; R.confirmada = null; R.movida = false;
        if (remoto.cita) { remoto.cita = null; clearTimeout(remoto.sondeoCita); }
        R.servicio = BS.servicio(cm.servicioId) ? cm.servicioId : null;
        R.barbero = BS.barbero(cm.barberoId) ? cm.barberoId : "cualquiera"; R.min = null;
        R.dia = new Date(cm.inicio); R.dia.setHours(0, 0, 0, 0); // arranca en el día de su cita
        render(); window.scrollTo({ top: 0, behavior: "smooth" }); return;
      case "cambio-no": R.cambiando = null; limpiarSeleccion(); break;
      case "confirmar-cambio": confirmarCambio(); return;
      case "cancelar-cita": pedirCancelar(el.getAttribute("data-id")); return;
      case "cancelar-no": R.aCancelar = null; capa.hidden = true; capa.innerHTML = ""; return;
      case "cancelar-si": cancelarSi(); return;
      case "estrella": R.calif[el.getAttribute("data-id")] = Number(el.getAttribute("data-n")); break;
      case "calificar": enviarCalificacion(el.getAttribute("data-id")); return;
      case "repetir":
        R.modo = "cita"; R.confirmada = null; R.movida = false; R.cambiando = null;
        if (remoto.cita) { remoto.cita = null; clearTimeout(remoto.sondeoCita); }
        R.servicio = BS.servicio(el.getAttribute("data-s")) ? el.getAttribute("data-s") : null;
        R.barbero = R.servicio && BS.barbero(el.getAttribute("data-b")) ? el.getAttribute("data-b") : R.servicio ? "cualquiera" : null;
        R.dia = null; R.min = null;
        render(); irAlPaso("#paso-3"); return;
      default: return;
    }
    render();
    var activo = cuerpo.querySelector(".rs-paso:not(.is-hecho):not(.is-bloqueado)");
    if (activo && a !== "medio" && a !== "slot" && a !== "dia") {
      var r = activo.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + r.top - 16, behavior: "smooth" });
    }
  }

  function boot() {
    cuerpo = $("[data-rs-cuerpo]"); capa = $("[data-capa]"); toastsEl = $("[data-toasts]");
    if (enServidor()) {
      R.filaId = null;
      var guardada = leer(claveFila());
      if (guardada && guardada.id) { remoto.fila = { id: guardada.id, token: guardada.token, datos: null }; R.modo = "fila"; sondearFila(); }
      if (params.get("cita") && params.get("t")) { R.modo = "cita"; guardarMia(params.get("cita"), params.get("t")); cargarCitaRemota(params.get("cita"), params.get("t"), 0); }
      cargarMisRemotas();
    } else {
      var mia = miFila(); if (mia) R.teTocaCliente = mia.cliente;
      if (R.filaId && !mia) { R.filaId = null; escribirLS(KEY_FILA, null); }
    }
    document.addEventListener("click", function (e) {
      var tab = e.target.closest("[data-modo]");
      if (tab) { R.modo = tab.getAttribute("data-modo"); R.errores = {}; render(); return; }
      var el = e.target.closest("[data-rs]");
      if (el) { e.preventDefault(); accion(el); }
    });
    if (!params.get("cita")) preseleccion();
    document.addEventListener("input", function (e) {
      if (e.target.hasAttribute("data-rs-calif")) { R.califTxt[e.target.getAttribute("data-rs-calif")] = e.target.value; return; }
      var k = e.target.getAttribute("data-rs-campo");
      if (k === "nombre") R.nombre = e.target.value;
      if (k === "tel") R.tel = e.target.value;
    });
    document.addEventListener("change", function (e) {
      if (e.target.getAttribute("data-rs-campo") === "acepto") R.acepto = e.target.checked;
    });
    BS.subscribe(function () {
      var activo = document.activeElement;
      if (activo && activo.matches && activo.matches("input, textarea")) { pintarMarca(); return; }
      if (!capa.hidden) return;
      render();
    });
    render();
    setInterval(function () { if (!tecleando() && capa.hidden) render(); }, 30000);
  }
  function arrancar() {
    (BS.listo || Promise.resolve()).then(boot, function (err) {
      var c = $("[data-rs-cuerpo]");
      if (c) c.innerHTML = '<div class="rs-ok"><h2>No pudimos cargar los turnos</h2><p>' + esc((err && err.message) || "Revisá tu conexión") + '</p><button class="btn rs-cta" onclick="location.reload()">Intentar de nuevo</button></div>';
    });
  }
  if (document.readyState === "complete") arrancar(); else document.addEventListener("DOMContentLoaded", arrancar);
})();
