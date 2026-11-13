/* Pasarela simulada: reemplaza a Wompi mientras no esté conectado. Aprueba o rechaza el anticipo. */
(function () {
  "use strict";
  var id = new URLSearchParams(location.search).get("id") || "";
  var caja = document.querySelector("[data-pago]");
  var MEDIOS = { breb: "Bre-B", nequi: "Nequi", daviplata: "Daviplata", pse: "PSE", tarjeta: "Tarjeta" };
  var medio = "breb";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pesos(n) { return "$" + Math.round(n || 0).toLocaleString("es-CO"); }
  function pedir(metodo, cuerpo) {
    return fetch("../api/pagos/simulado/" + encodeURIComponent(id), {
      method: metodo, headers: cuerpo ? { "Content-Type": "application/json" } : {}, body: cuerpo ? JSON.stringify(cuerpo) : undefined
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Error"); return j; }); });
  }
  function pintar(p) {
    var medios = Object.keys(MEDIOS).filter(function (m) { return !p.medios || p.medios[m]; });
    if (medios.indexOf(medio) < 0) medio = medios[0];
    if (p.estado === "aprobado") {
      caja.innerHTML = '<span class="rs-pago-ok">✓</span><h3>Este pago ya fue aprobado</h3><a class="btn" href="' + esc(p.redirect) + '">Ver mi reserva</a>';
      return;
    }
    caja.innerHTML = '<span class="rs-pago-marca">Pasarela de prueba · no se cobra plata real</span><h3>' + esc(p.barberia) + "</h3>" +
      '<span class="rs-pago-monto num">' + pesos(p.monto) + "</span><p>Anticipo · " + esc(p.descripcion) + "</p>" +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">' + medios.map(function (m) {
        return '<button class="chip" style="height:36px;padding:0 14px;border-radius:999px;font-weight:600;' + (m === medio ? "background:#141212;color:#f5f1ea" : "box-shadow:inset 0 0 0 1px rgba(20,18,18,.2)") + '" data-medio="' + m + '">' + MEDIOS[m] + "</button>";
      }).join("") + "</div>" +
      '<button class="btn" data-ok>Aprobar pago con ' + MEDIOS[medio] + "</button>" +
      '<button class="btn btn--ghost" style="--b-fg:#141212;box-shadow:inset 0 0 0 1px rgba(20,18,18,.25)" data-no>Simular pago rechazado</button>' +
      "<p>En producción aquí aparece el checkout de Wompi.</p>";
    caja.onclick = function (e) {
      var b = e.target.closest("[data-medio]");
      if (b) { medio = b.getAttribute("data-medio"); pintar(p); return; }
      if (e.target.closest("[data-ok]")) resolver("aprobado");
      if (e.target.closest("[data-no]")) resolver("rechazado");
    };
  }
  function resolver(resultado) {
    caja.innerHTML = '<span class="rs-pago-marca">' + MEDIOS[medio] + '</span><h3>Procesando…</h3><span class="poste"></span>';
    setTimeout(function () {
      pedir("POST", { resultado: resultado, medio: medio }).then(function (r) {
        caja.innerHTML = resultado === "aprobado" ? '<span class="rs-pago-ok">✓</span><h3>Pago aprobado</h3><p>Te devolvemos a tu reserva…</p>' : "<h3>Pago rechazado</h3><p>Podés intentarlo de nuevo desde tu reserva.</p>";
        setTimeout(function () { location.href = r.redirect; }, 1200);
      }).catch(function (err) { caja.innerHTML = "<h3>Ups</h3><p>" + esc(err.message) + "</p>"; });
    }, 1300);
  }
  pedir("GET").then(pintar).catch(function (err) { caja.innerHTML = "<h3>No encontramos este pago</h3><p>" + esc(err.message) + "</p>"; });
})();
