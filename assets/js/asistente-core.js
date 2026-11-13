/* ==========================================================================
   Barber SaaS — Cerebro del asistente de WhatsApp (compartido)
   La misma lógica responde en el simulador del panel (navegador) y en el
   WhatsApp real (servidor). Entiende español de Medellín, ofrece turnos reales
   de la agenda, agenda, pide el anticipo y anota en la fila virtual.

   Uso:  var conv = BS.asistente.nuevaConv(clienteId);
         var r = BS.asistente.responder(conv, "¿hay turno mañana tipo 4?");
         r.respuestas → [{ de:"bot", texto, rapidas?, pago? }]
   ========================================================================== */
(function () {
  "use strict";
  var BS = (typeof window !== "undefined" ? window : globalThis).BS;
  var U = BS.util;
  var conv = null; // conversación en curso durante una llamada (todo es síncrono)

  function t(paisa, neutro) { return conv && conv.tono === "neutro" ? neutro : paisa; }

  function nuevaConv(clienteId, tono) {
    var cli = clienteId ? BS.cliente(clienteId) : null;
    return {
      cliente: cli ? cli.id : null, nombre: cli ? U.primerNombre(cli.nombre) : "", tono: tono || (BS.get().shop.tono || "paisa"),
      mensajes: [], estado: { paso: "inicio" }, ultimo: null, ultimoEstado: null, cita: null, fila: null
    };
  }

  /* ---------------- Entender el mensaje ---------------- */
  var NUM = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12 };
  var DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  function prueba(re, t2) { return re.test(t2); }

  function entender(texto, c) {
    var t2 = " " + U.normalizar(texto).replace(/[¿?¡!,;()"'+]/g, " ").replace(/:(?!\d)/g, " ").replace(/\.(?!\d)/g, " ").replace(/\s+/g, " ") + " ";
    var r = { texto: texto, nuevos: {} };
    function pon(k, v) { r[k] = v; r.nuevos[k] = true; }

    if (prueba(/ (en|por|de) la manana /, t2)) { pon("franja", "manana"); t2 = t2.replace(/ (en|por|de) la manana /g, " "); }
    else if (prueba(/ (en|por|de) la tarde | tarde(cita)? | despues de almuerzo /, t2)) pon("franja", "tarde");
    else if (prueba(/ (en|por|de) la noche | noche | nochecita /, t2)) pon("franja", "noche");
    else if (prueba(/ mediodia | medio dia /, t2)) pon("franja", "mediodia");

    if (prueba(/ pasado manana /, t2)) pon("dia", 2);
    else if (prueba(/ manana /, t2)) pon("dia", 1);
    else if (prueba(/ hoy | ahorita | ya mismo | ahora /, t2)) pon("dia", 0);
    else {
      for (var i = 0; i < 7; i++) {
        if (t2.indexOf(" " + DIAS[i] + " ") >= 0) { var d = (i - new Date().getDay() + 7) % 7; pon("dia", d === 0 ? 7 : d); break; }
      }
    }

    var reHora = / (a las |tipo las |tipo |como a las |a eso de las |sobre las |las |a la )?(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:[:h.](\d{2}))?( y media| y cuarto)?(?! ?(?:anos|ano|personas|minutos|min|mil|pesos|dias|semanas|cortes|turnos))\s?(am|a m|pm|p m|de la tarde|de la noche)? /;
    var mh = t2.match(reHora);
    if (mh && isNaN(parseInt(mh[2], 10)) && !mh[1]) mh = null; // «una barba» no es una hora
    if (mh && !/^ ?[123] ?$/.test(t2) && !/ \d{5,}/.test(t2)) {
      var h = NUM[mh[2]] || parseInt(mh[2], 10);
      var mm = mh[3] ? parseInt(mh[3], 10) : mh[4] === " y media" ? 30 : mh[4] === " y cuarto" ? 15 : 0;
      var suf = mh[5] || "";
      if (h >= 1 && h <= 23 && mm < 60) {
        if (/pm|p m|tarde|noche/.test(suf) || r.franja === "tarde" || r.franja === "noche") { if (h < 12) h += 12; }
        else if (/am|a m/.test(suf) || r.franja === "manana") { if (h === 12) h = 0; }
        else if (h >= 1 && h <= 7) h += 12;
        pon("hora", h * 60 + mm);
      }
    }

    if (prueba(/ barba /, t2) && prueba(/ corte| motil| pelo | cabello | peluque| fade | degradad/, t2)) pon("servicio", "s2");
    else if (prueba(/ combo | completo /, t2)) pon("servicio", "s2");
    else if (prueba(/ barba /, t2)) pon("servicio", "s3");
    else if (prueba(/ nino | ninos | hijo | pelado | nina /, t2)) pon("servicio", "s4");
    else if (prueba(/ ceja/, t2)) pon("servicio", "s6");
    else if (prueba(/ disen| lineas? | rayas? | figura/, t2)) pon("servicio", "s5");
    else if (prueba(/ mascarilla | limpieza /, t2)) pon("servicio", "s7");
    else if (prueba(/ corte | cortar| motil| peluque| pelo | cabello | fade | degradad| recort| cortico /, t2)) pon("servicio", "s1");
    if (r.servicio && !BS.servicio(r.servicio)) { delete r.servicio; delete r.nuevos.servicio; }

    BS.get().barberos.forEach(function (b) {
      var claves = [U.normalizar(b.nombre)].concat(b.alias ? [U.normalizar(b.alias)] : []);
      if (U.normalizar(b.nombre) === "sebastian") claves.push("sebas");
      if (b.rol === "Dueño" && b.alias && /profe/i.test(b.alias)) claves.push("profe");
      if (claves.some(function (k) { return k && (t2.indexOf(" " + k + " ") >= 0 || t2.indexOf(" el " + k + " ") >= 0); })) pon("barbero", b.id);
    });
    if (!r.barbero && prueba(/ cualquiera | el que sea | quien sea | el que este | me da igual | el que haya /, t2)) pon("barbero", "cualquiera");

    var limpio = t2.trim();
    if (/^(1|uno|la 1|la primera|primera|el primero)$/.test(limpio)) r.opcion = 0;
    else if (/^(2|dos|la 2|la segunda|segunda|el segundo)$/.test(limpio)) r.opcion = 1;
    else if (/^(3|tres|la 3|la tercera|tercera|la ultima|el tercero)$/.test(limpio)) r.opcion = 2;

    if (prueba(/ cancel| no puedo ir | no voy a poder | no alcanzo /, t2)) r.intencion = "cancelar";
    else if (prueba(/ cambiar | reprogram| mover | cambio la hora | correr el turno /, t2)) r.intencion = "cambiar";
    else if (prueba(/ salir | me salgo /, t2) && c && c.fila) r.intencion = "salir";
    else if (prueba(/ fila | sin cita | llegar asi | cuanta gente | cuantos hay | hay gente | esta lleno | anotame | anoteme | me anoto | por orden de llegada /, t2)) r.intencion = "fila";
    else if (prueba(/ precio| cuanto | vale | valen | cobran | valor | tarifa| cuesta /, t2)) r.intencion = "precio";
    else if (prueba(/ donde | direccion | ubicad| queda | como llego | ubicacion /, t2)) r.intencion = "ubicacion";
    else if (prueba(/ horario | abren | cierran | hasta que hora | atienden /, t2)) r.intencion = "horario";
    else if (prueba(/^ (si|sii|sí|dale|de una|listo|ok|okay|va|vale|perfecto|claro|confirmo|esa|ese|bueno|hagale|hagamosle|me sirve|sirve|guardamelo|guardame)/, t2)) r.intencion = "afirmar";
    else if (prueba(/^ (no|nel|mejor no|ninguna|otra|otro)( |$)/, t2)) r.intencion = "negar";
    else if (prueba(/ (gracias|grax|bacano|melo|chimba|super|excelente|genial) /, t2)) r.intencion = "gracias";
    else if (prueba(/ turno | cita | agend| reserv| espacio | cupo | campo | puedo ir | me atienden | hay chance | disponib| quiero | me hago | motilar | motilada /, t2)) r.intencion = "reservar";
    else if (prueba(/^ (hola|buenas|buenos|buen dia|que mas|quiubo|quibo|q mas|que hubo|hey|ey|parce|holi|buenas tardes|buenas noches)/, t2)) r.intencion = "saludo";

    if (!r.intencion && (r.servicio || r.dia != null || r.hora != null || r.barbero || r.franja)) r.intencion = "reservar";
    return r;
  }

  /* ---------------- Responder ---------------- */
  function bot(texto, extra) {
    texto = String(texto).replace(/m\.(\*?)\./g, "m.$1");
    return Object.assign({ de: "bot", texto: texto, hora: new Date().toISOString() }, extra || {});
  }
  function rangoFranja(f) { return { manana: [0, 719], mediodia: [720, 839], tarde: [840, 1079], noche: [1080, 1440] }[f]; }
  function nombreDia(n, fecha) { return n === 0 ? "hoy" : n === 1 ? "mañana" : "el " + U.DIAS[fecha.getDay()]; }
  function etiquetaSlot(s, conBarbero) { return U.hora(U.enMin(U.hoy0(), s.min)) + (conBarbero ? " con " + BS.barbero(s.barbero).nombre : ""); }
  function primerServicio(lista) { return lista.filter(function (n) { return BS.get().servicios.some(function (s) { return s.nombre === n; }); }); }

  function elegirOpciones(slots, e) {
    var lista = slots.slice();
    if (e.hora != null) {
      lista.sort(function (a, b) { return Math.abs(a.min - e.hora) - Math.abs(b.min - e.hora); });
      return lista.slice(0, 3).sort(function (a, b) { return a.min - b.min; });
    }
    if (e.franja) {
      var r = rangoFranja(e.franja);
      var enRango = lista.filter(function (s) { return s.min >= r[0] && s.min <= r[1]; });
      if (enRango.length) lista = enRango;
    }
    if (lista.length <= 3) return lista;
    var paso = Math.floor(lista.length / 3);
    return [lista[0], lista[paso], lista[Math.min(lista.length - 1, paso * 2)]];
  }

  function flujoReserva() {
    var e = conv.estado;
    if (!e.servicio) {
      e.paso = "servicio";
      return [bot(t("¿Qué te vas a hacer, parce? 💈", "¿Qué servicio te gustaría? 💈"), { rapidas: primerServicio(["Corte", "Corte + barba", "Barba", "Cejas"]) })];
    }
    var n = e.dia;
    if (n == null) {
      if (e.hora != null || e.franja) n = 0;
      else {
        e.paso = "dia";
        var d2 = U.addDias(U.hoy0(), 2);
        return [bot("¿Para qué día? 📅", { rapidas: ["Hoy", "Mañana", U.DIAS[d2.getDay()].charAt(0).toUpperCase() + U.DIAS[d2.getDay()].slice(1)] })];
      }
    }
    var barbero = e.barbero && BS.barbero(e.barbero) ? e.barbero : "cualquiera";
    var intentos = 0, fecha, slots = [];
    while (intentos < 5) {
      fecha = U.addDias(U.hoy0(), n + intentos);
      if (BS.horario(fecha)) slots = BS.slotsLibres(fecha, e.servicio, barbero);
      if (slots.length) break;
      intentos++;
    }
    var nb = barbero !== "cualquiera" ? BS.barbero(barbero).nombre : null;
    if (!slots.length) {
      e.paso = "espera-ofrecida";
      return [bot("Uy, " + (nb ? nb + " está" : "estamos") + " a reventar esta semana 😅 ¿Querés que te anote en la lista de espera? Si alguien cancela, te aviso de una.", { rapidas: ["Sí, anotame"].concat(nb ? ["Otro barbero"] : []) })];
    }
    // Pidió una hora con un barbero que la tiene ocupada: ofrecer esa hora con otro barbero
    if (e.hora != null && barbero !== "cualquiera" && intentos === 0 && !slots.some(function (s) { return Math.abs(s.min - e.hora) <= 60; })) {
      var otros = BS.slotsLibres(fecha, e.servicio, "cualquiera").filter(function (s) { return Math.abs(s.min - e.hora) <= 60; });
      if (otros.length) {
        otros.sort(function (a, b) { return Math.abs(a.min - e.hora) - Math.abs(b.min - e.hora); });
        var alt = otros.slice(0, 2).sort(function (a, b) { return a.min - b.min; });
        e.opciones = alt; e.fecha = fecha.toISOString(); e.paso = "eligiendo"; e.diaN = n;
        return [bot("Con " + nb + " " + nombreDia(n, fecha) + " a esa hora no me queda 😕 pero tengo " + alt.map(function (o) { return "*" + etiquetaSlot(o, true) + "*"; }).join(" o ") + ". ¿Te sirve?",
          { rapidas: alt.map(function (o) { return U.hora(U.enMin(U.hoy0(), o.min)); }).concat(["Otra hora con " + nb]) })];
      }
    }
    var opciones = elegirOpciones(slots, e);
    var nReal = n + intentos;
    e.opciones = opciones; e.fecha = fecha.toISOString(); e.paso = "eligiendo"; e.diaN = nReal;
    var conB = barbero === "cualquiera";
    // Si todos los turnos son del mismo barbero, se nombra una sola vez
    if (conB && opciones.length > 1 && opciones.every(function (o) { return o.barbero === opciones[0].barbero; })) { conB = false; nb = BS.barbero(opciones[0].barbero).nombre; }
    var pref = intentos > 0 ? "Uy, " + nombreDia(n, U.addDias(U.hoy0(), n)) + " ya no tengo turnos 😕 " : "";
    var dia = nombreDia(nReal, fecha);
    var diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
    if (e.hora != null && opciones.some(function (o) { return o.min === e.hora; }) && intentos === 0) {
      var exacta = opciones.filter(function (o) { return o.min === e.hora; })[0];
      e.opciones = [exacta].concat(opciones.filter(function (o) { return o !== exacta; }));
      return [bot(t("¡De una! ", "¡Perfecto! ") + diaCap + " a las *" + U.horaMin(exacta.min) + "* con " + BS.barbero(exacta.barbero).nombre + " está libre. ¿Te lo guardo?", { rapidas: ["Sí, guardámelo", "Otra hora"] })];
    }
    // La hora pedida queda lejos de lo libre ese día: ofrecer también otro día a esa misma hora
    if (e.hora != null && intentos === 0 && opciones.length && Math.min.apply(null, opciones.map(function (o) { return Math.abs(o.min - e.hora); })) > 120) {
      for (var k = 1; k <= 4; k++) {
        var f2 = U.addDias(fecha, k);
        if (!BS.horario(f2)) continue;
        var cerca = BS.slotsLibres(f2, e.servicio, barbero).filter(function (s) { return Math.abs(s.min - e.hora) <= 40; })
          .sort(function (a, b) { return Math.abs(a.min - e.hora) - Math.abs(b.min - e.hora); })[0];
        if (!cerca) continue;
        cerca.fecha = f2.toISOString(); cerca.diaN = nReal + k;
        var temprano = opciones.slice(0, 2);
        e.opciones = temprano.concat([cerca]);
        var otroDia = nombreDia(cerca.diaN, f2);
        return [bot(diaCap + " " + (nb ? "con " + nb + " " : "") + "solo me queda " + temprano.map(function (o) { return "*" + etiquetaSlot(o, conB) + "*"; }).join(" o ") +
          ". " + otroDia.charAt(0).toUpperCase() + otroDia.slice(1) + " a las *" + U.horaMin(cerca.min) + "* sí lo tengo libre" + (conB ? " con " + BS.barbero(cerca.barbero).nombre : "") + ". ¿Cuál te guardo?",
          { rapidas: temprano.map(function (o) { return U.hora(U.enMin(U.hoy0(), o.min)); }).concat([otroDia.replace(/^el /, "").replace(/^./, function (x) { return x.toUpperCase(); }) + " " + U.horaMin(cerca.min)]) })];
      }
    }
    var lista = opciones.map(function (o) { return "*" + etiquetaSlot(o, conB) + "*"; });
    var txt = pref + (e.hora != null && intentos === 0 ? "A esa hora no me queda, pero " + dia + " " : diaCap + " ") + (nb ? "con " + nb + " " : "") + "tengo " +
      (lista.length === 1 ? lista[0] : lista.slice(0, -1).join(", ") + " o " + lista[lista.length - 1]) + ". ¿Cuál te guardo?";
    return [bot(txt, { rapidas: opciones.map(function (o) { return U.hora(U.enMin(U.hoy0(), o.min)); }) })];
  }

  function agendar(op) {
    var e = conv.estado, st = BS.get();
    var fecha = new Date(op.fecha || e.fecha);
    if (op.diaN != null) e.diaN = op.diaN;
    var srv = BS.servicio(e.servicio);
    if (!BS.slotsLibres(fecha, e.servicio, op.barbero).some(function (s) { return s.min === op.min; })) {
      e.hora = op.min; e.dia = e.diaN;
      return [bot("Uy, ese turno se acaba de ocupar 😅 Ya te busco otro.")].concat(flujoReserva());
    }
    var monto = BS.montoAnticipo(srv.precio);
    var conAnticipo = st.shop.anticipo.activo && monto > 0;
    var cita = BS.crearCita({
      cliente: conv.cliente, barbero: op.barbero, servicio: e.servicio, inicio: U.enMin(fecha, op.min), fuente: "whatsapp", canal: "asistente",
      estado: conAnticipo ? "pendiente" : "confirmada",
      anticipo: conAnticipo ? { monto: monto, medio: "breb", pagado: false, fecha: new Date().toISOString() } : null
    });
    conv.cita = cita.id;
    var dia = nombreDia(e.diaN, fecha);
    conv.ultimoEstado = { servicio: e.servicio, dia: e.diaN, hora: op.min, barbero: op.barbero, franja: e.franja };
    conv.estado = { paso: conAnticipo ? "pago" : "listo" };
    var base = "Listo ✅ " + srv.nombre + ", " + dia + " a las " + U.hora(cita.inicio) + " con " + BS.barbero(op.barbero).nombre + ".";
    if (conAnticipo) return [bot(base + " Para separarlo, el anticipo es de *" + U.pesos(monto) + "* 👇", { pago: { cita: cita.id, monto: monto, pagado: false } })];
    return [bot(base + t(" ¡Te esperamos, parce! 💈", " ¡Te esperamos! 💈"))];
  }

  /** Mensajes cuando el anticipo queda pagado (lo llama el simulador o el aviso de la pasarela). */
  function confirmarPago(c, citaId) {
    conv = c;
    try {
      var cita = BS.cita(citaId);
      if (!cita) return [];
      if (c) {
        c.mensajes.forEach(function (m) { if (m.pago && m.pago.cita === citaId) m.pago.pagado = cita.anticipo ? cita.anticipo.medio : true; });
        if (c.estado && c.estado.paso === "pago") c.estado.paso = "listo";
      }
      var recordar = new Date(new Date(cita.inicio).getTime() - 2 * 3600000);
      var cuando = U.mismoDia(recordar, new Date()) ? "Hoy" : U.diaRelativo(recordar).replace(/^el /, "El ").replace(/^mañana/, "Mañana");
      return [
        { de: "sistema", texto: "Anticipo recibido · " + U.pesos(cita.anticipo ? cita.anticipo.monto : 0) + " · " + BS.MEDIOS[(cita.anticipo && cita.anticipo.medio) || "breb"], hora: new Date().toISOString() },
        bot(t("Quedaste agendado 🔥 ", "Quedaste agendado. ") + cuando + " a las " + U.hora(recordar) + " te recuerdo. Si te sale algo, escribí CAMBIAR.")
      ];
    } finally { conv = null; }
  }

  function decidir(r) {
    var e = conv.estado, st = BS.get();
    if (r.servicio) e.servicio = r.servicio;
    if (r.barbero) e.barbero = r.barbero;
    if (r.dia != null) e.dia = r.dia;
    if (r.hora != null) e.hora = r.hora;
    if (r.franja) e.franja = r.franja;
    var cliente = BS.cliente(conv.cliente);
    var norm = U.normalizar(r.texto);

    if (r.intencion === "cancelar" || r.intencion === "cambiar") {
      var c = conv.cita ? BS.cita(conv.cita) : null;
      if (!c || !BS.citaActiva(c) || c.estado === "terminada" || c.estado === "en-silla") {
        c = st.citas.filter(function (x) {
          return x.cliente === conv.cliente && (x.estado === "confirmada" || x.estado === "pendiente") && new Date(x.inicio) > new Date();
        }).sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); })[0] || null;
      }
      if (!c) return [bot("No te veo turnos pendientes conmigo 🤔 ¿Te agendo uno?", { rapidas: ["Agendar turno"] })];
      var cuando = U.diaRelativo(c.inicio) + " a las " + U.hora(c.inicio);
      BS.cancelarCita(c.id, "desde WhatsApp");
      conv.cita = null;
      if (r.intencion === "cambiar") {
        conv.estado = { paso: "dia", servicio: c.servicio, barbero: c.barbero };
        return [bot("Listo, liberé tu turno de " + cuando + " ¿Para qué día lo movemos?", { rapidas: ["Hoy", "Mañana", "Otro día"] })];
      }
      conv.estado = { paso: "inicio", servicio: c.servicio };
      return [bot("Listo, cancelé tu turno de " + cuando + (c.anticipo && c.anticipo.pagado ? " Tu anticipo queda como abono para la próxima 👌" : "") + " ¿Te busco otro día?", { rapidas: ["Sí, otro día", "No, gracias"] })];
    }
    if (r.intencion === "salir" && conv.fila) {
      BS.salirFila(conv.fila);
      conv.fila = null;
      return [bot("Listo, te saqué de la fila. Cuando querás, me escribís 💈")];
    }

    if (/otro barbero/.test(norm)) { e.barbero = "cualquiera"; if (e.diaN != null && e.dia == null) e.dia = e.diaN; return flujoReserva(); }
    if (/otro dia/.test(norm) && (e.paso === "eligiendo" || e.paso === "inicio" || e.paso === "listo")) {
      e.hora = null; e.franja = null;
      if (e.paso === "eligiendo") { e.dia = (e.diaN || 0) + 1; return flujoReserva(); }
      e.dia = null; return flujoReserva();
    }
    if (e.paso === "espera-ofrecida" && r.intencion === "afirmar") {
      if (cliente.etiquetas.indexOf("Lista de espera") < 0) cliente.etiquetas.push("Lista de espera");
      BS.actividad({ tipo: "rayo", texto: U.nombreCorto(cliente.nombre) + " quedó en la lista de espera desde WhatsApp", toast: true });
      BS.commit("cliente");
      e.paso = "inicio";
      return [bot("Listo, quedaste en la lista de espera ⚡ Si alguien cancela, te escribo de una y el turno es del primero que responda.")];
    }
    if (e.paso === "eligiendo" && e.opciones && e.opciones.length) {
      var op = null;
      if (r.opcion != null) op = e.opciones[r.opcion] || null;
      else if (r.nuevos.hora) {
        var candidatas = e.opciones.filter(function (o) { return o.min === r.hora; });
        op = (r.nuevos.dia ? candidatas.filter(function (o) { return o.diaN === r.dia; })[0] : null) || candidatas[0] || null;
        if (!op) { e.dia = e.diaN; return flujoReserva(); }
      } else if (r.intencion === "afirmar") op = e.opciones[0];
      if (op) return agendar(op);
      if (r.intencion === "negar" || /otra hora/.test(norm)) {
        e.hora = null; e.franja = null;
        var mas = BS.slotsLibres(new Date(e.fecha), e.servicio, e.barbero || "cualquiera").filter(function (s) { return !e.opciones.some(function (o) { return o.min === s.min; }); });
        if (mas.length) {
          e.opciones = elegirOpciones(mas, e);
          return [bot("También tengo " + e.opciones.map(function (o) { return "*" + etiquetaSlot(o, !e.barbero || e.barbero === "cualquiera") + "*"; }).join(", ") + ". ¿Alguna te sirve?", { rapidas: e.opciones.map(function (o) { return U.hora(U.enMin(U.hoy0(), o.min)); }).concat(["Otro día"]) })];
        }
        e.dia = (e.diaN || 0) + 1;
        return flujoReserva();
      }
      if (r.nuevos.dia || r.nuevos.barbero || r.nuevos.servicio || r.nuevos.franja) { if (!r.nuevos.dia) e.dia = e.diaN; return flujoReserva(); }
    }

    if (e.paso === "fila-ofrecida" && r.intencion === "afirmar") {
      var f = BS.unirseFila({ nombre: cliente.nombre, tel: cliente.tel, via: "whatsapp", servicio: e.servicio || "s1" });
      conv.fila = f.id;
      var pos = BS.filaOrdenada().map(function (x) { return x.id; }).indexOf(f.id) + 1;
      e.paso = "inicio";
      return [bot("Listo, vas de *" + pos + "º* 🙌 Te escribo por aquí cuando falten 2 turnos para que salgás. Si te arrepentís, escribí SALIR.")];
    }
    if (e.paso === "fila-ofrecida" && (r.intencion === "negar" || /cita|agend/.test(norm))) { e.paso = "inicio"; return flujoReserva(); }

    if (r.intencion === "precio") {
      e.paso = "inicio";
      var lineas = st.servicios.slice(0, 5).map(function (s) { return "• " + s.nombre + ": " + U.pesos(s.precio); }).join("\n");
      return [bot("Estos son los precios 💈\n" + lineas + "\n¿Te agendo alguno?", { rapidas: primerServicio(["Corte", "Corte + barba", "Barba"]) })];
    }
    if (r.intencion === "ubicacion") return [bot("Estamos en *" + st.shop.direccion + "* (" + st.shop.barrio + ", " + st.shop.ciudad + ") 📍 ¿Te agendo un turno?", { rapidas: ["Agendar turno", "Precios"] })];
    if (r.intencion === "horario") {
      var h = BS.horario(new Date()), dom = st.shop.horario[0];
      return [bot((h ? "Hoy atendemos de " + U.horaMin(h[0]) + " a " + U.horaMin(h[1]) + "." : "Hoy no abrimos.") + (dom ? " Los domingos de " + U.horaMin(dom[0]) + " a " + U.horaMin(dom[1]) + "." : "") + " ¿Te guardo turno?", { rapidas: ["Agendar turno"] })];
    }
    if (r.intencion === "fila") {
      if (!BS.abiertoAhora()) return [bot("La fila virtual abre cuando abrimos la barbería. ¿Te agendo una cita mejor?", { rapidas: ["Agendar turno"] })];
      var n = st.fila.length;
      e.paso = "fila-ofrecida";
      return [bot((n ? "Ahora hay *" + n + (n === 1 ? " persona" : " personas") + "* en la fila" : "Ahora mismo no hay nadie en la fila") + " 💈 La espera es de unos " + BS.esperaFila(n + 1) + " min. ¿Te anoto? Te aviso por aquí cuando falten 2 turnos.", { rapidas: ["Sí, anotame", "Mejor agendo cita"] })];
    }
    if (r.intencion === "reservar" || (e.paso !== "inicio" && e.paso !== "listo" && e.paso !== "pago" && (r.servicio || r.dia != null))) return flujoReserva();
    if (e.paso === "servicio" || e.paso === "dia") return flujoReserva();
    if (r.intencion === "afirmar" && (e.paso === "inicio" || e.paso === "listo")) { if (/otro dia/.test(norm)) { e.dia = null; } return flujoReserva(); }
    if (r.intencion === "saludo") {
      e.paso = "inicio";
      return [bot(t("¡Quiubo", "¡Hola") + (conv.nombre ? ", " + conv.nombre : "") + "! 👋 Soy el asistente de " + st.shop.nombre + ". Te puedo agendar, decirte precios o anotarte en la fila virtual. ¿Qué necesitás?", { rapidas: ["Agendar turno", "Precios", "Fila virtual"] })];
    }
    if (r.intencion === "gracias") return [bot(t("¡Con gusto" + (conv.nombre ? ", " + conv.nombre : "") + "! Nos vemos 💈🔥", "¡Con gusto" + (conv.nombre ? ", " + conv.nombre : "") + "! Te esperamos 💈"))];
    if (r.intencion === "negar") return [bot(t("Listo, parce. Cuando querás, me escribís 👋", "Perfecto. Cuando quieras, me escribes 👋"))];
    if (e.paso === "pago") return [bot("Para separar el turno solo falta el anticipo 👆 Usá el link de pago del mensaje de arriba.")];
    return [bot(t("Uy, no te entendí bien 😅 ", "No te entendí bien 😅 ") + "Te puedo agendar un turno, decirte precios o anotarte en la fila virtual.", { rapidas: ["Agendar turno", "Precios", "Fila virtual"] })];
  }

  /** Procesa un mensaje del cliente. Modifica conv y devuelve { r, respuestas }. */
  function responder(c, texto) {
    conv = c;
    try {
      texto = String(texto || "").trim().slice(0, 500);
      if (c.estado.paso !== "pago") c.ultimoEstado = null;
      var r = entender(texto, c);
      c.ultimo = r;
      var respuestas;
      try { respuestas = decidir(r); } catch (err) { console.warn("[asistente]", err); respuestas = [bot("Uy, se me enredó algo 😅 ¿Me lo repetís?")]; }
      return { r: r, respuestas: respuestas };
    } finally { conv = null; }
  }

  BS.asistente = {
    nuevaConv: nuevaConv, entender: entender, responder: responder, confirmarPago: confirmarPago, nombreDia: nombreDia,
    INTENCIONES: { reservar: "Quiere un turno", precio: "Pregunta precios", ubicacion: "Pregunta la dirección", horario: "Pregunta el horario", fila: "Fila virtual", cancelar: "Cancelar turno", cambiar: "Cambiar turno", afirmar: "Dice que sí", negar: "Dice que no", saludo: "Saludo", gracias: "Agradece", salir: "Salir de la fila" },
    PASOS: { inicio: "Esperando qué necesita", servicio: "Preguntando el servicio", dia: "Preguntando el día", eligiendo: "Ofreció turnos libres de la agenda", pago: "Esperando el anticipo", listo: "Cita confirmada en la agenda", "fila-ofrecida": "Ofreció la fila virtual", "espera-ofrecida": "Ofreció la lista de espera" }
  };
})();
