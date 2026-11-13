/* ==========================================================================
   Barber SaaS — Motor de automatizaciones
   Escucha eventos (cita creada, cancelada, no llegó, fila...) y ejecuta las
   recetas prendidas. Las de tiempo se pueden correr con «Ejecutar ahora».
   En la versión de producción, los mensajes salen por la API de WhatsApp;
   aquí se simulan y quedan en la actividad.
   ========================================================================== */
(function () {
  "use strict";
  var BS = (typeof window !== "undefined" ? window : globalThis).BS;
  var U = BS.util;

  BS.DISPARADORES = {
    "cita.creada": { txt: "Alguien reserva una cita", tipo: "evento", ico: "cal", como: "Se activa sola cuando entra una reserva por WhatsApp, por el link o en el local." },
    "cita.antes": { txt: "Faltan unas horas para la cita", tipo: "tiempo", ico: "reloj", unidad: "horas antes" },
    "cita.cancelada": { txt: "Se cancela una cita", tipo: "evento", ico: "x", como: "Probala cancelando una cita futura desde la Agenda." },
    "cita.noshow": { txt: "El cliente no llega", tipo: "evento", ico: "escudo", unidad: "min de espera", como: "Probala marcando «No llegó» en una cita de la Agenda." },
    "cita.terminada": { txt: "Termina el servicio", tipo: "evento", ico: "tijeras", unidad: "min después", como: "Se activa cuando cobrás una cita." },
    "ciclo.cumplido": { txt: "Se cumple el ciclo de corte", tipo: "tiempo", ico: "ciclo", unidad: "días antes" },
    "huecos.hoy": { txt: "Quedan sillas libres hoy", tipo: "tiempo", ico: "hueco" },
    "cliente.cumple": { txt: "Cumpleaños del cliente", tipo: "tiempo", ico: "regalo" },
    "cliente.dormido": { txt: "Cliente sin venir hace días", tipo: "tiempo", ico: "luna", unidad: "días sin venir" },
    "fila.turno": { txt: "Le faltan 2 turnos en la fila", tipo: "evento", ico: "fila", como: "Se activa cuando alguien de la fila pasa a la silla." },
    "dia.cierre": { txt: "Se cierra el día", tipo: "tiempo", ico: "caja" },
    "semana.cierre": { txt: "Se cierra la semana", tipo: "tiempo", ico: "plata" }
  };
  BS.PUBLICOS = { todos: "Todos los que apliquen", vip: "Solo clientes VIP", nuevos: "Solo clientes nuevos", fieles: "Solo los que vienen hace más de 5 visitas" };

  /* ---------------- Plantillas ---------------- */
  BS.render = function (tpl, v) {
    return String(tpl || "").replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; })
      .replace(/ m\.\./g, " m.").replace(/\s+$/, "");
  };
  BS.VARIABLES = [
    ["nombre", "Nombre del cliente"], ["barbero", "Barbero"], ["servicio", "Servicio"], ["dia", "Día"], ["hora", "Hora"],
    ["barberia", "Tu barbería"], ["link", "Tu link de reservas"], ["anticipo", "Texto del anticipo"], ["dias", "Días desde el último corte"]
  ];

  BS.varsEjemplo = function () {
    var st = BS.get();
    return {
      nombre: "Camilo", barberia: st.shop.nombre, servicio: "Corte + barba", barbero: (st.barberos[1] || st.barberos[0]).nombre,
      dia: "mañana", hora: "4:00 p. m.", anticipo: "Para separarlo, el anticipo es de " + U.pesos(BS.montoAnticipo(45000)) + ": " + BS.linkReservas() + "/pagar",
      link: BS.linkReservas(), posicion: "2º", dias: "16", horarios: "jue 6:00 p. m., vie 5:20 p. m. o sáb 10:00 a. m.",
      servicios: "38", ventas: "$1.520.000", total: "$1.012.000", nequi: "$420.000", breb: "$310.000", efectivo: "$385.000"
    };
  };

  BS.varsCita = function (cita) {
    var st = BS.get();
    var cli = BS.cliente(cita.cliente) || { nombre: "Cliente" };
    var b = BS.barbero(cita.barbero) || { nombre: "tu barbero" };
    var s = BS.servicio(cita.servicio) || { nombre: "tu servicio" };
    var ant = "";
    if (cita.anticipo && cita.anticipo.pagado) ant = "Tu anticipo de " + U.pesos(cita.anticipo.monto) + " ya quedó registrado ✅";
    else if (st.shop.anticipo.activo && (cita.fuente === "whatsapp" || cita.fuente === "web")) ant = "Para separarlo, el anticipo es de " + U.pesos(BS.montoAnticipo(cita.precio)) + ": " + BS.linkReservas() + "/pagar";
    return Object.assign(BS.varsEjemplo(), {
      nombre: U.primerNombre(cli.nombre), servicio: s.nombre, barbero: b.nombre,
      dia: U.diaRelativo(cita.inicio), hora: U.hora(cita.inicio), anticipo: ant,
      dias: String(Math.max(0, U.diasEntre(cli.ultima || new Date(), new Date())))
    });
  };

  /** Tres turnos libres reales del barbero, de preferencia en la tarde: «jue 6:00 p. m., vie 5:20 p. m. o sáb 10:00 a. m.» */
  function horariosSugeridos(barberoId) {
    var out = [];
    for (var d = 1; d <= 6 && out.length < 3; d++) {
      var dia = U.addDias(U.hoy0(), d);
      var slots = BS.slotsLibres(dia, "s1", barberoId);
      if (!slots.length) continue;
      var tarde = slots.filter(function (s) { return s.min >= 16 * 60; });
      var s = (tarde.length ? tarde : slots)[0];
      out.push(U.DIAS_CORTO[dia.getDay()] + " " + U.horaMin(s.min));
    }
    if (!out.length) return "turnos esta semana";
    return out.length === 1 ? out[0] : out.slice(0, -1).join(", ") + " o " + out[out.length - 1];
  }

  function varsCliente(cli, extra) {
    var b = BS.barbero(cli.barbero) || BS.get().barberos[0];
    return Object.assign(BS.varsEjemplo(), {
      nombre: U.primerNombre(cli.nombre), barbero: b.nombre, dias: String(U.diasEntre(cli.ultima, new Date())),
      horarios: horariosSugeridos(b.id)
    }, extra || {});
  }

  /* ---------------- Utilidades del motor ---------------- */
  function luego(ms, fn) { setTimeout(function () { try { fn(); } catch (e) { console.warn("[motor]", e); } }, ms); }
  function azar(n) { return Math.floor(Math.random() * n); }
  function mezclar(arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = azar(i + 1); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function filtrarPublico(a, lista) {
    var p = a.publico || "todos";
    if (p === "vip") return lista.filter(function (c) { return c.etiquetas.indexOf("VIP") >= 0; });
    if (p === "nuevos") return lista.filter(function (c) { return c.visitas <= 2; });
    if (p === "fieles") return lista.filter(function (c) { return c.visitas > 5; });
    return lista;
  }
  function libre(barberoId, inicio, dur) {
    var ini = new Date(inicio).getTime(), fin = ini + dur * 60000;
    return !BS.citasDelDia(inicio, barberoId).some(function (c) {
      if (!BS.citaActiva(c)) return false;
      var a = new Date(c.inicio).getTime(), b = a + c.dur * 60000;
      return ini < b && a < fin;
    });
  }
  /** Busca un turno libre en los próximos días, preferiblemente de tarde */
  function buscarTurno(barberoId, servicioId, desdeDias, hastaDias) {
    for (var d = desdeDias; d <= hastaDias; d++) {
      var dia = U.addDias(U.hoy0(), d);
      var slots = BS.slotsLibres(dia, servicioId, barberoId);
      if (!slots.length) continue;
      var tarde = slots.filter(function (s) { return s.min >= 15 * 60; });
      var s = (tarde.length ? tarde : slots)[azar(Math.min(3, (tarde.length ? tarde : slots).length))];
      return { inicio: U.enMin(dia, s.min), barbero: s.barbero };
    }
    return null;
  }
  function registrar(a, item) {
    return BS.actividad(Object.assign({ auto: a.id, tipo: a.ico }, item));
  }
  function servicioHabitual(cli) {
    var suyas = BS.get().citas.filter(function (c) { return c.cliente === cli.id; });
    return suyas.length ? suyas[suyas.length - 1].servicio : "s1";
  }

  /* ---------------- Manejadores por receta ---------------- */
  var M = {};

  M.confirmacion = function (a, d) {
    var c = d.cita;
    var cli = BS.cliente(c.cliente);
    a.stats.enviados++;
    registrar(a, {
      tipo: "whatsapp", toast: true,
      texto: "Confirmación enviada por WhatsApp a " + U.nombreCorto(cli.nombre) + " · " + U.diaRelativo(c.inicio) + " " + U.hora(c.inicio),
      mensaje: BS.render(a.plantilla, BS.varsCita(c))
    });
  };

  M.espera = function (a, d) {
    var c = d.cita;
    if (new Date(c.inicio) < new Date(Date.now() + 20 * 60000)) return; // ya pasó o es muy pronto
    var st = BS.get();
    var cand = st.clientes.filter(function (x) { return x.id !== c.cliente && BS.estadoCiclo(x).estado !== "agendado"; });
    var enLista = cand.filter(function (x) { return x.etiquetas.indexOf("Lista de espera") >= 0; });
    var elegidos = mezclar(enLista).concat(mezclar(cand)).filter(function (x, i, arr) { return arr.indexOf(x) === i; }).slice(0, 3);
    if (!elegidos.length) return;
    a.stats.enviados += elegidos.length;
    var v = BS.varsCita(c);
    registrar(a, {
      tipo: "rayo", toast: true,
      texto: "Turno de " + U.diaRelativo(c.inicio) + " " + U.hora(c.inicio) + " ofrecido a " + elegidos.length + " clientes de la lista de espera",
      mensaje: BS.render(a.plantilla, v)
    });
    luego(3200 + azar(1500), function () {
      var ganador = elegidos[0];
      if (!libre(c.barbero, c.inicio, c.dur)) return;
      var nueva = BS.crearCita({
        cliente: ganador.id, barbero: c.barbero, servicio: c.servicio, inicio: c.inicio, fuente: "espera", estado: "confirmada",
        anticipo: { monto: BS.montoAnticipo(c.precio), medio: "breb", pagado: true, fecha: new Date().toISOString() }
      }, { silencio: true });
      a.stats.resultados++;
      a.stats.plata += nueva.precio;
      registrar(a, {
        tipo: "plata", toast: true, plata: nueva.precio,
        texto: U.nombreCorto(ganador.nombre) + " tomó el turno liberado de las " + U.hora(c.inicio) + " · plata recuperada"
      });
      BS.commit("auto", a);
    });
  };

  M.antiplanton = function (a, d) {
    var c = d.cita;
    var cli = BS.cliente(c.cliente);
    var monto = c.anticipo && c.anticipo.pagado ? c.anticipo.monto : 0;
    a.stats.enviados++;
    if (monto) a.stats.plata += monto;
    registrar(a, {
      tipo: "escudo", toast: true, plata: monto || undefined,
      texto: monto ? "Anticipo de " + U.pesos(monto) + " retenido · " + U.nombreCorto(cli.nombre) + " no llegó" : U.nombreCorto(cli.nombre) + " no llegó · le escribimos para reagendar",
      mensaje: BS.render(a.plantilla, BS.varsCita(c))
    });
    luego(4200, function () {
      if (Math.random() < 0.35) return;
      var t = buscarTurno(c.barbero, c.servicio, 1, 5);
      if (!t) return;
      BS.crearCita({ cliente: cli.id, barbero: t.barbero, servicio: c.servicio, inicio: t.inicio, fuente: "whatsapp", estado: "confirmada",
        anticipo: monto ? { monto: monto, medio: c.anticipo.medio, pagado: true, fecha: new Date().toISOString() } : null }, { silencio: true });
      a.stats.resultados++;
      registrar(a, { tipo: "cal", toast: true, texto: U.nombreCorto(cli.nombre) + " reagendó para " + U.diaRelativo(t.inicio) + " a las " + U.hora(t.inicio) });
      BS.commit("auto", a);
    });
  };

  M.resena = function (a, d) {
    var c = d.cita;
    var cli = BS.cliente(c.cliente);
    a.stats.enviados++;
    var cuando = new Date(Date.now() + (a.espera || 120) * 60000);
    registrar(a, {
      tipo: "estrella", texto: "Pedido de reseña programado para " + U.nombreCorto(cli.nombre) + " a las " + U.hora(cuando),
      mensaje: BS.render(a.plantilla, BS.varsCita(c))
    });
    luego(6000, function () {
      if (Math.random() < 0.55) return;
      a.stats.resultados++;
      registrar(a, { tipo: "estrella", toast: true, texto: U.nombreCorto(cli.nombre) + " dejó una reseña de 5 estrellas en Google" });
      BS.commit("auto", a);
    });
  };

  M.fila = function (a, d) {
    var f = d.fila;
    a.stats.enviados++;
    registrar(a, {
      tipo: "fila", toast: true, texto: "Aviso enviado a " + U.nombreCorto(f.nombre) + ": va de " + d.posicion + "º en la fila",
      mensaje: BS.render(a.plantilla, Object.assign(BS.varsEjemplo(), { nombre: U.primerNombre(f.nombre), posicion: d.posicion + "º" }))
    });
    luego(9000, function () {
      var aun = BS.get().fila.filter(function (x) { return x.id === f.id; })[0];
      if (!aun) return;
      aun.estado = "camino";
      a.stats.resultados++;
      BS.commit("fila");
    });
  };

  /** Genérico (recetas creadas por el dueño) para eventos con cita */
  M._generico = function (a, d) {
    var v = d.cita ? BS.varsCita(d.cita) : BS.varsEjemplo();
    var quien = d.cita ? U.nombreCorto((BS.cliente(d.cita.cliente) || {}).nombre || "cliente") : d.fila ? U.nombreCorto(d.fila.nombre) : "un cliente";
    a.stats.enviados++;
    registrar(a, { tipo: "whatsapp", toast: true, texto: "«" + a.nombre + "» le escribió a " + quien, mensaje: BS.render(a.plantilla, v) });
  };

  /* ---------------- Recetas de tiempo: «Ejecutar ahora» ---------------- */
  var T = {};

  T.recordatorio = function (a) {
    var manana = U.addDias(U.hoy0(), 1);
    var citas = BS.citasDelDia(manana).filter(function (c) { return c.estado === "confirmada" || c.estado === "pendiente"; });
    var hoyTarde = BS.citasDelDia(new Date()).filter(function (c) {
      return (c.estado === "confirmada" || c.estado === "pendiente") && new Date(c.inicio) > new Date(Date.now() + 60 * 60000);
    });
    var todas = citas.concat(hoyTarde).filter(function (c) { return !c.recordatorio; });
    if (!todas.length) todas = citas.concat(hoyTarde);
    var confirmaron = 0, pagaron = 0;
    todas.forEach(function (c) {
      c.recordatorio = true;
      if (c.estado === "pendiente" && Math.random() < 0.5) {
        c.anticipo = { monto: BS.montoAnticipo(c.precio), medio: Math.random() < 0.5 ? "nequi" : "breb", pagado: true, fecha: new Date().toISOString() };
        c.estado = "confirmada"; pagaron++; confirmaron++;
      } else if (c.estado === "confirmada" && Math.random() < 0.88) confirmaron++;
    });
    a.stats.enviados += todas.length; a.stats.resultados += confirmaron;
    var ej = todas[0] ? BS.render(a.plantilla, BS.varsCita(todas[0])) : "";
    registrar(a, { tipo: "cal", toast: true, texto: "Recordatorio enviado a " + todas.length + " clientes · " + confirmaron + " confirmaron" + (pagaron ? " y " + pagaron + " pagaron el anticipo" : ""), mensaje: ej });
    return { enviados: todas.length, resultado: confirmaron + " confirmaron" };
  };

  T.ciclo = function (a) {
    var lista = filtrarPublico(a, BS.get().clientes.filter(function (c) { return BS.estadoCiclo(c).estado === "toca"; }));
    var reservaron = 0, plata = 0, ej = "";
    lista.forEach(function (cli, i) {
      var v = varsCliente(cli);
      if (!ej) ej = BS.render(a.plantilla, v);
      if (i % 5 === 0 || Math.random() < 0.3) {
        var sid = servicioHabitual(cli);
        var t = buscarTurno(cli.barbero, sid, 1, 4) || buscarTurno("cualquiera", sid, 1, 5);
        if (!t) return;
        var c = BS.crearCita({ cliente: cli.id, barbero: t.barbero, servicio: sid, inicio: t.inicio, fuente: "ciclo", estado: "confirmada",
          anticipo: { monto: BS.montoAnticipo(BS.servicio(sid).precio), medio: "nequi", pagado: true, fecha: new Date().toISOString() } }, { silencio: true });
        reservaron++; plata += c.precio;
      }
    });
    a.stats.enviados += lista.length; a.stats.resultados += reservaron; a.stats.plata += plata;
    registrar(a, { tipo: "ciclo", toast: true, plata: plata || undefined, texto: "Ciclo de corte: mensaje a " + lista.length + " clientes · " + reservaron + " reservaron", mensaje: ej });
    return { enviados: lista.length, resultado: reservaron + " reservaron · " + U.pesos(plata) };
  };

  T.huecos = function (a) {
    var hoy = new Date();
    var h = BS.horario(hoy);
    var desde = Math.max(U.ahoraMin() + 30, h ? h[0] : 0);
    var huecos = [];
    if (h && desde < h[1] - 40) {
      BS.get().barberos.forEach(function (b) {
        for (var m = Math.ceil(desde / 20) * 20; m + 40 <= h[1]; m += 20) {
          if (libre(b.id, U.enMin(hoy, m), 40)) { huecos.push({ barbero: b.id, min: m }); m += 40; }
        }
      });
    }
    if (!huecos.length) {
      registrar(a, { tipo: "hueco", toast: true, texto: "Huecos libres: hoy no queda ni una silla libre. Agenda llena 🔥" });
      return { enviados: 0, resultado: "agenda llena" };
    }
    var cand = filtrarPublico(a, BS.get().clientes.filter(function (c) { var e = BS.estadoCiclo(c).estado; return e === "toca" || e === "dormido" || e === "al-dia"; }));
    var avisados = Math.min(25, cand.length);
    var llenos = 0, plata = 0;
    mezclar(huecos).slice(0, Math.min(3, huecos.length)).forEach(function (hu, i) {
      var cli = cand[i]; if (!cli) return;
      var c = BS.crearCita({ cliente: cli.id, barbero: hu.barbero, servicio: "s1", inicio: U.enMin(hoy, hu.min), fuente: "hueco", estado: "confirmada" }, { silencio: true });
      llenos++; plata += c.precio;
    });
    a.stats.enviados += avisados; a.stats.resultados += llenos; a.stats.plata += plata;
    var primero = huecos[0];
    registrar(a, {
      tipo: "hueco", toast: true, plata: plata || undefined,
      texto: "Huecos libres: " + huecos.length + " sillas libres en la tarde · mensaje a " + avisados + " clientes · " + llenos + " turnos llenos",
      mensaje: BS.render(a.plantilla, Object.assign(BS.varsEjemplo(), { hora: U.horaMin(primero.min), barbero: BS.barbero(primero.barbero).nombre }))
    });
    return { enviados: avisados, resultado: llenos + " turnos llenos · " + U.pesos(plata) };
  };

  T.cumple = function (a) {
    var lista = filtrarPublico(a, BS.get().clientes.filter(function (c) { return BS.esCumpleProximo(c, 7) >= 0; }));
    var vinieron = 0, plata = 0;
    lista.forEach(function (cli) {
      if (Math.random() < 0.6) {
        var t = buscarTurno(cli.barbero, "s2", 1, 6);
        if (!t) return;
        var c = BS.crearCita({ cliente: cli.id, barbero: t.barbero, servicio: "s2", inicio: t.inicio, fuente: "whatsapp", estado: "confirmada" }, { silencio: true });
        vinieron++; plata += c.precio;
      }
    });
    a.stats.enviados += lista.length; a.stats.resultados += vinieron; a.stats.plata += plata;
    registrar(a, { tipo: "regalo", toast: true, plata: plata || undefined, texto: "Cumpleaños: saludo a " + lista.length + " clientes · " + vinieron + " reservaron", mensaje: lista[0] ? BS.render(a.plantilla, varsCliente(lista[0])) : "" });
    return { enviados: lista.length, resultado: vinieron + " reservaron" };
  };

  T.dormidos = function (a) {
    var lista = filtrarPublico(a, BS.get().clientes.filter(function (c) { return BS.estadoCiclo(c).estado === "dormido"; }));
    var volvieron = 0, plata = 0;
    lista.forEach(function (cli) {
      if (Math.random() < 0.34) {
        var t = buscarTurno(cli.barbero, "s1", 1, 6);
        if (!t) return;
        var c = BS.crearCita({ cliente: cli.id, barbero: t.barbero, servicio: "s1", inicio: t.inicio, fuente: "whatsapp", estado: "confirmada" }, { silencio: true });
        volvieron++; plata += Math.round(c.precio * 0.85);
      }
    });
    a.stats.enviados += lista.length; a.stats.resultados += volvieron; a.stats.plata += plata;
    registrar(a, { tipo: "luna", toast: true, plata: plata || undefined, texto: "Clientes dormidos: mensaje a " + lista.length + " · " + volvieron + " volvieron a reservar", mensaje: lista[0] ? BS.render(a.plantilla, varsCliente(lista[0])) : "" });
    return { enviados: lista.length, resultado: volvieron + " volvieron" };
  };

  T.liquidacion = function (a) {
    var desde = BS.inicioSemana(new Date());
    var liq = BS.liquidacion(desde, U.addDias(desde, 7)).filter(function (l) { return l.barbero.modo !== "dueno"; });
    var total = liq.reduce(function (s, l) { return s + l.total; }, 0);
    a.stats.enviados += liq.length; a.stats.resultados += liq.length;
    var l0 = liq[0];
    registrar(a, {
      tipo: "plata", toast: true, texto: "Liquidación enviada a " + liq.length + " barberos · " + U.pesos(total) + " en total",
      mensaje: l0 ? BS.render(a.plantilla, Object.assign(BS.varsEjemplo(), { nombre: l0.barbero.nombre, servicios: String(l0.servicios), ventas: U.pesos(l0.ventas), total: U.pesos(l0.total) })) : ""
    });
    return { enviados: liq.length, resultado: U.pesos(total) + " por pagar" };
  };

  T.cierre = function (a) {
    var hoy = U.hoy0(), man = U.addDias(hoy, 1);
    var movs = BS.movimientos(hoy, man).filter(function (m) { return m.tipo !== "liquidacion"; });
    var por = {}; movs.forEach(function (m) { por[m.medio] = (por[m.medio] || 0) + m.monto; });
    var total = movs.reduce(function (s, m) { return s + m.monto; }, 0);
    var servicios = BS.citasDelDia(hoy).filter(function (c) { return c.estado === "terminada"; }).length;
    a.stats.enviados++; a.stats.resultados++;
    registrar(a, {
      tipo: "caja", toast: true, texto: "Cierre de caja enviado: " + U.pesos(total) + " en " + servicios + " servicios",
      mensaje: BS.render(a.plantilla, Object.assign(BS.varsEjemplo(), { total: U.pesos(total), servicios: String(servicios), nequi: U.pesos(por.nequi || 0), breb: U.pesos(por.breb || 0), efectivo: U.pesos(por.efectivo || 0) }))
    });
    return { enviados: 1, resultado: U.pesos(total) };
  };

  /** Genérico de tiempo para recetas creadas por el dueño */
  T._generico = function (a) {
    var st = BS.get(), lista = [];
    switch (a.disparador) {
      case "ciclo.cumplido": lista = st.clientes.filter(function (c) { return BS.estadoCiclo(c).estado === "toca"; }); break;
      case "cliente.dormido": lista = st.clientes.filter(function (c) { return U.diasEntre(c.ultima, new Date()) >= (a.espera || 45); }); break;
      case "cliente.cumple": lista = st.clientes.filter(function (c) { return BS.esCumpleProximo(c, 7) >= 0; }); break;
      case "cita.antes":
        lista = BS.citasDelDia(U.addDias(U.hoy0(), 1)).filter(BS.citaActiva).map(function (c) { return BS.cliente(c.cliente); }); break;
      case "huecos.hoy": lista = st.clientes.filter(function (c) { return BS.estadoCiclo(c).estado !== "agendado"; }).slice(0, 25); break;
      default: lista = [{ nombre: st.shop.dueno, ultima: new Date().toISOString(), barbero: "b1" }];
    }
    lista = filtrarPublico(a, lista.filter(Boolean));
    a.stats.enviados += lista.length;
    registrar(a, { tipo: "whatsapp", toast: true, texto: "«" + a.nombre + "»: mensaje enviado a " + lista.length + (lista.length === 1 ? " persona" : " clientes"), mensaje: lista[0] ? BS.render(a.plantilla, varsCliente(lista[0])) : "" });
    return { enviados: lista.length, resultado: lista.length + " mensajes" };
  };

  /* ---------------- API pública ---------------- */
  BS.esDeTiempo = function (a) { var d = BS.DISPARADORES[a.disparador]; return !!(d && d.tipo === "tiempo"); };

  BS.ejecutarAuto = function (id) {
    var a = BS.auto(id);
    if (!a) return null;
    var fn = T[a.clave] || T._generico;
    var r = fn(a);
    BS.commit("auto", a);
    return r;
  };

  function revisarFila() {
    var autos = BS.get().autos.filter(function (a) { return a.activa && a.disparador === "fila.turno"; });
    if (!autos.length) return;
    BS.filaOrdenada().forEach(function (f, i) {
      if (i < 2 && !f.avisado) {
        f.avisado = true;
        autos.forEach(function (a) { (M[a.clave] || M._generico)(a, { fila: f, posicion: i + 1 }); });
      }
    });
  }

  BS.emit = function (evento, data) {
    data = data || {};
    if (evento === "fila.entra" || evento === "fila.avanza") { revisarFila(); return; }
    BS.get().autos.forEach(function (a) {
      if (!a.activa || a.disparador !== evento) return;
      try { (M[a.clave] || M._generico)(a, data); } catch (e) { console.warn("[auto " + a.clave + "]", e); }
    });
  };
})();
