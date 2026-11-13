/* ==========================================================================
   Barber SaaS — Conexión del navegador con el servidor
   - Si la página la sirve el servidor de Barber SaaS (existe /api/salud):
     panel  → inicia sesión, carga la barbería y sincroniza los cambios en vivo.
     reservas (?b=slug) → carga los turnos públicos y reserva contra el servidor.
   - Si no hay servidor (hosting estático, file://) o la URL trae ?demo=1:
     todo funciona como demo con los datos de ejemplo del navegador.
   Expone BS.conexion y la promesa BS.listo (la app arranca cuando se cumple).
   ========================================================================== */
(function () {
  "use strict";
  var BS = window.BS;
  var params = new URLSearchParams(location.search);
  var pagina = (document.body && document.body.getAttribute("data-pagina")) || "panel";
  var C = BS.conexion = { modo: "demo", pagina: pagina, sesion: null, slug: null, version: 0 };
  var API = "../api/";

  function pedir(metodo, ruta, cuerpo) {
    var opts = { method: metodo, credentials: "same-origin", cache: "no-store", headers: { "Accept": "application/json" } };
    if (cuerpo !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(cuerpo); }
    return fetch(API + ruta, opts).then(function (r) {
      return r.text().then(function (txt) {
        var datos = null;
        try { datos = txt ? JSON.parse(txt) : null; } catch (e) { datos = null; }
        if (!r.ok) { var err = new Error((datos && datos.error) || ("Error " + r.status)); err.status = r.status; err.datos = datos; throw err; }
        return datos;
      });
    });
  }
  C.get = function (ruta) { return pedir("GET", ruta); };
  C.post = function (ruta, cuerpo) { return pedir("POST", ruta, cuerpo || {}); };
  C.put = function (ruta, cuerpo) { return pedir("PUT", ruta, cuerpo || {}); };
  C.borrar = function (ruta) { return pedir("DELETE", ruta); };

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function nuncaTermina() { return new Promise(function () {}); }

  /* ---------------- Modo demo ---------------- */
  function iniciarDemo() { C.modo = "demo"; BS.modoLocal(); }

  /* ---------------- Panel conectado ---------------- */
  var base = null, enVuelo = false, otraVez = false, timer = null, fallos = 0;

  function avisarEstado(texto) {
    var el = document.querySelector("[data-estado-conexion]");
    if (el) { el.textContent = texto || ""; el.hidden = !texto; }
  }

  function rebase(estadoServidor, version, referencia) {
    var pendientes = BS.diffEstado(referencia || base, BS.get());
    base = clonar(estadoServidor);
    C.version = version;
    var nuevo = clonar(estadoServidor);
    if (!pendientes.vacio) BS.aplicarParche(nuevo, pendientes);
    BS.usar(nuevo);
    BS.commit("remoto");
    if (!pendientes.vacio) programarSync();
  }

  function sincronizar() {
    if (enVuelo) { otraVez = true; return; }
    var parche = BS.diffEstado(base, BS.get());
    if (parche.vacio) return;
    enVuelo = true;
    var enviado = clonar(BS.get());
    C.post("sync", { version: C.version, parche: parche }).then(function (res) {
      fallos = 0; avisarEstado("");
      rebase(res.estado, res.version, enviado);
    }).catch(function (err) {
      fallos++;
      if (err.status === 401) { location.href = "entrar.html"; return; }
      avisarEstado("Sin conexión · reintentando");
      setTimeout(programarSync, Math.min(15000, 1500 * fallos));
    }).then(function () {
      enVuelo = false;
      if (otraVez) { otraVez = false; sincronizar(); }
    });
  }
  function programarSync() { clearTimeout(timer); timer = setTimeout(sincronizar, 250); }

  function refrescar() {
    if (enVuelo) { otraVez = true; return; }
    C.get("estado").then(function (res) {
      if (res.version !== C.version) rebase(res.estado, res.version, null);
    }).catch(function () { /* el siguiente aviso lo vuelve a intentar */ });
  }

  function escuchar() {
    if (!window.EventSource) { setInterval(refrescar, 15000); return; }
    var fuente = new EventSource(API + "eventos");
    fuente.addEventListener("cambio", function (e) {
      try { var d = JSON.parse(e.data); if (d.version > C.version && !enVuelo) refrescar(); } catch (err) { /* aviso dañado */ }
    });
    fuente.onerror = function () { avisarEstado("Reconectando…"); };
    fuente.onopen = function () { avisarEstado(""); refrescar(); };
  }

  function iniciarPanel() {
    return C.get("sesion").catch(function (err) {
      if (err.status === 401) {
        location.replace("entrar.html" + (params.get("nuevo") ? "?registro=1" : ""));
        return nuncaTermina();
      }
      throw err;
    }).then(function (sesion) {
      C.sesion = sesion;
      return C.get("estado");
    }).then(function (res) {
      C.modo = "servidor";
      base = clonar(res.estado);
      C.version = res.version;
      BS.usar(clonar(res.estado));
      // En una cuenta real nada se simula: las automatizaciones corren en el servidor.
      BS.emit = function () {};
      BS.ejecutarAuto = function (id) {
        programarSync();
        C.post("automatizaciones/" + encodeURIComponent(id) + "/ejecutar", {}).catch(function (err) {
          if (window.APP && APP.toastSimple) APP.toastSimple(err.message, "x", "Automatización");
        });
        return { pendiente: true };
      };
      var origen = location.origin;
      BS.linkReservas = function () { return origen + "/reserva/?b=" + BS.get().shop.slug; };
      BS.linkFila = function () { return origen + "/reserva/?b=" + BS.get().shop.slug + "&modo=fila"; };
      BS.alCommit = function (motivo) { if (motivo !== "remoto") programarSync(); };
      window.addEventListener("beforeunload", function (e) {
        if (enVuelo || !BS.diffEstado(base, BS.get()).vacio) { sincronizar(); e.preventDefault(); e.returnValue = ""; }
      });
      escuchar();
    });
  }

  C.salir = function () {
    return C.post("salir", {}).catch(function () {}).then(function () { location.href = "entrar.html"; });
  };

  /* ---------------- Página de reservas conectada ---------------- */
  function estadoDesdePublico(p) {
    return {
      v: 0, shop: p.shop, servicios: p.servicios, barberos: p.barberos, clientes: [],
      citas: p.ocupacion.map(function (o, i) { return { id: "o" + i, cliente: null, barbero: o.barbero, servicio: null, inicio: o.inicio, dur: o.dur, estado: "confirmada" }; }),
      fila: p.fila, autos: p.autos, actividad: [], pagos: [], ajustes: {}
    };
  }
  function cargarPublico() {
    return C.get("publico/" + encodeURIComponent(C.slug)).then(function (p) {
      BS.usar(estadoDesdePublico(p));
      C.publico = p;
      return p;
    });
  }
  function iniciarPublico() {
    C.slug = params.get("b");
    return cargarPublico().then(function () {
      C.modo = "servidor";
      BS.emit = function () {};
      var origen = location.origin;
      BS.linkReservas = function () { return origen + "/reserva/?b=" + C.slug; };
      setInterval(function () {
        var activo = document.activeElement;
        if (activo && activo.matches && activo.matches("input")) return;
        cargarPublico().then(function () { BS.commit("remoto"); }).catch(function () {});
      }, 20000);
    }).catch(function (err) {
      if (err.status === 404) { C.modo = "servidor"; C.noEncontrada = true; BS.usar(estadoDesdePublico({ shop: { nombre: "Barbería no encontrada", barrio: "", ciudad: "", direccion: "", horario: {}, anticipo: { activo: false }, medios: {}, rating: 5, resenas: 0 }, servicios: [], barberos: [], ocupacion: [], fila: [], autos: [] })); return; }
      throw err;
    });
  }
  C.recargarPublico = cargarPublico;
  C.reservar = function (datos) { return C.post("publico/" + encodeURIComponent(C.slug) + "/reservas", datos); };
  C.estadoReserva = function (id, token) { return C.get("publico/" + encodeURIComponent(C.slug) + "/reservas/" + encodeURIComponent(id) + "?t=" + encodeURIComponent(token)); };
  C.unirseFila = function (datos) { return C.post("publico/" + encodeURIComponent(C.slug) + "/fila", datos); };
  C.estadoFila = function (id, token) { return C.get("publico/" + encodeURIComponent(C.slug) + "/fila/" + encodeURIComponent(id) + "?t=" + encodeURIComponent(token)); };
  C.salirFila = function (id, token) { return C.borrar("publico/" + encodeURIComponent(C.slug) + "/fila/" + encodeURIComponent(id) + "?t=" + encodeURIComponent(token)); };

  /* ---------------- Arranque ---------------- */
  BS.listo = (function () {
    // Sin servidor posible (archivo local o GitHub Pages) o demo pedida: arranca la demo directo
    if (location.protocol === "file:" || /\.github\.io$/.test(location.hostname) || params.get("demo") === "1") { iniciarDemo(); return Promise.resolve(); }
    if (pagina === "reserva" && !params.get("b")) { iniciarDemo(); return Promise.resolve(); }
    return fetch(API + "salud", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("sin servidor");
      return r.json();
    }).then(function (j) {
      if (!j || !j.barbersaas) throw new Error("sin servidor");
      C.servidor = j;
      if (pagina === "entrar") { C.modo = "servidor"; return; }
      return pagina === "reserva" ? iniciarPublico() : iniciarPanel();
    }).catch(function (err) {
      if (C.modo === "servidor" || (err && err.status)) { console.warn("[conexión]", err); throw err; }
      iniciarDemo();
    });
  })();
})();
