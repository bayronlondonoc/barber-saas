/* ==========================================================================
   Barber SaaS — Registro paso a paso de una barbería nueva
   1. Tu barbería · 2. Ubicación · 3. Horario · 4. Servicios y precios · 5. Tu equipo
   y al final: el link y el mensaje que se le mandan a los clientes.
   También trae los editores (horario, servicios, equipo) que usa Ajustes y la
   tarjeta «mandale esto a tus clientes» del panel vacío.
   ========================================================================== */
(function () {
  "use strict";
  var BS = window.BS, U = BS.util, esc = U.escapar, APP = window.APP;
  var ico = APP.ico;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function enServidor() { return APP.enServidor(); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function digitos(v) { return String(v == null ? "" : v).replace(/\D/g, ""); }
  function miles(n) { n = Number(n) || 0; return n ? n.toLocaleString("es-CO") : ""; }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function slugDe(nombre) { return U.normalizar(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "mi-barberia"; }
  function telValido(t) { t = digitos(t); if (t.length === 12 && t.indexOf("57") === 0) t = t.slice(2); return /^3\d{9}$/.test(t) ? t : ""; }

  /* ==========================================================================
     EDITORES (registro y Ajustes)
     ========================================================================== */
  var DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0];
  function opcionesHora(sel) {
    var out = "";
    for (var m = 5 * 60; m <= 23 * 60 + 30; m += 30) out += '<option value="' + m + '"' + (m === sel ? " selected" : "") + ">" + U.horaMin(m) + "</option>";
    return out;
  }

  /* ---- Horario ---- */
  function horarioHTML(h) {
    return '<div class="ed-horario" data-editor="horario">' + DIAS_ORDEN.map(function (d) {
      var x = h && h[d], abre = !!x, ini = x ? x[0] : 540, fin = x ? x[1] : 1200;
      return '<div class="ed-dia' + (abre ? "" : " is-cerrado") + '" data-dia="' + d + '">' +
        '<label class="switch"><input type="checkbox" data-h="abre"' + (abre ? " checked" : "") + ' aria-label="Abre el ' + U.DIAS[d] + '"><span></span></label>' +
        "<b>" + cap(U.DIAS[d]) + "</b>" +
        '<div class="ed-horas"><select class="input" data-h="ini" aria-label="El ' + U.DIAS[d] + ' abre a las">' + opcionesHora(ini) + "</select><span>a</span>" +
        '<select class="input" data-h="fin" aria-label="El ' + U.DIAS[d] + ' cierra a las">' + opcionesHora(fin) + "</select></div>" +
        '<span class="ed-cerrado">Cerrado</span></div>';
    }).join("") + "</div>";
  }
  function leerHorario(cont) {
    var h = {};
    $$("[data-dia]", cont).forEach(function (fila) {
      var d = Number(fila.getAttribute("data-dia"));
      h[d] = $("[data-h='abre']", fila).checked ? [Number($("[data-h='ini']", fila).value), Number($("[data-h='fin']", fila).value)] : null;
    });
    return h;
  }
  function validarHorario(h) {
    var abiertos = DIAS_ORDEN.filter(function (d) { return h[d]; });
    if (!abiertos.length) return "Abrí por lo menos un día a la semana.";
    var malo = abiertos.filter(function (d) { return h[d][1] - h[d][0] < 60; })[0];
    if (malo != null) return "El " + U.DIAS[malo] + " la hora de cierre tiene que ser por lo menos una hora después de abrir.";
    return "";
  }

  /* ---- Servicios y precios ---- */
  var DURACIONES = [10, 15, 20, 30, 40, 45, 60, 75, 90, 120];
  function servicioFila(s, i) {
    var durs = DURACIONES.indexOf(s.dur) >= 0 ? DURACIONES : DURACIONES.concat([s.dur]).sort(function (a, b) { return a - b; });
    return '<div class="ed-serv" data-serv="' + esc(s.id) + '">' +
      '<input class="input" data-s="nombre" value="' + esc(s.nombre) + '" placeholder="Ej.: Corte clásico" maxlength="40" aria-label="Nombre del servicio">' +
      '<select class="input" data-s="dur" aria-label="Duración de ' + esc(s.nombre || "este servicio") + '">' + durs.map(function (m) { return '<option value="' + m + '"' + (m === s.dur ? " selected" : "") + ">" + m + " min</option>"; }).join("") + "</select>" +
      '<div class="ed-precio"><span>$</span><input class="input" data-s="precio" inputmode="numeric" autocomplete="off" value="' + miles(s.precio) + '" placeholder="30.000" aria-label="Precio de ' + esc(s.nombre || "este servicio") + '"></div>' +
      (i === 0 ? '<span class="ed-principal" title="El servicio que más hacés: el asistente lo ofrece primero">Principal</span>'
        : '<button type="button" class="btn-ico" data-ed="quitar-serv" aria-label="Quitar ' + esc(s.nombre || "este servicio") + '">' + ico("x") + "</button>") +
      "</div>";
  }
  function serviciosHTML(lista) {
    return '<div class="ed-servicios" data-editor="servicios"><div class="ed-serv ed-serv--cab" aria-hidden="true"><span>Servicio</span><span>Duración</span><span>Precio</span><span></span></div>' +
      '<div class="ed-lista">' + lista.map(servicioFila).join("") + "</div>" +
      '<button type="button" class="btn btn--suave btn--sm ed-agregar" data-ed="agregar-serv">' + ico("mas") + "Agregar servicio</button></div>";
  }
  function leerServicios(cont, base) {
    var previos = {}; (base || []).forEach(function (s) { previos[s.id] = s; });
    return $$("[data-serv]", cont).map(function (fila) {
      var id = fila.getAttribute("data-serv"), p = previos[id] || {};
      return Object.assign({}, p, {
        id: id, nombre: $("[data-s='nombre']", fila).value.trim(), dur: Number($("[data-s='dur']", fila).value) || 30,
        precio: Number(digitos($("[data-s='precio']", fila).value)) || 0, desc: p.desc || ""
      });
    });
  }
  function validarServicios(lista) {
    if (!lista.length) return "Agregá por lo menos un servicio.";
    if (lista.some(function (s) { return !s.nombre; })) return "Ponele nombre a todos los servicios (o quitá los que no hacés).";
    var barato = lista.filter(function (s) { return s.precio < 1000; })[0];
    if (barato) return "Revisá el precio de «" + barato.nombre + "»: escribilo en pesos, por ejemplo 30.000.";
    return "";
  }
  function idNuevo(prefijo, ids) {
    var n = ids.reduce(function (m, id) { var x = parseInt(String(id).replace(/\D/g, ""), 10); return isNaN(x) ? m : Math.max(m, x); }, 0);
    return prefijo + (n + 1);
  }

  /* ---- Equipo (barberos) ---- */
  var PAGOS = [["porcentaje:0.6", "Gana el 60 %"], ["porcentaje:0.5", "Gana el 50 %"], ["porcentaje:0.7", "Gana el 70 %"], ["porcentaje:0.4", "Gana el 40 %"], ["alquiler", "Paga alquiler de silla"]];
  function barberoFila(b) {
    var pago = b.modo === "alquiler" ? "alquiler" : "porcentaje:" + (b.comision || 0.6);
    if (!PAGOS.some(function (p) { return p[0] === pago; })) PAGOS.push([pago, "Gana el " + Math.round((b.comision || 0) * 100) + " %"]);
    return '<div class="ed-barb" data-barb="' + esc(b.id) + '">' +
      '<span class="avatar avatar--sm" aria-hidden="true">' + esc(U.iniciales(b.nombre || "?")) + "</span>" +
      '<input class="input" data-b="nombre" value="' + esc(b.nombre) + '" placeholder="Nombre del barbero" maxlength="30" aria-label="Nombre del barbero">' +
      '<button type="button" class="btn-ico" data-ed="quitar-barb" aria-label="Quitar a ' + esc(b.nombre || "este barbero") + '">' + ico("x") + "</button>" +
      '<div class="ed-barb-mas"><select class="input" data-b="pago" aria-label="Cómo le pagás a ' + esc(b.nombre || "este barbero") + '">' +
      PAGOS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === pago ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select>" +
      (b.modo === "alquiler" ? '<div class="ed-precio"><span>$</span><input class="input" data-b="alquiler" inputmode="numeric" value="' + miles(b.alquiler) + '" placeholder="Alquiler por semana" aria-label="Alquiler semanal"></div>' : "") +
      '<input class="input" data-b="tel" inputmode="numeric" maxlength="12" value="' + esc(b.tel || "") + '" placeholder="Celular (opcional)" aria-label="Celular de ' + esc(b.nombre || "este barbero") + '">' +
      "</div></div>";
  }
  function barberosHTML(lista, nombreDueno) {
    var dueno = lista.filter(function (b) { return b.modo === "dueno"; })[0];
    var otros = lista.filter(function (b) { return b.modo !== "dueno"; });
    return '<div class="ed-equipo" data-editor="barberos" data-dueno-id="' + esc(dueno ? dueno.id : "b1") + '">' +
      '<div class="ed-dueno"><span class="avatar avatar--sm" aria-hidden="true">' + esc(U.iniciales(nombreDueno || "Yo")) + "</span>" +
      "<span><b>" + esc(nombreDueno || "Vos") + ' <small class="ed-rol">Dueño</small></b><small>¿También cortás? Si sí, aparecés en la agenda y te pueden reservar.</small></span>' +
      '<label class="switch"><input type="checkbox" data-b="corta"' + (dueno || !lista.length ? " checked" : "") + ' aria-label="Yo también corto"><span></span></label></div>' +
      '<div class="ed-lista">' + otros.map(barberoFila).join("") + "</div>" +
      '<button type="button" class="btn btn--suave btn--sm ed-agregar" data-ed="agregar-barb">' + ico("mas") + "Agregar barbero</button></div>";
  }
  function leerBarberos(cont, base, nombreDueno, telDueno) {
    var previos = {}; (base || []).forEach(function (b) { previos[b.id] = b; });
    var out = [];
    if ($("[data-b='corta']", cont).checked) {
      var idD = cont.getAttribute("data-dueno-id"), pd = previos[idD] || {};
      out.push(Object.assign({ alias: "", especialidades: [], rating: 5 }, pd, {
        id: idD, nombre: nombreDueno || pd.nombre || "Dueño", rol: "Dueño", modo: "dueno", comision: 1, alquiler: 0, tel: telDueno != null ? telDueno : (pd.tel || "")
      }));
    }
    $$("[data-barb]", cont).forEach(function (fila) {
      var id = fila.getAttribute("data-barb"), p = previos[id] || {};
      var pago = $("[data-b='pago']", fila).value, alq = $("[data-b='alquiler']", fila);
      out.push(Object.assign({ alias: "", especialidades: [], rating: 5 }, p, {
        id: id, nombre: $("[data-b='nombre']", fila).value.trim(), rol: "Barbero",
        modo: pago === "alquiler" ? "alquiler" : "porcentaje",
        comision: pago === "alquiler" ? 1 : Number(pago.split(":")[1]) || 0.6,
        alquiler: pago === "alquiler" ? Number(digitos(alq ? alq.value : p.alquiler)) || 0 : 0,
        tel: telValido($("[data-b='tel']", fila).value)
      }));
    });
    return out;
  }
  function validarBarberos(lista) {
    if (!lista.length) return "Tiene que haber por lo menos una persona cortando: prendé «¿También cortás?» o agregá un barbero.";
    if (lista.some(function (b) { return !b.nombre; })) return "Escribí el nombre de cada barbero (o quitá la fila vacía).";
    return "";
  }

  /* ---- Agregar / quitar filas y cambios en vivo (sirve en el registro y en Ajustes) ---- */
  function baseDe(cont) {
    if (REG && cont.closest("[data-registro]")) return cont.getAttribute("data-editor") === "servicios" ? REG.d.servicios : REG.d.barberos;
    var st = BS.get(); return cont.getAttribute("data-editor") === "servicios" ? st.servicios : st.barberos;
  }
  function repintarBarberos(cont, lista) {
    // Repinta solo las filas: el interruptor del dueño se queda como está
    $(".ed-lista", cont).innerHTML = lista.filter(function (b) { return b.modo !== "dueno"; }).map(barberoFila).join("");
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-ed]");
    if (!el) return;
    var cont = el.closest("[data-editor]"), acc = el.getAttribute("data-ed");
    if (!cont) return;
    e.preventDefault();
    if (acc === "agregar-serv" || acc === "quitar-serv") {
      var ls = leerServicios(cont, baseDe(cont));
      if (acc === "quitar-serv") { var id = el.closest("[data-serv]").getAttribute("data-serv"); ls = ls.filter(function (s) { return s.id !== id; }); }
      else ls.push({ id: idNuevo("s", ls.map(function (s) { return s.id; }).concat(baseDe(cont).map(function (s) { return s.id; }))), nombre: "", dur: 30, precio: 0, desc: "" });
      $(".ed-lista", cont).innerHTML = ls.map(servicioFila).join("");
      if (acc === "agregar-serv") { var ult = $$("[data-s='nombre']", cont).pop(); if (ult) ult.focus(); }
    }
    if (acc === "agregar-barb" || acc === "quitar-barb") {
      var lb = leerBarberos(cont, baseDe(cont), "", "");
      if (acc === "quitar-barb") { var idb = el.closest("[data-barb]").getAttribute("data-barb"); lb = lb.filter(function (b) { return b.id !== idb; }); }
      else lb.push({ id: idNuevo("b", lb.map(function (b) { return b.id; }).concat(baseDe(cont).map(function (b) { return b.id; })).concat([cont.getAttribute("data-dueno-id")])), nombre: "", modo: "porcentaje", comision: 0.6, alquiler: 0, tel: "" });
      repintarBarberos(cont, lb);
      if (acc === "agregar-barb") { var ub = $$("[data-b='nombre']", cont).pop(); if (ub) ub.focus(); }
    }
  });
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.matches("[data-h='abre']")) { el.closest("[data-dia]").classList.toggle("is-cerrado", !el.checked); return; }
    if (el.matches("[data-b='pago']")) {
      var cont = el.closest("[data-editor]");
      repintarBarberos(cont, leerBarberos(cont, baseDe(cont), "", ""));
    }
  });
  document.addEventListener("input", function (e) {
    var el = e.target;
    // Precios con puntos de miles mientras se escriben: 30000 → 30.000
    if (el.matches("[data-s='precio'], [data-b='alquiler']")) { var v = digitos(el.value).slice(0, 8); el.value = v ? miles(v) : ""; }
    if (el.matches("[data-b='nombre']")) { var av = $(".avatar", el.closest("[data-barb]")); if (av) av.textContent = U.iniciales(el.value || "?"); }
  });

  APP.editores = {
    horarioHTML: horarioHTML, leerHorario: leerHorario, validarHorario: validarHorario,
    serviciosHTML: serviciosHTML, leerServicios: leerServicios, validarServicios: validarServicios,
    barberosHTML: barberosHTML, leerBarberos: leerBarberos, validarBarberos: validarBarberos
  };

  /* ==========================================================================
     LO QUE SE LE MANDA AL CLIENTE
     ========================================================================== */
  function linkCliente() {
    return enServidor() ? BS.linkReservas() : new URL("../reserva/index.html", location.href).href;
  }
  function mensajeCliente() {
    var s = BS.get().shop;
    return "¡Hola! 💈 Ya podés reservar tu turno en " + s.nombre + " desde el celular: elegís el servicio, el barbero y la hora, y listo. Sin esperar a que te respondan.\n👉 " + linkCliente();
  }
  /** Tarjeta para compartir el link de reservas. op.compacta: versión corta para el panel vacío. */
  function compartirHTML(op) {
    op = op || {};
    var link = linkCliente(), real = enServidor();
    var burbuja = '<div class="cp-chat" aria-label="Así le llega el mensaje a tu cliente por WhatsApp"><span class="cp-chat-k">' + ico("chat") + "Así le llega a tu cliente</span>" +
      '<div class="msg msg--out cp-msg">' + esc(mensajeCliente()).replace(esc(link), '<span class="cp-link">' + esc(link) + "</span>").replace(/\n/g, "<br>") + "</div></div>";
    var botones = '<div class="cp-acc">' +
      (real ? '<button type="button" class="btn" data-cp="compartir">' + ico("enviar") + "Compartir por WhatsApp</button>" : "") +
      '<a class="btn' + (real ? " btn--suave" : "") + '" href="' + esc(real ? link : "../reserva/index.html") + '" target="_blank" rel="noopener">' + ico("externo") + "Abrir como cliente</a>" +
      '<button type="button" class="btn btn--suave" data-cp="copiar">' + ico("copiar") + "Copiar mensaje</button>" +
      (real ? '<button type="button" class="btn btn--ghost" data-cp="qr">' + ico("qr") + "QR para el local</button>" : "") + "</div>";
    var nota = real ? "" : '<p class="cp-nota">Estás en la demo: tu barbería vive en este navegador, así que el link solo la muestra aquí. Con tu cuenta real, cualquier cliente lo abre desde su celular.</p>';
    if (op.compacta) {
      return '<section class="card cp cp--compacta"><div class="cp-txt"><p class="eyebrow">Siguiente paso</p><h2>Tu agenda está lista. Ahora mandales el link a tus clientes.</h2>' +
        "<p>Ellos reservan solos y cada cita cae aquí. Pegalo en tus estados de WhatsApp, en la bio de Instagram y mandáselo a tus clientes de siempre.</p>" + botones + nota + "</div>" + burbuja + "</section>";
    }
    return '<div class="cp"><div class="cp-txt"><div class="cp-link-caja"><span class="campo-k">Tu link de reservas</span><span class="cp-url">' + esc(link.replace(/^https?:\/\//, "")) + "</span></div>" +
      burbuja + botones + nota + "</div></div>";
  }
  APP.compartirHTML = compartirHTML;
  APP.mostrarCompartir = function () { var st = BS.get(); return !BS.esEjemplo() && st && st.citas.length === 0; };

  function copiar(texto) {
    var ok = function () { APP.toastSimple("Mensaje copiado. Pegalo en WhatsApp, Instagram o donde querás.", "copiar", "Listo"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, function () { prompt("Copiá el mensaje:", texto); });
    else prompt("Copiá el mensaje:", texto);
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-cp]");
    if (!el) return;
    e.preventDefault();
    var acc = el.getAttribute("data-cp"), msg = mensajeCliente();
    if (APP.marcarPaso) APP.marcarPaso("compartio"); // primeros pasos: ya mandó (o copió) su link
    if (acc === "copiar") copiar(msg);
    if (acc === "compartir") {
      if (navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) navigator.share({ title: BS.get().shop.nombre, text: msg }).catch(function () {});
      else window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank", "noopener");
    }
    if (acc === "qr" && APP.descargarAfiche) APP.descargarAfiche({
      link: linkCliente(), kicker: "RESERVAS EN LÍNEA", linea1: "Escaneá y reservá", linea2: "tu próximo corte",
      pie: "Elegís servicio, barbero y hora. Sin esperar respuesta.", archivo: "qr-reservas-" + BS.get().shop.slug + ".png"
    });
  });

  /* ==========================================================================
     REGISTRO PASO A PASO
     ========================================================================== */
  var PASOS = [
    { id: "barberia", nav: "Tu barbería", titulo: "¿Cómo se llama tu barbería?", sub: "Así te van a ver tus clientes cuando reserven." },
    { id: "ubicacion", nav: "Ubicación", titulo: "¿Dónde quedás?", sub: "La dirección sale en tu página de reservas y en los recordatorios." },
    { id: "horario", nav: "Horario", titulo: "¿Qué días y a qué horas atendés?", sub: "Solo se pueden reservar turnos dentro de este horario. Lo cambiás cuando querás en Ajustes." },
    { id: "servicios", nav: "Servicios y precios", titulo: "¿Qué hacés y cuánto cobrás?", sub: "Te dejamos los más comunes para que solo ajustes los precios. Quitá los que no hacés y agregá los tuyos." },
    { id: "equipo", nav: "Tu equipo", titulo: "¿Quiénes cortan?", sub: "Cada barbero tiene su columna en la agenda y los clientes lo pueden elegir." },
    { id: "listo", nav: "Mandale el link", titulo: "", sub: "" }
  ];
  var REG = null;

  function datosIniciales() {
    var st = BS.get(), demo = !enServidor();
    if (!demo && st) {
      var s = st.shop;
      return {
        nombre: s.nombre || "", dueno: s.dueno || "", whatsapp: s.whatsapp || "",
        barrio: APP.BARRIOS.indexOf(s.barrio) >= 0 ? s.barrio : APP.BARRIOS[0], direccion: /,\s*Medell[ií]n$|^Medell[ií]n$/.test(s.direccion || "") ? "" : s.direccion || "",
        horario: clonar(s.horario || BS.horarioBase()), servicios: clonar(st.servicios || BS.serviciosBase()), barberos: clonar(st.barberos || [])
      };
    }
    return { nombre: "", dueno: "", whatsapp: "", barrio: APP.BARRIOS[0], direccion: "", horario: BS.horarioBase(), servicios: BS.serviciosBase(), barberos: [] };
  }

  function ladoHTML() {
    var activo = REG.paso;
    return '<aside class="reg-lado"><a class="logo" href="../index.html" title="Volver a la página de Barber SaaS"><span class="logo-mark"><span class="poste"></span></span><span><b>Barber</b><span>SaaS</span></span></a>' +
      '<div class="reg-lado-txt"><p class="eyebrow">' + (REG.creada ? "Tu barbería está lista" : "Creá tu barbería") + "</p><h2>" + (REG.creada ? "Ya podés recibir reservas." : "Cinco pasos y tu agenda queda andando.") + "</h2></div>" +
      '<ol class="reg-pasos">' + PASOS.map(function (p, i) {
        var est = i < activo || REG.creada ? "is-hecho" : i === activo ? "is-activo" : "";
        return '<li class="' + est + '"' + (i === activo ? ' aria-current="step"' : "") + '><i aria-hidden="true">' + (est === "is-hecho" ? ico("check") : p.id === "listo" ? ico("enviar") : i + 1) + "</i><span>" + p.nav + "</span></li>";
      }).join("") + "</ol>" +
      '<p class="reg-lado-pie">' + (enServidor() ? 'Lo que llenes se guarda en tu cuenta. <button type="button" class="link" data-reg="salir">Salir</button>'
        : "Es una demo: todo queda guardado en este navegador.") + "</p></aside>";
  }

  function campo(id, etiqueta, valor, extra, ayuda) {
    return '<div class="campo"><label for="reg-' + id + '">' + etiqueta + '</label><input class="input" id="reg-' + id + '" data-r="' + id + '" value="' + esc(valor || "") + '"' + (extra || "") + ">" +
      (ayuda ? '<span class="campo-ayuda">' + ayuda + "</span>" : "") + "</div>";
  }

  function cuerpoPaso(id) {
    var d = REG.d;
    if (id === "barberia") {
      var previa = !enServidor() && REG.previa ? '<div class="aviso-auto">' + ico("tienda") + '<div>Ya tenés <b>«' + esc(REG.previa) + '»</b> guardada en este navegador. Si creás otra, la reemplaza. <button type="button" class="link" data-reg="ir-panel">Ir a mi panel' + ico("flecha") + "</button></div></div>" : "";
      return previa + '<div class="form">' +
        campo("nombre", "Nombre de la barbería", d.nombre, ' maxlength="60" autocomplete="organization" placeholder="Ej.: La Esquina Barber Club"') +
        '<div class="form-fila">' + campo("dueno", "Tu nombre", d.dueno, ' maxlength="40" autocomplete="given-name" placeholder="Ej.: Andrés"') +
        '<div class="campo"><label for="reg-whatsapp">WhatsApp de la barbería</label><div class="reg-tel"><span>+57</span><input class="input" id="reg-whatsapp" data-r="whatsapp" inputmode="numeric" maxlength="12" autocomplete="tel-national" placeholder="300 123 4567" value="' + esc(d.whatsapp) + '"></div>' +
        '<span class="campo-ayuda">Ahí te llegan los avisos y el cierre de caja. Opcional.</span></div></div></div>' +
        (!enServidor() ? '<p class="reg-alt">¿Solo querés mirar cómo funciona? <a class="link" href="index.html?demo=1">Ver una barbería de ejemplo' + ico("flecha") + "</a></p>" : "");
    }
    if (id === "ubicacion") {
      return '<div class="form"><div class="campo"><label for="reg-barrio">Barrio o municipio</label><select class="input" id="reg-barrio" data-r="barrio">' +
        APP.BARRIOS.map(function (b) { return "<option" + (b === d.barrio ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + "</select></div>" +
        campo("direccion", "Dirección", d.direccion, ' maxlength="90" autocomplete="street-address" placeholder="Ej.: Cra. 76 #33A-12, local 2"', "Si es un segundo piso o un local adentro de algo, ponelo aquí para que nadie se pierda.") + "</div>";
    }
    if (id === "horario") return horarioHTML(d.horario);
    if (id === "servicios") return serviciosHTML(d.servicios);
    if (id === "equipo") return barberosHTML(d.barberos, d.dueno);
    return "";
  }

  function listoHTML() {
    var st = BS.get(), s = st.shop;
    var dias = DIAS_ORDEN.filter(function (d) { return s.horario[d]; }).length;
    return '<div class="reg-listo"><div class="reg-listo-txt"><span class="reg-ok" aria-hidden="true">' + ico("check") + "</span>" +
      '<h1 id="reg-titulo">¡' + esc(s.nombre) + " ya está andando!</h1>" +
      '<p class="reg-sub">Tu agenda arrancó vacía, lista para las primeras reservas. Ahora viene lo importante: <b>que tus clientes tengan tu link</b>. Ellos reservan solos y cada cita cae directo en tu agenda.</p>' +
      '<div class="reg-resumen"><span>' + ico("tijeras") + st.servicios.length + (st.servicios.length === 1 ? " servicio" : " servicios") + "</span><span>" + ico("usuario") + st.barberos.length + (st.barberos.length === 1 ? " barbero" : " barberos") + "</span><span>" + ico("reloj") + dias + (dias === 1 ? " día" : " días") + " a la semana</span><span>" + ico("rayo") + "12 automatizaciones listas</span></div>" +
      compartirHTML() +
      '<p class="reg-explorar">' + ico("web") + '<span>Tu barbería también aparece en <a class="link" href="../explorar/" target="_blank" rel="noopener">Explorar</a>, el buscador de Barber SaaS, para que te encuentren clientes nuevos. Lo apagás en Ajustes cuando querás.</span></p>' +
      '<div class="reg-pie"><span></span><button type="button" class="btn btn--lg" data-reg="ir-panel">Ir a mi agenda' + ico("flecha", "flecha") + "</button></div></div>" +
      '<div class="reg-tel-marco" aria-label="Vista previa de tu página de reservas"><span class="reg-tel-k">Así ve tu cliente la página</span><div class="reg-tel-pantalla"><iframe src="' + esc(enServidor() ? BS.linkReservas() : "../reserva/index.html") + '" title="Tu página de reservas, como la ve el cliente" loading="lazy"></iframe></div></div></div>';
  }

  function pintar(enfocar) {
    var cont = $("[data-registro]"), p = PASOS[REG.paso];
    var cuerpo;
    if (p.id === "listo") cuerpo = listoHTML();
    else {
      var ultimo = REG.paso === PASOS.length - 2;
      cuerpo = '<div class="reg-card"><p class="reg-num">Paso ' + (REG.paso + 1) + " de " + (PASOS.length - 1) + "</p>" +
        '<div class="reg-progreso" aria-hidden="true"><span class="poste is-on" style="width:' + ((REG.paso + 1) / (PASOS.length - 1)) * 100 + '%"></span></div>' +
        '<h1 id="reg-titulo">' + p.titulo + '</h1><p class="reg-sub">' + p.sub + "</p>" +
        '<div class="reg-cuerpo" data-reg-cuerpo>' + cuerpoPaso(p.id) + "</div>" +
        '<p class="reg-error" role="alert" data-reg-error' + (REG.error ? "" : " hidden") + ">" + esc(REG.error || "") + "</p>" +
        '<div class="reg-pie">' + (REG.paso > 0 ? '<button type="button" class="btn btn--ghost" data-reg="atras">' + ico("chevI") + "Atrás</button>" : "<span></span>") +
        '<button type="button" class="btn btn--lg" data-reg="siguiente">' + (ultimo ? (enServidor() ? "Guardar y terminar" : "Crear mi barbería") : "Siguiente") + ico("flecha", "flecha") + "</button></div></div>";
    }
    cont.innerHTML = '<div class="reg' + (p.id === "listo" ? " reg--listo" : "") + '">' + ladoHTML() + '<main class="reg-main" aria-labelledby="reg-titulo">' + cuerpo + "</main></div>";
    cont.scrollTop = 0; window.scrollTo(0, 0);
    if (enfocar !== false) {
      var primero = $("[data-reg-cuerpo] input:not([type=checkbox]), [data-reg-cuerpo] select", cont);
      if (primero && p.id !== "horario") setTimeout(function () { primero.focus(); }, 60);
    }
  }

  function guardarPaso() {
    var d = REG.d, c = $("[data-reg-cuerpo]"), id = PASOS[REG.paso].id;
    if (!c) return;
    function v(k) { var el = $("[data-r='" + k + "']", c); return el ? el.value.trim() : ""; }
    if (id === "barberia") { d.nombre = v("nombre"); d.dueno = v("dueno"); d.whatsapp = digitos(v("whatsapp")); }
    if (id === "ubicacion") { d.barrio = v("barrio"); d.direccion = v("direccion"); }
    if (id === "horario") d.horario = leerHorario($("[data-editor='horario']", c));
    if (id === "servicios") d.servicios = leerServicios($("[data-editor='servicios']", c), d.servicios);
    if (id === "equipo") d.barberos = leerBarberos($("[data-editor='barberos']", c), d.barberos, d.dueno, telValido(d.whatsapp));
  }
  function validarPaso() {
    var d = REG.d, id = PASOS[REG.paso].id;
    if (id === "barberia") {
      if (d.nombre.length < 2) return ["nombre", "Escribí el nombre de tu barbería."];
      if (d.dueno.length < 2) return ["dueno", "Escribí tu nombre."];
      if (d.whatsapp && !telValido(d.whatsapp)) return ["whatsapp", "Revisá el WhatsApp: son 10 números y empieza por 3."];
    }
    if (id === "ubicacion" && d.direccion.length < 5) return ["direccion", "Escribí la dirección para que tus clientes lleguen."];
    if (id === "horario") { var eh = validarHorario(d.horario); if (eh) return [null, eh]; }
    if (id === "servicios") { var es = validarServicios(d.servicios); if (es) return [null, es]; }
    if (id === "equipo") { var eb = validarBarberos(d.barberos); if (eb) return [null, eb]; }
    return null;
  }
  function mostrarError(err) {
    REG.error = err ? err[1] : "";
    var el = $("[data-reg-error]");
    if (el) { el.textContent = REG.error; el.hidden = !REG.error; }
    $$("[aria-invalid]", $("[data-registro]")).forEach(function (x) { x.removeAttribute("aria-invalid"); });
    if (err && err[0]) { var inp = $("[data-r='" + err[0] + "']"); if (inp) { inp.setAttribute("aria-invalid", "true"); inp.focus(); } }
  }

  /** Guarda la barbería con todo lo del registro. */
  function crear() {
    var d = REG.d;
    var shop = { nombre: d.nombre, dueno: d.dueno, whatsapp: telValido(d.whatsapp), barrio: d.barrio, direccion: d.direccion, horario: d.horario, onboarded: true };
    if (enServidor()) {
      var st = BS.get();
      Object.assign(st.shop, shop);
      st.servicios = d.servicios; st.barberos = d.barberos;
      BS.actividad({ tipo: "check", texto: "Configuraste tu barbería: " + d.servicios.length + " servicios, " + d.barberos.length + " barberos y tu horario." });
      BS.commit("registro");
    } else {
      BS.crearLocal(BS.estadoNuevo(Object.assign({}, shop, { slug: slugDe(d.nombre), servicios: d.servicios, barberos: d.barberos })));
    }
    REG.creada = true;
    REG.paso = PASOS.length - 1;
    REG.error = "";
    pintar(false);
  }

  function cerrar() {
    var fin = REG && REG.alTerminar;
    REG = null;
    var cont = $("[data-registro]");
    cont.hidden = true; cont.innerHTML = "";
    document.body.classList.remove("en-registro");
    history.replaceState(null, "", location.pathname + "#/agenda");
    if (fin) fin();
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-reg]");
    if (!el || !REG) return;
    e.preventDefault();
    var acc = el.getAttribute("data-reg");
    if (acc === "siguiente") {
      guardarPaso();
      var err = validarPaso();
      if (err) { mostrarError(err); return; }
      REG.error = "";
      if (REG.paso === PASOS.length - 2) { crear(); return; }
      REG.paso++; pintar();
    }
    if (acc === "atras") { guardarPaso(); REG.error = ""; REG.paso = Math.max(0, REG.paso - 1); pintar(); }
    if (acc === "ir-panel") cerrar();
    if (acc === "salir" && BS.conexion && BS.conexion.salir) BS.conexion.salir();
  });
  // Enter en un campo de texto = «Siguiente»
  document.addEventListener("keydown", function (e) {
    if (!REG || e.key !== "Enter" || !e.target.matches("[data-registro] input:not([type=checkbox])")) return;
    var btn = $("[data-reg='siguiente']");
    if (btn) { e.preventDefault(); btn.click(); }
  });

  APP.registro = {
    /** Abre el registro. op.alTerminar: se llama al ir al panel. op.previa: nombre de la barbería que ya hay en este navegador. */
    abrir: function (op) {
      op = op || {};
      REG = { paso: 0, d: datosIniciales(), alTerminar: op.alTerminar, previa: op.previa || "", creada: false, error: "" };
      document.body.classList.add("en-registro");
      $("[data-registro]").hidden = false;
      pintar();
    },
    activo: function () { return !!REG; }
  };
})();
