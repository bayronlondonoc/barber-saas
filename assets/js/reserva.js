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
    tijeras: '<circle cx="6" cy="6.5" r="3"/><circle cx="6" cy="17.5" r="3"/><path d="M8.6 8.1L20 18M8.6 15.9L20 6"/>'
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
    medio: "breb", confirmada: null, filaId: leer(KEY_FILA), filaServicio: "s1", ultimaPos: null, teToca: null
  };
  var cuerpo, capa, toastsEl;

  /* ---------------- Conectado al servidor ---------------- */
  function enServidor() { return BS.conexion && BS.conexion.modo === "servidor"; }
  var remoto = { cita: null, token: null, sondeoCita: null, fila: null, sondeoFila: null };
  function claveFila() { return KEY_FILA + ":" + (BS.conexion.slug || ""); }
  function tecleando() { var a = document.activeElement; return a && a.matches && a.matches("input"); }

  function reservarRemoto() {
    var btn = cuerpo.querySelector("[data-rs='pagar'], [data-rs='reservar']");
    if (btn) { btn.disabled = true; btn.textContent = "Reservando…"; }
    BS.conexion.reservar({
      servicio: R.servicio, barbero: R.barbero, fecha: U.claveDia(R.dia), min: R.min, nombre: R.nombre.trim(),
      tel: R.tel.replace(/\D/g, ""), acepto: R.acepto, medio: R.medio
    }).then(function (res) {
      guardarYo();
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
    if (c.estado === "cancelada") return '<div class="rs-ok"><h2>Esta reserva se canceló</h2><p>Si querés, hacé una nueva.</p><button class="btn btn--lg rs-cta" data-rs="otra">Hacer otra reserva</button></div>';
    var abono = c.anticipo && c.anticipo.pagado ? c.anticipo.monto : 0;
    return '<div class="rs-ok">' + (pendiente
        ? '<span class="rs-ok-ico" style="background:var(--alerta);box-shadow:0 0 0 10px var(--alerta-suave)">' + ico("reloj") + "</span><h2>Falta el anticipo</h2><p>Tu turno está apartado mientras confirmamos el pago. Esta página se actualiza sola.</p>"
        : '<span class="rs-ok-ico">' + ico("check") + "</span><h2>¡Listo" + (c.cliente ? ", " + esc(c.cliente) : "") + "!</h2><p>Tu turno quedó reservado. Te esperamos en " + esc(c.barberia) + ".</p>") +
      '<div class="rs-resumen"><div><span>Servicio</span><b>' + esc(c.servicio) + "</b></div><div><span>Barbero</span><b>" + esc(c.barbero) + "</b></div>" +
      "<div><span>Día</span><b>" + esc(U.fechaLarga(c.inicio)) + "</b></div><div><span>Hora</span><b>" + U.hora(c.inicio) + "</b></div>" +
      (abono ? "<div><span>Anticipo pagado</span><b>" + U.pesos(abono) + " · " + (BS.MEDIOS[c.anticipo.medio] || "") + "</b></div>" : "") +
      '<div class="total"><span>Pagás en la barbería</span><b>' + U.pesos(c.precio - abono) + "</b></div></div>" +
      (pendiente && c.pagoUrl ? '<a class="btn btn--lg rs-cta" href="' + esc(c.pagoUrl) + '">Pagar el anticipo de ' + U.pesos(c.anticipo.monto) + "</a>" : "") +
      (pendiente && !c.pagoUrl ? '<p class="rs-nota">El link para pagar el anticipo de ' + U.pesos(c.anticipo.monto) + " te llega por WhatsApp en unos minutos.</p>" : "") +
      (!pendiente && c.mensaje ? '<div class="rs-wa"><p class="rs-wa-k">' + ico("chat") + 'Te llegó esto a tu WhatsApp</p><div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + "Automático</span>" + esc(c.mensaje) + "</div></div>" : "") +
      '<div class="rs-acciones">' + (!pendiente ? '<button class="btn" data-rs="ics">' + ico("cal") + "Agregar a mi calendario</button>" : "") +
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
      (s.resenas ? '<span class="rs-dato">' + ico("estrella") + "<span>" + String(s.rating).replace(".", ",") + " <small>· " + s.resenas + " reseñas" + (BS.esEjemplo() ? " (datos de ejemplo)" : "") + "</small></span></span>" : "") +
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

  function paso(n, titulo, estado, resumen, contenido) {
    return '<section class="rs-paso ' + estado + '" aria-labelledby="paso-' + n + '"><div class="rs-paso-cab"><span class="rs-paso-n">' + (estado.indexOf("is-hecho") >= 0 ? ico("check") : n) + "</span>" +
      '<h2 id="paso-' + n + '">' + titulo + "</h2>" + (resumen || "") + '</div><div class="rs-paso-cuerpo">' + contenido + "</div></section>";
  }

  function htmlCita() {
    if (enServidor() && BS.conexion.noEncontrada) return '<div class="rs-ok"><h2>No encontramos esta barbería</h2><p>Revisá el link que te pasaron.</p></div>';
    if (enServidor() && remoto.cita) return htmlConfirmadaRemota();
    if (R.confirmada) return htmlConfirmada();
    var st = BS.get();
    var s1 = !!R.servicio, s2 = !!R.barbero, s3 = R.min != null && R.dia, s4 = R.datosOk;
    var srv = R.servicio ? BS.servicio(R.servicio) : null;
    var html = "";

    html += paso(1, "¿Qué te vas a hacer?", s1 ? "is-hecho is-plegado" : "",
      s1 ? '<button class="resumen" data-rs="editar" data-p="1">' + esc(srv.nombre) + " · " + U.pesos(srv.precio) + "</button>" : "",
      '<div class="rs-servicios">' + st.servicios.map(function (s) {
        return '<button class="rs-opcion' + (R.servicio === s.id ? " is-on" : "") + '" data-rs="servicio" data-id="' + s.id + '"><b>' + esc(s.nombre) + "</b><small>" + esc(s.desc || "") + " · " + s.dur + ' min</small><span class="precio">' + U.pesos(s.precio) + "</span></button>";
      }).join("") + "</div>");

    var bNombre = R.barbero === "cualquiera" ? "El que esté libre" : R.barbero ? BS.barbero(R.barbero).nombre : "";
    html += paso(2, "¿Con quién?", !s1 ? "is-bloqueado" : s2 ? "is-hecho is-plegado" : "",
      s2 ? '<button class="resumen" data-rs="editar" data-p="2">' + esc(bNombre) + "</button>" : "",
      '<div class="rs-barberos"><button class="rs-barbero rs-barbero--libre' + (R.barbero === "cualquiera" ? " is-on" : "") + '" data-rs="barbero" data-id="cualquiera"><span class="avatar"><span class="poste is-on"></span></span><b>El que esté libre</b><small>Más turnos disponibles</small></button>' +
      st.barberos.map(function (b) {
        return '<button class="rs-barbero' + (R.barbero === b.id ? " is-on" : "") + '" data-rs="barbero" data-id="' + b.id + '"><span class="avatar">' + esc(U.iniciales(b.nombre)) + "</span><b>" + esc(b.nombre) + (b.alias ? ' <small style="display:inline">«' + esc(b.alias) + "»</small>" : "") + "</b><small>" + esc([(b.especialidades || []).join(" · ")].concat(BS.esEjemplo() ? [String(b.rating).replace(".", ",") + " ★"] : []).filter(Boolean).join(" · ") || (b.modo === "dueno" ? "Dueño" : "Barbero")) + "</small></button>";
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
    return '<div class="rs-ok"><span class="rs-ok-ico">' + ico("check") + "</span><h2>¡Listo, " + esc(U.primerNombre(cli.nombre)) + "!</h2><p>Tu turno quedó reservado. Te esperamos en " + esc(BS.get().shop.nombre) + ".</p>" +
      '<div class="rs-resumen"><div><span>Servicio</span><b>' + esc(srv.nombre) + "</b></div><div><span>Barbero</span><b>" + esc(b.nombre) + "</b></div>" +
      "<div><span>Día</span><b>" + esc(U.fechaLarga(c.inicio)) + "</b></div><div><span>Hora</span><b>" + U.hora(c.inicio) + "</b></div>" +
      (abono ? "<div><span>Anticipo pagado</span><b>" + U.pesos(abono) + " · " + BS.MEDIOS[c.anticipo.medio] + '</b></div><div class="total"><span>Pagás en la barbería</span><b>' + U.pesos(c.precio - abono) + "</b></div>" : '<div class="total"><span>Pagás en la barbería</span><b>' + U.pesos(c.precio) + "</b></div>") + "</div>" +
      (msg ? '<div class="rs-wa"><p class="rs-wa-k">' + ico("chat") + 'Te llegó esto a tu WhatsApp</p><div class="msg msg--in"><span class="msg-auto">' + ico("rayo") + "Automático</span>" + esc(msg) + '<span class="msg-meta">' + U.hora(new Date()) + "</span></div></div>" : "") +
      '<div class="rs-acciones"><button class="btn" data-rs="ics">' + ico("cal") + 'Agregar a mi calendario</button><button class="btn btn--ghost" data-rs="otra">Hacer otra reserva</button>' +
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

  function toast(texto) {
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span class="toast-ico toast-ico--alerta">' + ico("reloj") + "</span><div><small>Ojo</small><p>" + esc(texto) + "</p></div>";
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
        R.confirmada = null; R.servicio = null; R.barbero = null; R.min = null; R.dia = null; R.datosOk = false;
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
      if (params.get("cita") && params.get("t")) { R.modo = "cita"; cargarCitaRemota(params.get("cita"), params.get("t"), 0); }
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
    document.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-rs-campo");
      if (k === "nombre") R.nombre = e.target.value;
      if (k === "tel") R.tel = e.target.value;
    });
    document.addEventListener("change", function (e) {
      if (e.target.getAttribute("data-rs-campo") === "acepto") R.acepto = e.target.checked;
    });
    BS.subscribe(function () {
      var activo = document.activeElement;
      if (activo && activo.matches && activo.matches("input")) { pintarMarca(); return; }
      if (!capa.hidden) return;
      render();
    });
    render();
    setInterval(function () { if (!(document.activeElement && document.activeElement.matches("input"))) render(); }, 30000);
  }
  function arrancar() {
    (BS.listo || Promise.resolve()).then(boot, function (err) {
      var c = $("[data-rs-cuerpo]");
      if (c) c.innerHTML = '<div class="rs-ok"><h2>No pudimos cargar los turnos</h2><p>' + esc((err && err.message) || "Revisá tu conexión") + '</p><button class="btn rs-cta" onclick="location.reload()">Intentar de nuevo</button></div>';
    });
  }
  if (document.readyState === "complete") arrancar(); else document.addEventListener("DOMContentLoaded", arrancar);
})();
