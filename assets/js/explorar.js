/* ==========================================================================
   Barber SaaS — Explorar: el buscador de barberías (motor de reservas)
   El cliente ve qué barberías tienen turno hoy, el precio y la calificación de
   clientes reales, y reserva tocando la hora. Con servidor: todas las barberías
   que quieren aparecer. En la demo: la del dueño (si la creó) y la de ejemplo.
   ========================================================================== */
(function () {
  "use strict";
  var BS = window.BS, U = BS.util, esc = U.escapar;
  function $(s) { return document.querySelector(s); }

  var SERVICIOS = [["", "Todos"], ["corte", "Corte"], ["barba", "Barba"], ["nino", "Niños"], ["ceja", "Cejas"], ["diseno", "Diseño"]];
  var F = { q: "", servicio: "", ya: false };
  var datos = { barberias: [], demo: false };

  /* ---------------- De dónde salen las barberías ---------------- */
  function sinServidor() { return location.protocol === "file:" || /\.github\.io$/.test(location.hostname); }
  function listaDemo() {
    var out = [];
    BS.modoLocal({ ejemplo: false });
    if (BS.get()) out.push(Object.assign({ link: "../reserva/index.html", propia: true }, BS.resumenExplorar()));
    BS.modoLocal({ ejemplo: true });
    out.push(Object.assign({ link: "../reserva/index.html?demo=1" }, BS.resumenExplorar()));
    return out;
  }
  function cargar() {
    if (sinServidor()) return Promise.resolve({ barberias: listaDemo(), demo: true });
    return fetch("../api/publico/explorar", { cache: "no-store", headers: { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("sin servidor");
      return r.json();
    }).then(function (j) {
      return { barberias: (j.barberias || []).map(function (b) { return Object.assign({ link: "../reserva/?b=" + encodeURIComponent(b.slug) }, b); }), demo: false };
    }).catch(function () { return { barberias: listaDemo(), demo: true }; });
  }

  /* ---------------- Pintar ---------------- */
  function diaTexto(p) {
    if (p.dia === 0) return "Hoy";
    if (p.dia === 1) return "Mañana";
    var f = p.fecha.split("-").map(Number), d = new Date(f[0], f[1] - 1, f[2]);
    return U.DIAS_CORTO[d.getDay()].charAt(0).toUpperCase() + U.DIAS_CORTO[d.getDay()].slice(1) + " " + d.getDate();
  }
  function conParams(link, q) { return link + (link.indexOf("?") >= 0 ? "&" : "?") + q; }
  function servicioElegido(b) {
    if (!F.servicio) return null;
    // Primero el que se llama exactamente así («Barba»), después el que empieza así, después el que lo contiene
    var cands = b.servicios.filter(function (s) { return U.normalizar(s.nombre).indexOf(F.servicio) >= 0; });
    function nombre(s) { return U.normalizar(s.nombre).replace(/[^a-z0-9]+/g, " ").trim(); }
    return cands.filter(function (s) { return nombre(s) === F.servicio; })[0] || cands.filter(function (s) { return nombre(s).indexOf(F.servicio) === 0; })[0] || cands[0] || null;
  }
  function linkTurno(b, p) {
    var s = servicioElegido(b);
    return conParams(b.link, "s=" + encodeURIComponent(s ? s.id : b.principal) + "&d=" + p.fecha + "&m=" + p.min);
  }
  function estrellas(rep) {
    if (!rep || !rep.total) return '<span class="ex-dato ex-nueva">Nueva en Barber SaaS</span>';
    return '<span class="ex-dato"><svg class="ic ex-estrella" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg><b>' +
      String(rep.promedio).replace(".", ",") + "</b> · " + rep.total + (rep.ejemplo ? " reseñas de ejemplo" : rep.total === 1 ? " calificación" : " calificaciones") + "</span>";
  }
  function tarjeta(b) {
    var s = servicioElegido(b), precio = s ? s.precio : b.desde;
    var estado = b.abierto && b.horarioHoy ? '<span class="ex-dato ex-abierto"><i></i>Abierto · cierra ' + U.horaMin(b.horarioHoy[1]) + "</span>" : '<span class="ex-dato">Cerrado ahora</span>';
    var slots = b.proximos.length ? b.proximos.map(function (p) {
      return '<a class="ex-slot' + (b.ya && p === b.proximos[0] && p.dia === 0 ? " is-ya" : "") + '" href="' + esc(linkTurno(b, p)) + '"><small>' + diaTexto(p) + "</small>" + U.horaMin(p.min) + "</a>";
    }).join("") : '<p class="ex-sin">Sin turnos libres en los próximos días.</p>';
    return '<article class="ex-card">' +
      '<div class="ex-card-cab"><span class="ex-sello" aria-hidden="true">' + esc(U.iniciales(b.nombre)) + "</span><div><h2>" + esc(b.nombre) + "</h2><p>" + esc(b.barrio) + " · " + esc(b.direccion) + "</p></div>" +
      (b.ejemplo ? '<span class="ex-tag">Ejemplo</span>' : b.propia ? '<span class="ex-tag ex-tag--tuya">Tu barbería</span>' : "") + "</div>" +
      '<div class="ex-datos">' + estrellas(b.reputacion) + estado + "</div>" +
      '<p class="ex-precio">' + (s ? esc(s.nombre) + " · " : "Desde ") + "<b>" + U.pesos(precio) + "</b> · " + b.barberos + (b.barberos === 1 ? " barbero" : " barberos") + "</p>" +
      '<p class="ex-k">Próximos turnos' + (s ? "" : " para " + esc((b.servicios.filter(function (x) { return x.id === b.principal; })[0] || { nombre: "corte" }).nombre.toLowerCase())) + "</p>" +
      '<div class="ex-slots">' + slots + "</div>" +
      '<a class="btn ex-ver" href="' + esc(s ? conParams(b.link, "s=" + encodeURIComponent(s.id)) : b.link) + '">Ver todos los turnos</a></article>';
  }
  function filtradas() {
    var q = U.normalizar(F.q.trim());
    return datos.barberias.filter(function (b) {
      if (q && U.normalizar(b.nombre + " " + b.barrio + " " + b.direccion).indexOf(q) < 0) return false;
      if (F.servicio && !servicioElegido(b)) return false;
      if (F.ya && !b.ya) return false;
      return true;
    });
  }
  function pintar() {
    var lista = filtradas();
    $("[data-ex-servicios]").innerHTML = SERVICIOS.map(function (s) {
      return '<button class="chip' + (F.servicio === s[0] ? " is-on" : "") + '" data-servicio="' + s[0] + '" aria-pressed="' + (F.servicio === s[0]) + '">' + s[1] + "</button>";
    }).join("");
    var ya = lista.filter(function (b) { return b.ya; }).length;
    $("[data-ex-conteo]").textContent = lista.length
      ? lista.length + (lista.length === 1 ? " barbería" : " barberías") + (ya ? " · " + ya + " con silla libre ya" : "")
      : "";
    $("[data-ex-lista]").innerHTML = lista.length ? lista.map(tarjeta).join("")
      : '<div class="ex-vacio"><b>No encontramos turnos con ese filtro</b>Probá con otro barrio o quitá «Corte ya».</div>';
    var nota = $("[data-ex-nota]");
    nota.hidden = !datos.demo;
    if (datos.demo) nota.textContent = "Estás viendo la demo: aparecen tu barbería (si la creaste en este navegador) y una de ejemplo. Con la versión real aparecen todas las barberías de Barber SaaS en Medellín, con turnos en vivo.";
  }

  /* ---------------- Arranque ---------------- */
  function actualizar() { return cargar().then(function (d) { datos = d; pintar(); }); }
  document.addEventListener("DOMContentLoaded", function () {
    var params = new URLSearchParams(location.search);
    F.q = params.get("q") || ""; F.ya = params.get("ya") === "1";
    $("[data-ex='q']").value = F.q; $("[data-ex='ya']").checked = F.ya;
    document.addEventListener("click", function (e) {
      var c = e.target.closest("[data-servicio]");
      if (c) { F.servicio = c.getAttribute("data-servicio"); pintar(); }
    });
    $("[data-ex='q']").addEventListener("input", function (e) { F.q = e.target.value; pintar(); });
    $("[data-ex='ya']").addEventListener("change", function (e) { F.ya = e.target.checked; pintar(); });
    actualizar().catch(function () {
      $("[data-ex-conteo]").textContent = "No pudimos cargar las barberías. Revisá tu conexión y recargá la página.";
    });
    setInterval(function () { if (document.visibilityState === "visible") actualizar(); }, 60000);
  });
})();
