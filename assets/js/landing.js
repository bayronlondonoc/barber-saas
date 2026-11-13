/* ==========================================================================
   Barber SaaS — Landing (IIFE, sin módulos; el contenido vive en el HTML)
   ========================================================================== */
(function () {
  "use strict";
  window.__BS_LANDING__ = true;
  document.documentElement.classList.add("js");

  var puedeHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function safe(fn, nombre) {
    try { fn(); } catch (e) { console.warn("[" + nombre + "]", e); }
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pesos(n) { return "$" + Math.round(n).toLocaleString("es-CO"); }
  function hora(min) {
    min = Math.round(min / 5) * 5;
    var h = Math.floor(min / 60), m = min % 60;
    if (h === 12 && m === 0) return "12:00 m.";
    var suf = h < 12 ? "a. m." : "p. m.";
    var h12 = h % 12 || 12;
    return h12 + ":" + (m < 10 ? "0" : "") + m + " " + suf;
  }

  /* ---------- Nav ---------- */
  function initNav() {
    var nav = document.querySelector("[data-nav]");
    if (!nav) return;
    var burger = nav.querySelector("[data-burger]");
    var menu = nav.querySelector("[data-menu]");
    function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 24); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (burger && menu) {
      burger.addEventListener("click", function () {
        var abierto = menu.hidden;
        menu.hidden = !abierto;
        burger.setAttribute("aria-expanded", String(abierto));
        nav.classList.add("is-scrolled");
      });
      menu.addEventListener("click", function (e) {
        if (e.target.closest("a")) { menu.hidden = true; burger.setAttribute("aria-expanded", "false"); }
      });
    }
  }

  /* ---------- Luz neón que sigue el mouse + leve inclinación del teléfono ---------- */
  function initHeroLuz() {
    var hero = document.querySelector("[data-hero]");
    var luz = document.querySelector("[data-luz]");
    var tel = document.querySelector(".hero-tel");
    if (!hero || !luz || !puedeHover) return;
    var tx = 72, ty = 42, x = 72, y = 42, rx = 0, ry = 0, trx = 0, tryy = 0, activo = false;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      trx = (e.clientY - r.top - r.height / 2) / r.height * -5;
      tryy = (e.clientX - r.left - r.width / 2) / r.width * 7;
      if (!activo) { activo = true; requestAnimationFrame(tick); }
    });
    hero.addEventListener("pointerleave", function () { trx = 0; tryy = 0; });
    function tick() {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      rx += (trx - rx) * 0.08; ry += (tryy - ry) * 0.08;
      luz.style.setProperty("--mx", x.toFixed(2) + "%");
      luz.style.setProperty("--my", y.toFixed(2) + "%");
      if (tel) tel.style.transform = "rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) rotate(-1.5deg)";
      if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(trx - rx) + Math.abs(tryy - ry) > 0.05) requestAnimationFrame(tick);
      else activo = false;
    }
  }

  /* ---------- Chat del hero: la conversación de las 11:47 p. m. ---------- */
  function initHeroChat() {
    var visual = document.querySelector(".hero-visual");
    var body = document.querySelector("[data-chat-body]");
    if (!visual || !body) return;
    var pasos = Array.prototype.slice.call(body.querySelectorAll("[data-paso]"));
    var flotas = Array.prototype.slice.call(visual.querySelectorAll("[data-flota]"));
    var guion = [
      { paso: 1, espera: 700 },
      { tecleo: 1100 },
      { paso: 2, espera: 1500 },
      { paso: 3, espera: 900 },
      { tecleo: 1200 },
      { paso: 4, espera: 1700 },
      { paso: 5, espera: 1200 },
      { tecleo: 900 },
      { paso: 6, espera: 7000 }
    ];
    var i = 0, timer = null, visible = true, corriendo = false, tecleo = null;

    function abajo() { body.scrollTop = body.scrollHeight; }
    function quitarTecleo() { if (tecleo && tecleo.parentNode) tecleo.parentNode.removeChild(tecleo); tecleo = null; }
    function reiniciar() {
      quitarTecleo();
      pasos.forEach(function (p) { p.classList.remove("is-shown"); });
      flotas.forEach(function (f) { f.classList.remove("is-shown"); });
      body.scrollTop = 0;
      i = 0;
    }
    function siguiente() {
      if (!visible) { corriendo = false; return; }
      corriendo = true;
      if (i >= guion.length) { reiniciar(); timer = setTimeout(siguiente, 600); return; }
      var s = guion[i++];
      if (s.tecleo) {
        quitarTecleo();
        tecleo = document.createElement("span");
        tecleo.className = "escribiendo";
        tecleo.innerHTML = "<i></i><i></i><i></i>";
        body.appendChild(tecleo);
        abajo();
        timer = setTimeout(siguiente, s.tecleo);
        return;
      }
      quitarTecleo();
      var el = pasos.filter(function (p) { return Number(p.getAttribute("data-paso")) === s.paso; })[0];
      if (el) el.classList.add("is-shown");
      flotas.forEach(function (f) { if (Number(f.getAttribute("data-flota")) === s.paso) f.classList.add("is-shown"); });
      requestAnimationFrame(abajo);
      timer = setTimeout(siguiente, s.espera);
    }

    visual.classList.add("is-playing");
    reiniciar();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !corriendo) { clearTimeout(timer); timer = setTimeout(siguiente, 400); }
      }, { threshold: 0.05 }).observe(visual);
    } else {
      timer = setTimeout(siguiente, 400);
    }
  }

  /* ---------- Marquee de barrios: velocidad y dirección según el scroll ---------- */
  function initMarquee() {
    var pista = document.querySelector("[data-marquee]");
    if (!pista) return;
    var grupo = pista.querySelector(".barrios-grupo");
    var ancho = grupo.getBoundingClientRect().width;
    var x = 0, dir = -1, extra = 0, ultimoY = window.scrollY, ultimoT = performance.now();
    window.addEventListener("resize", function () { ancho = grupo.getBoundingClientRect().width; });
    window.addEventListener("scroll", function () {
      var dy = window.scrollY - ultimoY;
      ultimoY = window.scrollY;
      if (Math.abs(dy) > 0.5) { dir = dy > 0 ? -1 : 1; extra = clamp(extra + Math.abs(dy) * 0.6, 0, 420); }
    }, { passive: true });
    function tick(t) {
      var dt = Math.min(0.05, (t - ultimoT) / 1000);
      ultimoT = t;
      extra *= 0.94;
      x += dir * (38 + extra) * dt;
      if (x <= -ancho) x += ancho;
      if (x > 0) x -= ancho;
      pista.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Reveal al hacer scroll (umbral bajo + red de seguridad) ---------- */
  function initReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-revealed"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var hermanos = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = Math.min(hermanos, 4) * 90 + "ms";
        el.classList.add("is-revealed");
        io.unobserve(el);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      els.forEach(function (el) {
        if (!el.classList.contains("is-revealed") && el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-revealed");
      });
    }, 6000);
  }

  /* ---------- Tabs de automatizaciones con avance automático ---------- */
  function initTabs() {
    var raiz = document.querySelector("[data-tabs]");
    if (!raiz) return;
    var tabs = Array.prototype.slice.call(raiz.querySelectorAll("[data-tab]"));
    var paneles = Array.prototype.slice.call(raiz.querySelectorAll("[data-panel]"));
    var DUR = 7000, actual = 0, timer = null, auto = true, visible = false;

    function activar(idx, desdeUsuario) {
      actual = (idx + tabs.length) % tabs.length;
      tabs.forEach(function (t, i) {
        var on = i === actual;
        t.classList.toggle("is-activa", on);
        t.classList.remove("is-corriendo");
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      paneles.forEach(function (p, i) {
        var on = i === actual;
        p.hidden = !on;
        p.classList.toggle("is-activo", on);
      });
      if (desdeUsuario) { auto = false; clearTimeout(timer); }
      programar();
    }
    function programar() {
      clearTimeout(timer);
      var t = tabs[actual];
      if (!auto || !visible) return;
      void t.offsetWidth; // reinicia la barra del poste
      t.style.setProperty("--dur", DUR + "ms");
      t.classList.add("is-corriendo");
      timer = setTimeout(function () { activar(actual + 1, false); }, DUR);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { activar(i, true); });
      t.addEventListener("keydown", function (e) {
        var k = e.key;
        if (k === "ArrowDown" || k === "ArrowRight") { e.preventDefault(); activar(i + 1, true); tabs[actual].focus(); }
        if (k === "ArrowUp" || k === "ArrowLeft") { e.preventDefault(); activar(i - 1, true); tabs[actual].focus(); }
        if (k === "Home") { e.preventDefault(); activar(0, true); tabs[actual].focus(); }
        if (k === "End") { e.preventDefault(); activar(tabs.length - 1, true); tabs[actual].focus(); }
      });
    });
    raiz.addEventListener("pointerover", function () { if (auto) { clearTimeout(timer); tabs[actual].classList.remove("is-corriendo"); } });
    raiz.addEventListener("pointerout", function (e) { if (auto && !raiz.contains(e.relatedTarget)) programar(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) programar(); else clearTimeout(timer);
      }, { threshold: 0.2 }).observe(raiz);
    }
  }

  /* ---------- Un sábado: escena clavada con scroll horizontal ---------- */
  function initSabado() {
    var sec = document.querySelector("[data-sabado]");
    if (!sec) return;
    var escena = sec.querySelector("[data-sabado-escena]");
    var ventana = sec.querySelector(".sabado-ventana");
    var pista = sec.querySelector("[data-pista]");
    var momentos = Array.prototype.slice.call(pista.querySelectorAll(".momento"));
    var reloj = sec.querySelector("[data-reloj]");
    var recuperado = sec.querySelector("[data-recuperado]");
    var barra = sec.querySelector("[data-progreso]");
    var mins = momentos.map(function (m) { return Number(m.getAttribute("data-min")) || null; });
    var plata = momentos.map(function (m) { return Number(m.getAttribute("data-plata")) || 0; });
    var clavado = false, distancia = 0, mostrado = 0, objetivo = 0, animando = false, activoIdx = -1;

    function medir() {
      var quiere = window.innerWidth > 960 && window.innerHeight > 620;
      sec.classList.toggle("is-clavado", quiere);
      clavado = quiere;
      pista.style.transform = "";
      if (clavado) {
        distancia = Math.max(0, pista.scrollWidth - window.innerWidth);
        sec.style.height = (window.innerHeight + distancia) + "px";
      } else {
        sec.style.height = "";
        distancia = 0;
      }
      actualizar();
    }

    function progreso() {
      if (clavado) {
        var top = sec.getBoundingClientRect().top;
        return distancia ? clamp(-top / distancia, 0, 1) : 0;
      }
      var max = ventana.scrollWidth - ventana.clientWidth;
      return max > 0 ? clamp(ventana.scrollLeft / max, 0, 1) : 0;
    }

    function animarPlata() {
      if (animando) return;
      animando = true;
      (function paso() {
        mostrado += (objetivo - mostrado) * 0.12;
        if (Math.abs(objetivo - mostrado) < 500) mostrado = objetivo;
        recuperado.textContent = pesos(Math.round(mostrado / 1000) * 1000);
        if (mostrado !== objetivo) requestAnimationFrame(paso); else animando = false;
      })();
    }

    function actualizar() {
      var p = progreso();
      if (clavado) pista.style.transform = "translate3d(" + (-p * distancia).toFixed(1) + "px,0,0)";
      if (barra) barra.style.width = (p * 100).toFixed(2) + "%";
      // momento activo = el más cercano al centro de la pantalla
      var centro = window.innerWidth / 2, mejor = 0, dist = Infinity;
      momentos.forEach(function (m, i) {
        var r = m.getBoundingClientRect();
        var d = Math.abs(r.left + r.width / 2 - centro);
        if (d < dist) { dist = d; mejor = i; }
      });
      if (p < 0.02) mejor = 0;
      if (p > 0.985) mejor = momentos.length - 1;
      if (mejor !== activoIdx) {
        activoIdx = mejor;
        momentos.forEach(function (m, i) { m.classList.toggle("is-activo", i === mejor); });
        var suma = 0;
        for (var i = 0; i <= mejor; i++) suma += plata[i];
        objetivo = suma;
        animarPlata();
      }
      // reloj: interpola entre las horas de las dos tarjetas que rodean el centro
      var centros = [];
      momentos.forEach(function (m, i) {
        if (mins[i] === null) return;
        var r = m.getBoundingClientRect();
        centros.push({ x: r.left + r.width / 2, min: mins[i] });
      });
      var minuto = centros[0].min;
      if (centro >= centros[centros.length - 1].x) minuto = centros[centros.length - 1].min;
      else {
        for (var k = 0; k < centros.length - 1; k++) {
          var a = centros[k], b = centros[k + 1];
          if (centro >= a.x && centro <= b.x) { minuto = a.min + (b.min - a.min) * ((centro - a.x) / (b.x - a.x)); break; }
        }
      }
      reloj.textContent = hora(minuto);
    }

    var pendiente = false;
    function enScroll() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; actualizar(); });
    }
    window.addEventListener("scroll", enScroll, { passive: true });
    ventana.addEventListener("scroll", enScroll, { passive: true });
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(medir, 150); });
    window.addEventListener("load", medir);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    medir();
  }

  /* ---------- Precios: mensual / anual ---------- */
  function initPeriodo() {
    var grupo = document.querySelector("[data-periodo]");
    if (!grupo) return;
    grupo.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-p]");
      if (!b) return;
      var p = b.getAttribute("data-p");
      grupo.querySelectorAll("button").forEach(function (x) {
        var on = x === b;
        x.classList.toggle("is-activo", on);
        x.setAttribute("aria-pressed", String(on));
      });
      document.querySelectorAll(".plan-precio b[data-mes]").forEach(function (el) {
        el.textContent = "$" + el.getAttribute(p === "anio" ? "data-anio" : "data-mes");
      });
      document.querySelectorAll("[data-nota-anual]").forEach(function (el) {
        el.textContent = p === "anio" ? "Pago anual · 2 meses de regalo" : "Facturado mes a mes";
      });
    });
  }

  function boot() {
    safe(initNav, "initNav");
    safe(initHeroLuz, "initHeroLuz");
    safe(initHeroChat, "initHeroChat");
    safe(initMarquee, "initMarquee");
    safe(initReveal, "initReveal");
    safe(initTabs, "initTabs");
    safe(initSabado, "initSabado");
    safe(initPeriodo, "initPeriodo");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
