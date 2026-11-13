/* ==========================================================================
   Barber SaaS — Datos compartidos (plataforma + página de reservas + servidor)
   Funciona en dos lugares con el mismo código:
   - Navegador, modo demo: guarda en localStorage y sincroniza entre pestañas.
   - Navegador conectado al servidor, o el propio servidor (Node): trabaja en
     memoria con BS.usar(estado) y otro se encarga de guardar.
   Patrón IIFE: expone BS en window (navegador) o globalThis (Node).
   ========================================================================== */
(function () {
  "use strict";

  var KEY = "barbersaas.v1";
  var VERSION = 6;
  var RAIZ = typeof window !== "undefined" ? window : globalThis;
  var BS = RAIZ.BS || (RAIZ.BS = {});
  var estado = null;
  var oyentes = [];
  var modo = "local"; // «local» = localStorage (demo) · «memoria» = servidor o panel conectado

  /* ---------------- Utilidades ---------------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function uid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function hoy0() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDias(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function enMin(dia, min) { var x = new Date(dia); x.setHours(0, 0, 0, 0); x.setMinutes(min); return x; }
  function minDelDia(d) { d = new Date(d); return d.getHours() * 60 + d.getMinutes(); }
  function ahoraMin() { return minDelDia(new Date()); }
  function mismoDia(a, b) {
    a = new Date(a); b = new Date(b);
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function claveDia(d) { d = new Date(d); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function diasEntre(a, b) { return Math.round((hoyDe(b) - hoyDe(a)) / 86400000); }
  function hoyDe(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
  function normalizar(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var DIAS_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MESES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function pesos(n) {
    var s = Math.abs(Math.round(n || 0)).toLocaleString("es-CO");
    return (n < 0 ? "−" : "") + "$" + s;
  }
  function pesosCorto(n) {
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 }) + " M";
    if (Math.abs(n) >= 1e3) return "$" + Math.round(n / 1e3).toLocaleString("es-CO") + " mil";
    return pesos(n);
  }
  function horaMin(min) {
    var h = Math.floor(min / 60), m = Math.round(min % 60);
    if (h === 12 && m === 0) return "12:00 m.";
    return (h % 12 || 12) + ":" + pad(m) + " " + (h < 12 ? "a. m." : "p. m.");
  }
  function hora(d) { return horaMin(minDelDia(d)); }
  function horaCorta(min) { var h = Math.floor(min / 60); return (h % 12 || 12) + ":" + pad(min % 60); }
  function fechaLarga(d) { d = new Date(d); return DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()]; }
  function fechaCorta(d) { d = new Date(d); return DIAS_CORTO[d.getDay()] + " " + d.getDate() + " " + MESES_CORTO[d.getMonth()]; }
  function diaRelativo(d) {
    var n = diasEntre(new Date(), d);
    if (n === 0) return "hoy";
    if (n === 1) return "mañana";
    if (n === -1) return "ayer";
    if (n > 1 && n < 7) return "el " + DIAS[new Date(d).getDay()];
    return "el " + fechaCorta(d);
  }
  function hace(d) {
    var s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 45) return "ahora";
    var m = Math.round(s / 60);
    if (m < 60) return "hace " + m + " min";
    var h = Math.round(m / 60);
    if (h < 24) return "hace " + h + " h";
    var dd = Math.round(h / 24);
    return dd === 1 ? "ayer" : "hace " + dd + " días";
  }
  function iniciales(nombre) {
    var p = String(nombre || "?").trim().split(/\s+/);
    return ((p[0] || "")[0] + ((p[1] || "")[0] || (p[0] || "")[1] || "")).toUpperCase();
  }
  function primerNombre(nombre) { return String(nombre || "").trim().split(/\s+/)[0]; }
  function nombreCorto(nombre) {
    var p = String(nombre || "").trim().split(/\s+/);
    return p.length > 1 ? p[0] + " " + p[p.length - 1][0] + "." : p[0];
  }
  function telefonoBonito(t) {
    var d = String(t || "").replace(/\D/g, "");
    if (d.indexOf("57") === 0 && d.length === 12) d = d.slice(2);
    if (d.length === 10) return "+57 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6);
    return t;
  }
  function escapar(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  BS.util = {
    pad: pad, uid: uid, hoy0: hoy0, addDias: addDias, enMin: enMin, minDelDia: minDelDia, ahoraMin: ahoraMin,
    mismoDia: mismoDia, claveDia: claveDia, diasEntre: diasEntre, normalizar: normalizar, clonar: clonar,
    pesos: pesos, pesosCorto: pesosCorto, hora: hora, horaMin: horaMin, horaCorta: horaCorta,
    fechaLarga: fechaLarga, fechaCorta: fechaCorta, diaRelativo: diaRelativo, hace: hace,
    iniciales: iniciales, primerNombre: primerNombre, nombreCorto: nombreCorto, telefonoBonito: telefonoBonito,
    escapar: escapar, DIAS: DIAS, DIAS_CORTO: DIAS_CORTO, MESES: MESES
  };

  /* ---------------- Catálogos ---------------- */
  BS.MEDIOS = {
    nequi: "Nequi", breb: "Bre-B", daviplata: "Daviplata", pse: "PSE", tarjeta: "Tarjeta", efectivo: "Efectivo"
  };
  BS.FUENTES = { whatsapp: "WhatsApp", web: "Link de reservas", manual: "En el local", fila: "Fila virtual", espera: "Lista de espera", ciclo: "Ciclo de corte", hueco: "Huecos libres" };
  BS.ESTADOS = {
    pendiente: { txt: "Falta anticipo", clase: "alerta", ico: "reloj" },
    confirmada: { txt: "Confirmada", clase: "ok", ico: "check" },
    "en-silla": { txt: "En la silla", clase: "neon", ico: "tijeras" },
    terminada: { txt: "Terminada", clase: "neutro", ico: "check" },
    "no-show": { txt: "No llegó", clase: "error", ico: "x" },
    cancelada: { txt: "Cancelada", clase: "neutro", ico: "x" }
  };

  /* ---------------- Datos de ejemplo ---------------- */
  function aleatorio(semilla) {
    var a = semilla >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var NOMBRES = [
    "Camilo Restrepo", "Mateo Zapata", "Santiago Gómez", "Juan José Ospina", "Sebastián Arango", "Daniel Mejía",
    "Alejandro Montoya", "Felipe Vélez", "Esteban Cardona", "Julián Henao", "Tomás Uribe", "Samuel Correa",
    "Nicolás Álvarez", "David Giraldo", "Brayan Muñoz", "Simón Echeverri", "Jerónimo Posada", "Emmanuel Rendón",
    "Miguel Ángel Toro", "Luis Fernando Castaño", "Jhon Fredy Marín", "Óscar Duque", "Manuel Betancur",
    "Pablo Quintero", "Juan Pablo Salazar", "Mauricio Villa", "Ricardo Tobón", "Valentina Ríos",
    "Cristian Hoyos", "Jorge Iván Pérez", "Martín Bedoya", "Isabella Cano"
  ];
  var NOMBRES_PILA = [
    "Santiago", "Sebastián", "Mateo", "Samuel", "Alejandro", "Daniel", "David", "Juan Esteban", "Juan Camilo", "Juan Diego",
    "Nicolás", "Tomás", "Martín", "Emiliano", "Jerónimo", "Felipe", "Cristian", "Óscar", "Mauricio", "Ricardo", "Diego",
    "Esteban", "Luis Miguel", "Carlos", "Jorge", "Fabián", "Hernán", "Gustavo", "Wilmar", "Yeison", "Maicol", "Duván",
    "Stiven", "Johan", "Alexis", "Simón", "Emmanuel", "Miguel", "Manuel", "Pablo", "Jacobo", "Matías", "Thiago",
    "Valentina", "Mariana", "Sara", "Andrés Felipe", "Juan Sebastián", "Camilo", "Brayan"
  ];
  var APELLIDOS = [
    "Restrepo", "Zapata", "Gómez", "Ospina", "Arango", "Mejía", "Montoya", "Vélez", "Cardona", "Henao", "Uribe", "Correa",
    "Álvarez", "Giraldo", "Muñoz", "Echeverri", "Posada", "Rendón", "Toro", "Castaño", "Marín", "Duque", "Betancur",
    "Quintero", "Salazar", "Villa", "Tobón", "Ríos", "Hoyos", "Pérez", "Bedoya", "Cano", "Gaviria", "Agudelo", "Ramírez",
    "Valencia", "Ocampo", "Mesa", "Lopera", "Jaramillo", "Gil", "Ruiz", "Vargas", "Arboleda", "Escobar", "Cadavid", "Palacio", "Sierra"
  ];
  var FICHAS = [
    "Fade medio, #1 a los lados, tijera arriba. Raya al lado izquierdo.",
    "Low fade con una línea de diseño. Barba perfilada en punta.",
    "Clásico con tijera, sin degradado. No le gusta muy corto.",
    "Mid fade #0.5, texturizado arriba con cera mate.",
    "Taper en la nuca, mullet suave. Cejas con una raya.",
    "Buzz cut #2 parejo. Barba completa con toalla caliente.",
    "High fade, cresta corta. Le gusta el bálsamo de barba.",
    "Degradado bajo, que no le pasen la máquina cerca de las orejas.",
    "Corte francés, flequillo hacia adelante. Perfilado de barba corto.",
    "Fade alto con diseño en zigzag. Pide fotos para su Instagram."
  ];


  /* Servicios con los que arranca toda barbería (se editan en Ajustes) */
  function serviciosBase() {
    return [
        { id: "s1", nombre: "Corte", dur: 40, precio: 30000, desc: "Máquina, tijera y peinado." },
        { id: "s2", nombre: "Corte + barba", dur: 60, precio: 45000, desc: "El combo completo, con toalla caliente." },
        { id: "s3", nombre: "Barba", dur: 30, precio: 22000, desc: "Perfilado, navaja y bálsamo." },
        { id: "s4", nombre: "Corte niño", dur: 30, precio: 25000, desc: "Hasta 12 años." },
        { id: "s5", nombre: "Diseño / líneas", dur: 20, precio: 12000, desc: "Rayas y figuras a mano alzada." },
        { id: "s6", nombre: "Cejas", dur: 10, precio: 8000, desc: "Limpieza y perfilado." },
        { id: "s7", nombre: "Mascarilla negra", dur: 20, precio: 18000, desc: "Limpieza facial con mascarilla." }
    ];
  }

  /* Recetas de automatización que trae toda barbería. conStats=true llena números de ejemplo (demo). */
  function autosBase(conStats) {
    function s(env, res, plata, txt) { return conStats ? { enviados: env, resultados: res, plata: plata, txt: txt } : { enviados: 0, resultados: 0, plata: 0, txt: txt }; }
    return [
      { id: "a1", clave: "confirmacion", nombre: "Confirmación de cita", ico: "chat", disparador: "cita.creada", espera: 0,
        desc: "Apenas alguien reserva, le llega el resumen y el link del anticipo.",
        plantilla: "¡Hola {nombre}! 💈 Quedaste agendado en {barberia}: {servicio} con {barbero}, {dia} a las {hora}. {anticipo}",
        activa: true, stats: s(64, 59, 0, "confirmaron") },
      { id: "a2", clave: "recordatorio", nombre: "Recordatorio 24 h y 2 h", ico: "cal", disparador: "cita.antes", espera: 24,
        desc: "Un día antes y dos horas antes, con botón para confirmar o cambiar la hora.",
        plantilla: "Qué más, {nombre} 👋 Te recordamos tu turno {dia} a las {hora} con {barbero}. ¿Confirmás? Respondé SÍ o escribí CAMBIAR.",
        activa: true, stats: s(118, 104, 0, "confirmaron") },
      { id: "a3", clave: "antiplanton", nombre: "Anti-plantón", ico: "escudo", disparador: "cita.noshow", espera: 15,
        desc: "Si no llega, el anticipo queda en caja y le escribe para reagendar.",
        plantilla: "{nombre}, te esperamos hoy a las {hora} y no alcanzaste a llegar 😕 Tu anticipo queda como abono. ¿Te agendo otro día?",
        activa: true, stats: s(8, 5, 80000, "reagendaron") },
      { id: "a4", clave: "espera", nombre: "Lista de espera relámpago", ico: "rayo", disparador: "cita.cancelada", espera: 0,
        desc: "Cuando alguien cancela, ofrece el turno a la lista de espera. El primero que responde se lo queda.",
        plantilla: "¡Se liberó un turno! 🏃 {dia} a las {hora} con {barbero}. El primero que responda SÍ se lo queda.",
        activa: true, stats: s(21, 6, 255000, "turnos salvados") },
      { id: "a5", clave: "ciclo", nombre: "Ciclo de corte", ico: "ciclo", disparador: "ciclo.cumplido", espera: -2,
        desc: "Aprende cada cuánto se motila cada cliente y le escribe cuando ya le toca.",
        plantilla: "Parce, ya van {dias} días desde tu último corte ✂️ ¿Te guardo con {barbero}? Tengo {horarios}.",
        activa: true, stats: s(46, 18, 540000, "volvieron") },
      { id: "a6", clave: "huecos", nombre: "Huecos libres", ico: "hueco", disparador: "huecos.hoy", espera: 0,
        desc: "A mediodía revisa la tarde. Si hay sillas libres, avisa a los clientes con el ciclo vencido.",
        plantilla: "Hoy tenemos silla libre a las {hora} con {barbero} 💈 Si venís, las cejas van por cuenta de la casa.",
        activa: true, stats: s(75, 9, 315000, "turnos llenados") },
      { id: "a7", clave: "resena", nombre: "Reseña después del corte", ico: "estrella", disparador: "cita.terminada", espera: 120,
        desc: "Dos horas después del servicio, pide una reseña y una foto del corte.",
        plantilla: "¿Cómo te quedó el corte, {nombre}? Si te gustó, una reseña nos ayuda un montón 🙏 {link}",
        activa: true, stats: s(92, 31, 0, "reseñas") },
      { id: "a8", clave: "fila", nombre: "Aviso de turno en la fila", ico: "fila", disparador: "fila.turno", espera: 0,
        desc: "Cuando le faltan dos turnos, le avisa para que salga de la casa.",
        plantilla: "{nombre}, ya casi te toca 🙌 Vas de {posicion}. Salí ya y te recibimos de una.",
        activa: true, stats: s(57, 54, 0, "llegaron a tiempo") },
      { id: "a9", clave: "cumple", nombre: "Cumpleaños", ico: "regalo", disparador: "cliente.cumple", espera: 0,
        desc: "El día del cumpleaños le regala la barba con el corte.",
        plantilla: "¡Feliz cumpleaños, {nombre}! 🎂 Esta semana la barba va por cuenta de {barberia}. Reservá aquí: {link}",
        activa: true, stats: s(6, 3, 135000, "vinieron") },
      { id: "a10", clave: "dormidos", nombre: "Clientes dormidos", ico: "luna", disparador: "cliente.dormido", espera: 45,
        desc: "Si alguien lleva 45 días sin venir, le escribe con un 15 % de descuento.",
        plantilla: "Te extrañamos en {barberia}, {nombre} 💈 Hace {dias} días no venís. Esta semana tenés 15 % en tu corte: {link}",
        activa: false, stats: s(0, 0, 0, "volvieron") },
      { id: "a11", clave: "liquidacion", nombre: "Liquidación de barberos", ico: "plata", disparador: "semana.cierre", espera: 0,
        desc: "El sábado a las 9 p. m. calcula lo de cada barbero y le manda su resumen.",
        plantilla: "Resumen de tu semana, {nombre}: {servicios} servicios, {ventas} en ventas. Te corresponden {total}. 💪",
        activa: true, stats: s(12, 12, 0, "liquidaciones") },
      { id: "a12", clave: "cierre", nombre: "Cierre de caja", ico: "caja", disparador: "dia.cierre", espera: 0,
        desc: "Todas las noches te manda lo que entró por cada medio de pago.",
        plantilla: "Cierre de hoy en {barberia}: {total} en {servicios} servicios. Nequi {nequi} · Bre-B {breb} · Efectivo {efectivo}.",
        activa: true, stats: s(6, 6, 0, "cierres") }
    ];
  }

  function semilla() {
    var r = aleatorio(20261109);
    function elegir(arr) { return arr[Math.floor(r() * arr.length)]; }
    function pesoElegir(pares) {
      var total = pares.reduce(function (s, p) { return s + p[1]; }, 0), x = r() * total;
      for (var i = 0; i < pares.length; i++) { x -= pares[i][1]; if (x <= 0) return pares[i][0]; }
      return pares[0][0];
    }
    var hoy = hoy0();
    var ahora = new Date();

    var shop = {
      nombre: "La Esquina Barber Club", slug: "la-esquina", barrio: "Laureles", ciudad: "Medellín",
      direccion: "Cra. 76 #33A-12, Laureles", dueno: "Andrés", whatsapp: "", plan: "barberia",
      horario: { 0: [600, 960], 1: [540, 1200], 2: [540, 1200], 3: [540, 1200], 4: [540, 1200], 5: [540, 1230], 6: [540, 1230] },
      anticipo: { activo: true, tipo: "fijo", valor: 10000, porcentaje: 25 },
      medios: { nequi: true, breb: true, daviplata: true, pse: true, tarjeta: true, efectivo: true },
      tono: "paisa", rating: 4.9, resenas: 312, onboarded: false
    };

    var barberos = [
      { id: "b1", nombre: "Andrés", alias: "El Profe", rol: "Dueño", modo: "dueno", comision: 1, alquiler: 0, especialidades: ["Fade", "Diseños"], rating: 4.9 },
      { id: "b2", nombre: "Juan", alias: "Mono", rol: "Barbero", modo: "porcentaje", comision: 0.6, alquiler: 0, especialidades: ["Fade", "Barba"], rating: 4.9 },
      { id: "b3", nombre: "Kevin", alias: "", rol: "Barbero", modo: "porcentaje", comision: 0.6, alquiler: 0, especialidades: ["Clásico", "Niños"], rating: 4.8 },
      { id: "b4", nombre: "Sebastián", alias: "Sebas", rol: "Barbero", modo: "alquiler", comision: 1, alquiler: 350000, especialidades: ["Diseños", "Tinte"], rating: 4.8 }
    ];

    var servicios = serviciosBase();
    var pesosServicio = [["s1", 44], ["s2", 30], ["s3", 9], ["s4", 6], ["s5", 6], ["s6", 3], ["s7", 2]];

    // Base de clientes: los 32 con nombre propio + una base amplia, como una barbería real
    var nombresTodos = NOMBRES.slice();
    var usados = {}; nombresTodos.forEach(function (n) { usados[n] = 1; });
    var intentosNombres = 0;
    while (nombresTodos.length < 160 && intentosNombres < 4000) {
      intentosNombres++;
      var n = elegir(NOMBRES_PILA) + " " + elegir(APELLIDOS);
      if (!usados[n]) { usados[n] = 1; nombresTodos.push(n); }
    }
    var EN_FILA = { "Brayan Muñoz": 1, "Esteban Cardona": 1, "Julián Henao": 1, "Pablo Quintero": 1 };
    var clientes = nombresTodos.map(function (nombre, i) {
      var ciclo = elegir([14, 15, 18, 20, 21, 21, 25, 28, 30]);
      // tipo: «toca» (ya le toca corte), «dormido» (+45 días), «fila» (está en la fila hoy) o «normal»
      var tipo = EN_FILA[nombre] ? "fila" : i % 8 === 1 ? "toca" : i % 13 === 4 ? "dormido" : "normal";
      var diasDesde = tipo === "toca" ? ciclo - 1 + (i % 3) : tipo === "dormido" ? 48 + ((i * 7) % 30) : 2 + Math.floor(r() * Math.max(3, ciclo - 6));
      var visitas = Math.floor(r() * 30) + 1;
      if (i % 11 === 6) visitas = 1;
      var fav = elegir(["b1", "b2", "b2", "b3", "b3", "b4"]);
      var cumple = addDias(hoy, Math.floor(r() * 365) - 180);
      if (i === 5) cumple = addDias(hoy, 2);
      if (i === 17) cumple = addDias(hoy, 5);
      if (i === 41) cumple = addDias(hoy, 0);
      var etiquetas = [];
      if (visitas >= 20) etiquetas.push("VIP");
      if (visitas <= 2) etiquetas.push("Nuevo");
      if (i % 6 === 1) etiquetas.push("Lista de espera");
      return {
        id: "c" + (i + 1), nombre: nombre, tipo: tipo,
        tel: "3" + elegir(["00", "01", "04", "05", "10", "12", "13", "14", "15", "16", "17", "18", "20", "22", "23"]) + String(Math.floor(r() * 9000000) + 1000000),
        ciclo: ciclo, ultima: addDias(hoy, -diasDesde).toISOString(), visitas: visitas,
        gasto: visitas * (Math.floor(r() * 15) + 30) * 1000, barbero: fav,
        cumple: pad(cumple.getMonth() + 1) + "-" + pad(cumple.getDate()),
        etiquetas: etiquetas, ficha: i < 60 ? FICHAS[i % FICHAS.length] : "",
        desde: addDias(hoy, -(visitas * ciclo + 10)).toISOString(), nota: ""
      };
    });
    var normales = clientes.filter(function (c) { return c.tipo === "normal"; });
    var futuros = normales.slice().sort(function () { return r() - 0.5; });
    var iFuturo = 0;
    function clienteFuturo() { return iFuturo < futuros.length ? futuros[iFuturo++] : normales[Math.floor(r() * normales.length)]; }
    function clientePasado() { return normales[Math.floor(r() * normales.length)]; }

    // ---- Citas: 7 días atrás, hoy y 6 días adelante ----
    var citas = [];
    var nowMin = minDelDia(ahora);
    for (var d = -7; d <= 6; d++) {
      var dia = addDias(hoy, d);
      var h = shop.horario[dia.getDay()];
      if (!h) continue;
      var ocupacion = d === -7 ? 0.6 : d < 0 ? 0.7 : d === 0 ? 0.82 : d === 1 ? 0.42 : Math.max(0.14, 0.36 - d * 0.04);
      barberos.forEach(function (b) {
        var m = h[0] + (b.id === "b4" ? 40 : 0);
        while (m < h[1] - 30) {
          if (r() > ocupacion) { m += pesoElegir([[20, 2], [40, 1], [60, 1]]); continue; }
          var sid = pesoElegir(pesosServicio);
          var s = servicios.filter(function (x) { return x.id === sid; })[0];
          if (m + s.dur > h[1]) break;
          var esFutura = d > 0 || (d === 0 && m > nowMin);
          var cli = esFutura ? clienteFuturo() : clientePasado();
          var inicio = enMin(dia, m);
          var fuente = d <= 0 ? pesoElegir([["whatsapp", 44], ["web", 22], ["manual", 22], ["fila", 12]]) : pesoElegir([["whatsapp", 55], ["web", 30], ["manual", 15]]);
          var conAnticipo = (fuente === "whatsapp" || fuente === "web");
          var estadoCita, fin = m + s.dur;
          if (d < 0 || (d === 0 && fin <= nowMin)) {
            estadoCita = pesoElegir([["terminada", 93], ["no-show", 4], ["cancelada", 3]]);
          } else if (d === 0 && m <= nowMin) {
            estadoCita = "en-silla";
          } else {
            estadoCita = conAnticipo ? pesoElegir([["confirmada", 72], ["pendiente", 28]]) : "confirmada";
          }
          // la reserva se hizo antes que la cita, y nunca en el futuro
          var creada = addDias(inicio, -(Math.floor(r() * 4) + 1));
          if (creada > ahora) creada = new Date(ahora.getTime() - Math.floor(r() * 600 + 5) * 60000);
          var anticipo = null;
          if (conAnticipo && estadoCita !== "cancelada") {
            var pagado = estadoCita !== "pendiente";
            anticipo = { monto: 10000, medio: pesoElegir([["breb", 4], ["nequi", 5], ["pse", 1]]), pagado: pagado, fecha: new Date(Math.min(creada.getTime() + 4 * 60000, ahora.getTime())).toISOString() };
          }
          var pago = null;
          if (estadoCita === "terminada") {
            var propina = r() < 0.22 ? elegir([2000, 3000, 5000, 5000, 10000]) : 0;
            pago = { medio: pesoElegir([["nequi", 35], ["efectivo", 30], ["breb", 20], ["tarjeta", 15]]), monto: s.precio, propina: propina, fecha: enMin(dia, fin).toISOString() };
          }
          citas.push({
            id: uid("ci"), cliente: cli.id, barbero: b.id, servicio: s.id, inicio: inicio.toISOString(), dur: s.dur,
            precio: s.precio, estado: estadoCita, fuente: fuente, anticipo: anticipo, pago: pago,
            creada: creada.toISOString(), recordatorio: d <= 1, notas: ""
          });
          m += s.dur + pesoElegir([[0, 6], [10, 2], [20, 1]]);
        }
      });
    }

    // ---- Que se vea viva: si estamos en horario, 3 barberos están cortando ahora ----
    var hHoy = shop.horario[hoy.getDay()];
    if (hHoy && nowMin >= hHoy[0] + 20 && nowMin < hHoy[1] - 30) {
      barberos.slice(0, 3).forEach(function (b, i) {
        var deHoy = citas.filter(function (c) { return c.barbero === b.id && mismoDia(c.inicio, hoy) && c.estado !== "cancelada" && c.estado !== "no-show"; });
        if (deHoy.some(function (c) { var a = minDelDia(c.inicio); return a <= nowMin && nowMin < a + c.dur; })) return;
        var s = servicios[i === 1 ? 1 : 0];
        var ini = nowMin - (8 + i * 7); ini -= ini % 5;
        citas = citas.filter(function (c) {
          var a = minDelDia(c.inicio);
          return !(c.barbero === b.id && mismoDia(c.inicio, hoy) && a < ini + s.dur && ini < a + c.dur);
        });
        citas.push({
          id: uid("ci"), cliente: normales[(i * 7 + 3) % normales.length].id, barbero: b.id, servicio: s.id, inicio: enMin(hoy, ini).toISOString(), dur: s.dur,
          precio: s.precio, estado: "en-silla", fuente: ["manual", "whatsapp", "fila"][i], anticipo: i === 1 ? { monto: 10000, medio: "breb", pagado: true, fecha: addDias(hoy, -1).toISOString() } : null,
          pago: null, creada: addDias(hoy, -1).toISOString(), recordatorio: true, notas: ""
        });
      });
    }

    // La última visita de cada cliente coincide con su última cita terminada
    citas.forEach(function (c) {
      if (c.estado !== "terminada") return;
      var cli = clientes.filter(function (x) { return x.id === c.cliente; })[0];
      if (cli && new Date(c.inicio) > new Date(cli.ultima)) cli.ultima = c.inicio;
    });

    // ---- Fila virtual (solo si estamos en horario) ----
    var fila = [];
    if (hHoy && nowMin >= hHoy[0] && nowMin < hHoy[1] - 60) {
      [["Brayan Muñoz", "s1", "local", 34], ["Esteban Cardona", "s2", "camino", 21], ["Julián Henao", "s1", "casa", 12], ["Pablo Quintero", "s3", "casa", 4]].forEach(function (f, i) {
        var cli = clientes.filter(function (c) { return c.nombre === f[0]; })[0];
        fila.push({ id: uid("fi"), nombre: f[0], cliente: cli ? cli.id : null, tel: cli ? cli.tel : "", servicio: f[1], via: i % 2 ? "whatsapp" : "qr", estado: f[2], entro: new Date(Date.now() - f[3] * 60000).toISOString(), avisado: i < 2 });
      });
    }

    // ---- Automatizaciones ----
    var autos = autosBase(true);

    // ---- Actividad de hoy ----
    var actividad = [];
    function act(minAtras, tipo, texto, extra) {
      var t = new Date(Date.now() - minAtras * 60000);
      if (!mismoDia(t, ahora)) return;
      actividad.push(Object.assign({ id: uid("ac"), t: t.toISOString(), tipo: tipo, texto: texto }, extra || {}));
    }
    act(4, "fila", "Julián H. entró a la fila virtual por QR · va de 3º", { auto: "a8" });
    act(11, "whatsapp", "El asistente agendó a Santiago G. para mañana a las 4:00 p. m.", { auto: "a1" });
    act(26, "plata", "Lista de espera: Mateo Z. tomó el turno liberado de las 3:20 p. m.", { auto: "a4", plata: 45000 });
    act(48, "resena", "Felipe V. dejó una reseña de 5 estrellas", { auto: "a7" });
    act(75, "cal", "Recordatorio de 2 h enviado a 6 clientes · 6 confirmaron", { auto: "a2" });
    act(130, "plata", "Ciclo de corte: Sebastián A. reservó para el jueves 6:00 p. m.", { auto: "a5", plata: 30000 });
    act(190, "escudo", "Anti-plantón: anticipo de $10.000 retenido · Óscar D. reagendó", { auto: "a3", plata: 10000 });
    act(260, "cal", "Recordatorio de 24 h enviado a 18 clientes · 16 confirmaron", { auto: "a2" });
    act(340, "whatsapp", "El asistente respondió 7 mensajes de la noche y agendó 3 citas", { auto: "a1" });
    actividad.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });

    return {
      v: VERSION, creado: new Date().toISOString(), shop: shop, barberos: barberos, servicios: servicios,
      clientes: clientes, citas: citas, fila: fila, autos: autos, actividad: actividad, pagos: [],
      ajustes: { demoVivo: true }
    };
  }

  /** Barbería real recién creada: sin datos de ejemplo, el dueño como primer barbero y las recetas listas. */
  function estadoNuevo(d) {
    d = d || {};
    var dueno = (d.dueno || "Dueño").trim();
    var nombre = (d.nombre || "Mi barbería").trim();
    return {
      v: VERSION, creado: new Date().toISOString(),
      shop: {
        nombre: nombre, slug: d.slug || "mi-barberia", barrio: d.barrio || "Medellín", ciudad: d.ciudad || "Medellín",
        direccion: d.direccion || (d.barrio ? d.barrio + ", Medellín" : "Medellín"), dueno: dueno, whatsapp: d.whatsapp || "", plan: "barberia",
        horario: { 0: [600, 960], 1: [540, 1200], 2: [540, 1200], 3: [540, 1200], 4: [540, 1200], 5: [540, 1230], 6: [540, 1230] },
        anticipo: { activo: true, tipo: "fijo", valor: 10000, porcentaje: 25 },
        medios: { nequi: true, breb: true, daviplata: true, pse: true, tarjeta: true, efectivo: true },
        tono: "paisa", rating: 5, resenas: 0, linkResena: "", onboarded: true
      },
      barberos: [{ id: "b1", nombre: dueno, alias: "", rol: "Dueño", modo: "dueno", comision: 1, alquiler: 0, especialidades: ["Corte"], rating: 5, tel: d.whatsapp || "" }],
      servicios: serviciosBase(), clientes: [], citas: [], fila: [], autos: autosBase(false),
      actividad: [{ id: uid("ac"), t: new Date().toISOString(), tipo: "rayo", texto: "¡Bienvenido! " + nombre + " quedó creada con 12 automatizaciones listas." }],
      pagos: [], ajustes: { demoVivo: false }
    };
  }
  BS.semilla = semilla;
  BS.estadoNuevo = estadoNuevo;

  /* ---------------- Parches: lo que cambió entre dos estados ----------------
     Lo usan el panel (para mandar sus cambios) y el servidor (para aplicarlos).
     Las colecciones se comparan por id; shop y ajustes van completos. */
  var COLECCIONES = ["citas", "clientes", "fila", "autos", "actividad", "pagos", "barberos", "servicios"];
  var OBJETOS = ["shop", "ajustes"];
  BS.COLECCIONES = COLECCIONES;
  BS.diffEstado = function (antes, despues) {
    var p = { colecciones: {}, objetos: {} }, vacio = true;
    antes = antes || {};
    COLECCIONES.forEach(function (k) {
      var mapa = {};
      (antes[k] || []).forEach(function (x) { mapa[x.id] = JSON.stringify(x); });
      var vivos = {}, upsert = [], borrar = [];
      (despues[k] || []).forEach(function (x) {
        vivos[x.id] = 1;
        if (mapa[x.id] !== JSON.stringify(x)) upsert.push(x);
      });
      Object.keys(mapa).forEach(function (id) { if (!vivos[id]) borrar.push(id); });
      if (upsert.length || borrar.length) { p.colecciones[k] = { upsert: upsert, borrar: borrar }; vacio = false; }
    });
    OBJETOS.forEach(function (k) {
      if (JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) { p.objetos[k] = despues[k]; vacio = false; }
    });
    p.vacio = vacio;
    return p;
  };
  BS.aplicarParche = function (est, p) {
    if (!p) return est;
    Object.keys(p.colecciones || {}).forEach(function (k) {
      if (COLECCIONES.indexOf(k) < 0) return;
      var c = p.colecciones[k], lista = est[k] || (est[k] = []);
      var idx = {}; lista.forEach(function (x, i) { idx[x.id] = i; });
      (c.upsert || []).forEach(function (x) {
        if (!x || typeof x.id !== "string") return;
        if (idx[x.id] != null) lista[idx[x.id]] = x; else { idx[x.id] = lista.length; lista.push(x); }
      });
      if (c.borrar && c.borrar.length) {
        var fuera = {}; c.borrar.forEach(function (id) { fuera[id] = 1; });
        est[k] = lista.filter(function (x) { return !fuera[x.id]; });
      }
    });
    Object.keys(p.objetos || {}).forEach(function (k) { if (OBJETOS.indexOf(k) >= 0 && p.objetos[k]) est[k] = p.objetos[k]; });
    if (est.actividad) {
      est.actividad.sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
      if (est.actividad.length > 160) est.actividad.length = 160;
    }
    return est;
  };

  /* ---------------- Persistencia ---------------- */
  function guardar() {
    if (modo !== "local") return;
    try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (e) { /* modo privado: queda en memoria */ }
  }
  function cargar() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var x = JSON.parse(raw);
        if (x && x.v === VERSION) { estado = x; return; }
      } catch (e) { /* datos dañados: se regeneran */ }
    }
    estado = semilla();
    guardar();
  }
  function avisar(motivo, dato) {
    oyentes.slice().forEach(function (fn) { try { fn(motivo, dato); } catch (e) { console.warn("[BS oyente]", e); } });
  }
  function commit(motivo, dato) {
    guardar();
    avisar(motivo || "cambio", dato);
    if (BS.alCommit) { try { BS.alCommit(motivo || "cambio", dato); } catch (e) { console.warn("[BS alCommit]", e); } }
  }

  if (RAIZ.addEventListener) RAIZ.addEventListener("storage", function (e) {
    if (modo !== "local" || e.key !== KEY || !e.newValue) return;
    var previo = estado;
    try { estado = JSON.parse(e.newValue); } catch (err) { return; }
    var idsPrevios = {};
    (previo && previo.actividad || []).forEach(function (a) { idsPrevios[a.id] = 1; });
    var nuevas = (estado.actividad || []).filter(function (a) { return !idsPrevios[a.id]; });
    avisar("externo", { nuevas: nuevas });
  });

  BS.get = function () { if (!estado && modo === "local") cargar(); return estado; };
  BS.subscribe = function (fn) { oyentes.push(fn); return function () { oyentes = oyentes.filter(function (f) { return f !== fn; }); }; };
  BS.commit = commit;
  BS.reset = function () { estado = semilla(); commit("reset"); };
  /** Trabaja con un estado en memoria (servidor o panel conectado). No toca localStorage. */
  BS.usar = function (nuevo) { modo = "memoria"; estado = nuevo; };
  /** Modo demo: carga (o crea) los datos de ejemplo del navegador. */
  BS.modoLocal = function () { modo = "local"; if (!estado) cargar(); };
  BS.modo = function () { return modo; };

  /* ---------------- Consultas ---------------- */
  function porId(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; }
  BS.servicio = function (id) { return porId(BS.get().servicios, id); };
  BS.barbero = function (id) { return porId(BS.get().barberos, id); };
  BS.cliente = function (id) { return porId(BS.get().clientes, id); };
  BS.cita = function (id) { return porId(BS.get().citas, id); };
  BS.auto = function (id) { return porId(BS.get().autos, id); };
  BS.autoPorClave = function (k) { return BS.get().autos.filter(function (a) { return a.clave === k; })[0] || null; };

  BS.horario = function (fecha) { var h = BS.get().shop.horario[new Date(fecha).getDay()]; return h || null; };
  BS.abiertoAhora = function () { var h = BS.horario(new Date()); var m = ahoraMin(); return !!(h && m >= h[0] && m < h[1]); };
  BS.finCita = function (c) { return new Date(new Date(c.inicio).getTime() + c.dur * 60000); };
  BS.citaActiva = function (c) { return c.estado !== "cancelada" && c.estado !== "no-show"; };

  BS.citasDelDia = function (fecha, barberoId) {
    return BS.get().citas.filter(function (c) {
      return mismoDia(c.inicio, fecha) && (!barberoId || c.barbero === barberoId);
    }).sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); });
  };

  /** Turnos libres para un servicio. barberoId puede ser "cualquiera". */
  BS.slotsLibres = function (fecha, servicioId, barberoId, paso) {
    paso = paso || 20;
    var h = BS.horario(fecha);
    if (!h) return [];
    var s = BS.servicio(servicioId) || { dur: 40 };
    var barberos = barberoId && barberoId !== "cualquiera" ? [BS.barbero(barberoId)] : BS.get().barberos.slice();
    var esHoy = mismoDia(fecha, new Date());
    var minimo = esHoy ? ahoraMin() + 15 : 0;
    var ocupadas = {};
    barberos.forEach(function (b) {
      ocupadas[b.id] = BS.citasDelDia(fecha, b.id).filter(BS.citaActiva).map(function (c) {
        var ini = minDelDia(c.inicio); return [ini, ini + c.dur];
      });
    });
    var res = [];
    for (var m = h[0]; m + s.dur <= h[1]; m += paso) {
      if (m < minimo) continue;
      var libres = barberos.filter(function (b) {
        return !ocupadas[b.id].some(function (o) { return m < o[1] && o[0] < m + s.dur; });
      });
      if (!libres.length) continue;
      libres.sort(function (a, b) { return ocupadas[a.id].length - ocupadas[b.id].length; });
      res.push({ min: m, barbero: libres[0].id, barberos: libres.map(function (b) { return b.id; }) });
    }
    return res;
  };

  BS.estadoCiclo = function (cli) {
    var dias = diasEntre(cli.ultima, new Date());
    var pct = Math.min(1.25, dias / cli.ciclo);
    var proxima = BS.get().citas.filter(function (c) {
      return c.cliente === cli.id && BS.citaActiva(c) && new Date(c.inicio) > new Date() && c.estado !== "terminada";
    }).sort(function (a, b) { return new Date(a.inicio) - new Date(b.inicio); })[0] || null;
    var estado = proxima ? "agendado" : dias > 45 ? "dormido" : dias >= cli.ciclo - 2 ? "toca" : "al-dia";
    return { dias: dias, ciclo: cli.ciclo, pct: pct, faltan: cli.ciclo - dias, proxima: proxima, estado: estado };
  };

  BS.esCumpleProximo = function (cli, dentroDe) {
    var hoy = hoy0();
    for (var i = 0; i <= (dentroDe || 7); i++) {
      var d = addDias(hoy, i);
      if (pad(d.getMonth() + 1) + "-" + pad(d.getDate()) === cli.cumple) return i;
    }
    return -1;
  };

  BS.filaOrdenada = function () {
    return BS.get().fila.slice().sort(function (a, b) { return new Date(a.entro) - new Date(b.entro); });
  };
  BS.esperaFila = function (posicion) {
    // aprox: barberos libres atienden en paralelo, 35 min promedio por servicio
    var n = Math.max(1, BS.get().barberos.length - 1);
    return Math.max(5, Math.round(((posicion - 1) / n) * 35 + 10));
  };

  /** Dinero: entradas reales (anticipos pagados + pagos del servicio + propinas) */
  BS.movimientos = function (desde, hasta) {
    var st = BS.get(), out = [];
    st.citas.forEach(function (c) {
      var cli = BS.cliente(c.cliente), srv = BS.servicio(c.servicio), b = BS.barbero(c.barbero);
      var nombre = cli ? nombreCorto(cli.nombre) : "Cliente";
      if (c.anticipo && c.anticipo.pagado) {
        out.push({ id: c.id + "-an", t: c.anticipo.fecha, tipo: "anticipo", concepto: "Anticipo · " + nombre, detalle: (srv ? srv.nombre : "") + " · " + fechaCorta(c.inicio), medio: c.anticipo.medio, monto: c.anticipo.monto, barbero: c.barbero, cita: c.id });
      }
      if (c.pago) {
        var abono = c.anticipo && c.anticipo.pagado ? c.anticipo.monto : 0;
        out.push({ id: c.id + "-pg", t: c.pago.fecha, tipo: "servicio", concepto: (srv ? srv.nombre : "Servicio") + " · " + nombre, detalle: "con " + (b ? b.nombre : ""), medio: c.pago.medio, monto: c.pago.monto - abono, barbero: c.barbero, cita: c.id });
        if (c.pago.propina) out.push({ id: c.id + "-pr", t: c.pago.fecha, tipo: "propina", concepto: "Propina · para " + (b ? b.nombre : ""), detalle: nombre, medio: c.pago.medio, monto: c.pago.propina, barbero: c.barbero, cita: c.id });
      }
    });
    st.pagos.forEach(function (p) {
      var b = BS.barbero(p.barbero);
      out.push({ id: p.id, t: p.t, tipo: "liquidacion", concepto: "Pago a " + (b ? b.nombre : "barbero"), detalle: "Liquidación · " + p.periodo, medio: p.medio, monto: -p.monto, barbero: p.barbero });
    });
    return out.filter(function (m) {
      var t = new Date(m.t);
      return (!desde || t >= desde) && (!hasta || t < hasta);
    }).sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
  };

  BS.ingresosDia = function (fecha) {
    var d0 = hoyDe(fecha), d1 = d0 + 86400000;
    return BS.movimientos(new Date(d0), new Date(d1)).filter(function (m) { return m.tipo !== "liquidacion"; })
      .reduce(function (s, m) { return s + m.monto; }, 0);
  };

  BS.inicioSemana = function (fecha) {
    var d = new Date(fecha); d.setHours(0, 0, 0, 0);
    var dow = (d.getDay() + 6) % 7; // lunes = 0
    return addDias(d, -dow);
  };

  /** Liquidación por barbero entre dos fechas */
  BS.liquidacion = function (desde, hasta) {
    var st = BS.get();
    var semanas = Math.max(1 / 7, (hasta - desde) / (7 * 86400000));
    return st.barberos.map(function (b) {
      var hechas = st.citas.filter(function (c) {
        var t = new Date(c.inicio);
        return c.barbero === b.id && c.estado === "terminada" && t >= desde && t < hasta;
      });
      var ventas = hechas.reduce(function (s, c) { return s + (c.pago ? c.pago.monto : c.precio); }, 0);
      var propinas = hechas.reduce(function (s, c) { return s + (c.pago ? c.pago.propina : 0); }, 0);
      var base = b.modo === "porcentaje" ? ventas * b.comision : b.modo === "alquiler" ? ventas - b.alquiler * semanas : 0;
      var pagado = st.pagos.filter(function (p) { return p.barbero === b.id && new Date(p.t) >= desde && new Date(p.t) < hasta; })
        .reduce(function (s, p) { return s + p.monto; }, 0);
      var total = b.modo === "dueno" ? 0 : Math.max(0, Math.round(base + propinas));
      return { barbero: b, servicios: hechas.length, ventas: ventas, propinas: propinas, base: Math.round(base), total: total, pagado: pagado, pendiente: Math.max(0, total - pagado) };
    });
  };

  BS.plataRecuperada = function () {
    return BS.get().autos.reduce(function (s, a) { return s + (a.stats.plata || 0); }, 0);
  };

  /* ---------------- Mutaciones ---------------- */
  BS.actividad = function (item) {
    var st = BS.get();
    var a = Object.assign({ id: uid("ac"), t: new Date().toISOString() }, item);
    st.actividad.unshift(a);
    if (st.actividad.length > 160) st.actividad.length = 160;
    return a;
  };

  BS.upsertCliente = function (datos) {
    var st = BS.get();
    var tel = String(datos.tel || "").replace(/\D/g, "").replace(/^57(?=3\d{9}$)/, "");
    var cli = null;
    if (datos.id) cli = BS.cliente(datos.id);
    if (!cli && tel) cli = st.clientes.filter(function (c) { return c.tel === tel; })[0] || null;
    if (!cli && datos.nombre) cli = st.clientes.filter(function (c) { return normalizar(c.nombre) === normalizar(datos.nombre); })[0] || null;
    if (!cli) {
      cli = {
        id: uid("c"), nombre: datos.nombre || "Cliente", tel: tel, ciclo: 21, ultima: new Date().toISOString(),
        visitas: 0, gasto: 0, barbero: datos.barbero || "b2", cumple: "", etiquetas: ["Nuevo"], ficha: "", desde: new Date().toISOString(), nota: ""
      };
      st.clientes.push(cli);
    } else if (tel && !cli.tel) cli.tel = tel;
    return cli;
  };

  BS.crearCita = function (d, opciones) {
    opciones = opciones || {};
    var st = BS.get();
    var cli = d.cliente ? BS.cliente(d.cliente) : BS.upsertCliente({ nombre: d.nombre, tel: d.tel, barbero: d.barbero });
    var s = BS.servicio(d.servicio);
    var cita = {
      id: uid("ci"), cliente: cli.id, barbero: d.barbero, servicio: s.id, inicio: new Date(d.inicio).toISOString(), dur: s.dur,
      precio: s.precio, estado: d.estado || "confirmada", fuente: d.fuente || "manual", anticipo: d.anticipo || null, pago: null,
      creada: new Date().toISOString(), recordatorio: false, notas: d.notas || "", canal: d.canal || null
    };
    st.citas.push(cita);
    if (!opciones.silencio && BS.emit) BS.emit("cita.creada", { cita: cita });
    commit("cita", cita);
    return cita;
  };

  BS.actualizarCita = function (id, cambios) {
    var c = BS.cita(id); if (!c) return null;
    Object.assign(c, cambios);
    commit("cita", c);
    return c;
  };

  BS.pagarAnticipo = function (id, medio) {
    var c = BS.cita(id); if (!c) return null;
    var monto = (c.anticipo && c.anticipo.monto) || BS.montoAnticipo(c.precio);
    c.anticipo = { monto: monto, medio: medio || "breb", pagado: true, fecha: new Date().toISOString() };
    if (c.estado === "pendiente") c.estado = "confirmada";
    var cli = BS.cliente(c.cliente);
    BS.actividad({ tipo: "plata", texto: "Anticipo recibido de " + (cli ? nombreCorto(cli.nombre) : "un cliente") + " · " + BS.MEDIOS[medio || "breb"], plata: 0, monto: monto, toast: true });
    commit("cita", c);
    return c;
  };

  BS.montoAnticipo = function (precio) {
    var a = BS.get().shop.anticipo;
    if (!a.activo) return 0;
    return a.tipo === "fijo" ? a.valor : Math.round((precio * a.porcentaje) / 100 / 1000) * 1000;
  };

  BS.marcarLlegada = function (id) {
    var c = BS.cita(id); if (!c) return;
    c.estado = "en-silla";
    var cli = BS.cliente(c.cliente);
    BS.actividad({ tipo: "tijeras", texto: (cli ? nombreCorto(cli.nombre) : "El cliente") + " se sentó en la silla de " + BS.barbero(c.barbero).nombre });
    commit("cita", c);
  };

  BS.cobrarCita = function (id, medio, propina) {
    var c = BS.cita(id); if (!c) return;
    c.estado = "terminada";
    c.pago = { medio: medio || "efectivo", monto: c.precio, propina: propina || 0, fecha: new Date().toISOString() };
    var cli = BS.cliente(c.cliente);
    if (cli) {
      cli.visitas += 1; cli.gasto += c.precio;
      var antes = diasEntre(cli.ultima, new Date());
      if (antes > 6 && antes < 70) cli.ciclo = Math.round(cli.ciclo * 0.7 + antes * 0.3); // aprende el ciclo
      cli.ultima = new Date().toISOString();
      cli.etiquetas = cli.etiquetas.filter(function (e) { return e !== "Nuevo" || cli.visitas < 2; });
    }
    BS.actividad({ tipo: "plata", texto: "Cobro de " + pesos(c.precio + (propina || 0)) + " · " + (cli ? nombreCorto(cli.nombre) : "") + " · " + BS.MEDIOS[c.pago.medio], monto: c.precio + (propina || 0) });
    if (BS.emit) BS.emit("cita.terminada", { cita: c });
    commit("cita", c);
  };

  BS.cancelarCita = function (id, motivo) {
    var c = BS.cita(id); if (!c) return;
    c.estado = "cancelada";
    var cli = BS.cliente(c.cliente);
    BS.actividad({ tipo: "x", texto: (cli ? nombreCorto(cli.nombre) : "Un cliente") + " canceló " + diaRelativo(c.inicio) + " a las " + hora(c.inicio) + (motivo ? " · " + motivo : ""), toast: true });
    if (BS.emit) BS.emit("cita.cancelada", { cita: c });
    commit("cita", c);
  };

  BS.noShow = function (id) {
    var c = BS.cita(id); if (!c) return;
    c.estado = "no-show";
    if (BS.emit) BS.emit("cita.noshow", { cita: c });
    commit("cita", c);
  };

  BS.unirseFila = function (d) {
    var st = BS.get();
    var cli = d.tel || d.nombre ? BS.upsertCliente({ nombre: d.nombre, tel: d.tel }) : null;
    var f = { id: uid("fi"), nombre: d.nombre || (cli && cli.nombre) || "Cliente", cliente: cli ? cli.id : null, tel: cli ? cli.tel : "", servicio: d.servicio || "s1", via: d.via || "qr", estado: "casa", entro: new Date().toISOString(), avisado: false };
    st.fila.push(f);
    var pos = BS.filaOrdenada().indexOf(f) + 1;
    BS.actividad({ tipo: "fila", texto: nombreCorto(f.nombre) + " entró a la fila virtual por " + (f.via === "qr" ? "QR" : f.via === "web" ? "el link" : "WhatsApp") + " · va de " + pos + "º", auto: "a8", toast: true });
    if (BS.emit) BS.emit("fila.entra", { fila: f, posicion: pos });
    commit("fila", f);
    return f;
  };

  BS.salirFila = function (id, silencio) {
    var st = BS.get();
    var f = porId(st.fila, id);
    st.fila = st.fila.filter(function (x) { return x.id !== id; });
    if (f && !silencio) BS.actividad({ tipo: "fila", texto: nombreCorto(f.nombre) + " salió de la fila" });
    if (BS.emit) BS.emit("fila.avanza", {});
    commit("fila");
  };

  /** Pasa a la silla al primero de la fila (o a uno específico) con el barbero indicado */
  BS.pasarASilla = function (filaId, barberoId) {
    var st = BS.get();
    var orden = BS.filaOrdenada();
    var f = filaId ? porId(st.fila, filaId) : orden[0];
    if (!f) return null;
    var b = barberoId ? BS.barbero(barberoId) : BS.barberoLibre();
    if (!b) b = st.barberos[1] || st.barberos[0];
    var cli = f.cliente ? BS.cliente(f.cliente) : BS.upsertCliente({ nombre: f.nombre, tel: f.tel });
    var s = BS.servicio(f.servicio) || st.servicios[0];
    var ahora = new Date(); ahora.setSeconds(0, 0);
    var cita = { id: uid("ci"), cliente: cli.id, barbero: b.id, servicio: s.id, inicio: ahora.toISOString(), dur: s.dur, precio: s.precio, estado: "en-silla", fuente: "fila", anticipo: null, pago: null, creada: ahora.toISOString(), recordatorio: false, notas: "", filaId: f.id };
    st.citas.push(cita);
    st.fila = st.fila.filter(function (x) { return x.id !== f.id; });
    BS.actividad({ tipo: "tijeras", texto: nombreCorto(f.nombre) + " pasó de la fila a la silla de " + b.nombre });
    if (BS.emit) BS.emit("fila.avanza", {});
    commit("fila", cita);
    return cita;
  };

  BS.barberoLibre = function () {
    var ahora = new Date();
    var libres = BS.get().barberos.filter(function (b) {
      return !BS.citasDelDia(ahora, b.id).some(function (c) {
        return BS.citaActiva(c) && c.estado !== "terminada" && new Date(c.inicio) <= new Date(ahora.getTime() + 10 * 60000) && BS.finCita(c) > ahora;
      });
    });
    return libres[0] || null;
  };

  BS.pagarLiquidacion = function (barberoId, monto, periodo) {
    var st = BS.get();
    var p = { id: uid("pg"), barbero: barberoId, monto: monto, periodo: periodo, medio: "breb", t: new Date().toISOString() };
    st.pagos.push(p);
    var b = BS.barbero(barberoId);
    BS.actividad({ tipo: "plata", texto: "Pago de " + pesos(monto) + " enviado a " + b.nombre + " por Bre-B · " + periodo, monto: -monto });
    commit("pago", p);
    return p;
  };

  BS.guardarAuto = function (a) {
    var st = BS.get();
    var i = st.autos.findIndex(function (x) { return x.id === a.id; });
    if (i >= 0) st.autos[i] = a; else st.autos.push(a);
    commit("auto", a);
  };
  BS.toggleAuto = function (id) {
    var a = BS.auto(id); if (!a) return;
    a.activa = !a.activa;
    BS.actividad({ tipo: "rayo", texto: "Automatización «" + a.nombre + "» " + (a.activa ? "prendida" : "apagada") });
    commit("auto", a);
  };

  BS.actualizarShop = function (cambios) { Object.assign(BS.get().shop, cambios); commit("shop"); };
  BS.ajuste = function (k, v) { BS.get().ajustes[k] = v; commit("ajustes"); };

  BS.linkReservas = function () { return "barbersaas.co/" + BS.get().shop.slug; };
  BS.linkFila = function () { return BS.linkReservas() + "/fila"; };
  // El estado se carga al primer BS.get() (demo) o lo entrega conexion.js / el servidor con BS.usar().
})();
