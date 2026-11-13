/* ==========================================================================
   Barber SaaS — Entrar / crear cuenta del dueño
   ========================================================================== */
(function () {
  "use strict";
  var BS = window.BS;
  var params = new URLSearchParams(location.search);
  function $(s) { return document.querySelector(s); }

  function mostrarTab(t) {
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      var on = b.getAttribute("data-tab") === t;
      b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on));
    });
    $("[data-form='entrar']").hidden = t !== "entrar";
    $("[data-form='registro']").hidden = t !== "registro";
    aviso("");
  }
  function aviso(txt) { var a = $("[data-aviso]"); a.textContent = txt; a.hidden = !txt; }
  function datos(form) {
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      d[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
    });
    return d;
  }
  function ocupado(form, si) {
    var b = form.querySelector("button[type=submit]");
    b.disabled = si; b.style.opacity = si ? 0.6 : "";
  }

  function iniciar() {
    if (!BS.conexion || BS.conexion.modo !== "servidor") {
      $("#contenido").innerHTML = '<div class="rs-ok"><h2>Esta es la versión demo</h2><p>No hay servidor conectado, así que todo funciona con datos de ejemplo en tu navegador.</p><a class="btn btn--lg rs-cta" href="index.html?demo=1">Abrir la demo</a></div>';
      return;
    }
    // Si ya hay sesión, directo al panel
    BS.conexion.get("sesion").then(function () { location.replace("index.html"); }).catch(function () {});
    if (params.get("registro")) mostrarTab("registro");
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { mostrarTab(b.getAttribute("data-tab")); });
    });

    $("[data-form='entrar']").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, d = datos(f);
      if (!d.email || !d.clave) { aviso("Escribí tu correo y tu contraseña."); return; }
      ocupado(f, true);
      BS.conexion.post("entrar", { email: d.email, clave: d.clave }).then(function () {
        location.replace("index.html");
      }).catch(function (err) { aviso(err.message); ocupado(f, false); });
    });

    $("[data-form='registro']").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, d = datos(f);
      if (!d.barberia || !d.nombre || !d.email) { aviso("Completá el nombre de la barbería, tu nombre y tu correo."); return; }
      if ((d.clave || "").length < 8) { aviso("La contraseña debe tener al menos 8 caracteres."); return; }
      if (!d.acepto) { aviso("Necesitamos tu autorización para el tratamiento de datos."); return; }
      ocupado(f, true);
      BS.conexion.post("registro", d).then(function () {
        location.replace("index.html");
      }).catch(function (err) { aviso(err.message); ocupado(f, false); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    (BS.listo || Promise.resolve()).then(iniciar, iniciar);
  });
})();
