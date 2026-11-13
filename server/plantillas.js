// Plantillas de WhatsApp que usa Barber SaaS.
// Meta exige plantillas aprobadas para los mensajes que la barbería inicia cuando el cliente
// no ha escrito en las últimas 24 h (recordatorios, ciclo de corte, ofertas...).
// Dentro de esas 24 h se manda el texto que el dueño editó en el panel.
//
//   node server/plantillas.js            → muestra el catálogo
//   node server/plantillas.js --crear    → las registra en tu cuenta de WhatsApp Business (WABA)
"use strict";
const config = require("./config");
const PIE_PROMO = "Escribí BAJA si no querés más promociones";

const P = {
  confirmacion: {
    nombre: "bs_confirmacion_cita", categoria: "UTILITY",
    cuerpo: "¡Hola {{1}}! Quedaste agendado en {{2}}: {{3}} con {{4}}, {{5}} a las {{6}}. {{7}} ¡Te esperamos!",
    variables: ["nombre", "barberia", "servicio", "barbero", "dia", "hora", "anticipo"],
    ejemplo: ["Camilo", "La Esquina Barber Club", "Corte + barba", "Juan", "mañana", "4:00 p. m.", "Tu turno ya está separado."]
  },
  link_pago: {
    nombre: "bs_link_pago", categoria: "UTILITY",
    cuerpo: "Hola {{1}}, para separar tu turno en {{2}} el anticipo es de {{3}}. Pagalo aquí: {{4}} y listo, te confirmamos al instante.",
    variables: ["nombre", "barberia", "monto", "link"],
    ejemplo: ["Camilo", "La Esquina Barber Club", "$10.000", "https://checkout.wompi.co/l/abc123"]
  },
  anticipo_recibido: {
    nombre: "bs_anticipo_recibido", categoria: "UTILITY",
    cuerpo: "Hola {{1}}, recibimos tu anticipo de {{2}}. Quedaste agendado en {{3}} {{4}} a las {{5}}. ¡Te esperamos!",
    variables: ["nombre", "monto", "barberia", "dia", "hora"],
    ejemplo: ["Camilo", "$10.000", "La Esquina Barber Club", "mañana", "4:00 p. m."]
  },
  recordatorio: {
    nombre: "bs_recordatorio", categoria: "UTILITY",
    cuerpo: "Hola {{1}}, te recordamos tu turno {{2}} a las {{3}} con {{4}} en {{5}}. ¿Nos confirmás?",
    variables: ["nombre", "dia", "hora", "barbero", "barberia"],
    ejemplo: ["Camilo", "mañana", "4:00 p. m.", "Juan", "La Esquina Barber Club"],
    botones: ["Confirmo", "Cambiar hora"]
  },
  espera: {
    nombre: "bs_turno_liberado", categoria: "MARKETING",
    cuerpo: "¡Se liberó un turno en {{1}}! {{2}} a las {{3}} con {{4}}. El primero que lo pida se lo queda.",
    variables: ["barberia", "dia", "hora", "barbero"],
    ejemplo: ["La Esquina Barber Club", "Hoy", "4:00 p. m.", "Juan"],
    botones: ["¡Lo quiero!"]
  },
  antiplanton: {
    nombre: "bs_no_llegaste", categoria: "UTILITY",
    cuerpo: "Hola {{1}}, te esperamos hoy a las {{2}} en {{3}} y no alcanzaste a llegar. ¿Querés reagendar?",
    variables: ["nombre", "hora", "barberia"],
    ejemplo: ["Camilo", "4:00 p. m.", "La Esquina Barber Club"],
    botones: ["Reagendar"]
  },
  ciclo: {
    nombre: "bs_ciclo_corte", categoria: "MARKETING",
    cuerpo: "Hola {{1}}, ya van {{2}} días desde tu último corte en {{3}}. ¿Te guardamos turno con {{4}}?",
    variables: ["nombre", "dias", "barberia", "barbero"],
    ejemplo: ["Camilo", "18", "La Esquina Barber Club", "Juan"],
    botones: ["Sí, agendame", "Ahora no"]
  },
  huecos: {
    nombre: "bs_hueco_libre", categoria: "MARKETING",
    cuerpo: "Hola {{1}}, hoy tenemos silla libre a las {{2}} con {{3}} en {{4}}. ¿Te animás?",
    variables: ["nombre", "hora", "barbero", "barberia"],
    ejemplo: ["Camilo", "3:00 p. m.", "Kevin", "La Esquina Barber Club"],
    botones: ["¡Voy!"]
  },
  resena: {
    nombre: "bs_pedir_resena", categoria: "MARKETING",
    cuerpo: "Hola {{1}}, gracias por venir a {{2}}. Si te gustó el corte, tu reseña nos ayuda mucho: {{3}} 🙏",
    variables: ["nombre", "barberia", "link"],
    ejemplo: ["Camilo", "La Esquina Barber Club", "https://g.page/r/ejemplo"]
  },
  fila: {
    nombre: "bs_turno_fila", categoria: "UTILITY",
    cuerpo: "Hola {{1}}, ya casi te toca en {{2}}: vas de {{3}} en la fila. Salí ya y te recibimos de una.",
    variables: ["nombre", "barberia", "posicion"],
    ejemplo: ["Camilo", "La Esquina Barber Club", "2º"]
  },
  cumple: {
    nombre: "bs_feliz_cumple", categoria: "MARKETING",
    cuerpo: "¡Feliz cumpleaños, {{1}}! Esta semana tu barba va por cuenta de {{2}}. Reservá aquí: {{3}} 🎂",
    variables: ["nombre", "barberia", "link"],
    ejemplo: ["Camilo", "La Esquina Barber Club", "https://barbersaas.co/reserva/?b=la-esquina"]
  },
  dormidos: {
    nombre: "bs_te_extranamos", categoria: "MARKETING",
    cuerpo: "Hola {{1}}, te extrañamos en {{2}}. Hace {{3}} días no venís y esta semana tenés 15 % en tu corte: {{4}} 💈",
    variables: ["nombre", "barberia", "dias", "link"],
    ejemplo: ["Camilo", "La Esquina Barber Club", "52", "https://barbersaas.co/reserva/?b=la-esquina"]
  },
  liquidacion: {
    nombre: "bs_liquidacion", categoria: "UTILITY",
    cuerpo: "Hola {{1}}, este es el resumen de tu semana en {{2}}: {{3}} servicios y {{4}} en ventas. Te corresponden {{5}}.",
    variables: ["nombre", "barberia", "servicios", "ventas", "total"],
    ejemplo: ["Juan", "La Esquina Barber Club", "38", "$1.520.000", "$1.012.000"]
  },
  cierre: {
    nombre: "bs_cierre_caja", categoria: "UTILITY",
    cuerpo: "Cierre de hoy en {{1}}: entraron {{2}} en {{3}} servicios. Nequi {{4}}, Bre-B {{5}}, efectivo {{6}}.",
    variables: ["barberia", "total", "servicios", "nequi", "breb", "efectivo"],
    ejemplo: ["La Esquina Barber Club", "$1.245.000", "31", "$420.000", "$310.000", "$385.000"]
  }
};

/** Arma la parte «plantilla» de un mensaje con los valores en el orden que pide Meta. */
function armar(clave, valores, payloads) {
  const p = P[clave];
  if (!p) return null;
  return {
    nombre: p.nombre,
    variables: p.variables.map((v) => { const x = valores[v]; return x == null || x === "" ? "-" : String(x).slice(0, 900); }),
    payloads: payloads || []
  };
}

async function crearEnMeta() {
  const { token, wabaId, version, idioma } = config.whatsapp;
  if (!token || !wabaId) { console.error("Falta WHATSAPP_TOKEN o WHATSAPP_WABA_ID en el .env"); process.exitCode = 1; return; }
  for (const clave of Object.keys(P)) {
    const p = P[clave];
    const componentes = [{ type: "BODY", text: p.cuerpo, example: { body_text: [p.ejemplo] } }];
    // Las promociones dicen cómo dejar de recibirlas (el motor entiende «BAJA»)
    if (p.categoria === "MARKETING") componentes.push({ type: "FOOTER", text: PIE_PROMO });
    if (p.botones) componentes.push({ type: "BUTTONS", buttons: p.botones.map((b) => ({ type: "QUICK_REPLY", text: b })) });
    const r = await fetch(`https://graph.facebook.com/${version}/${wabaId}/message_templates`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.nombre, language: idioma, category: p.categoria, components: componentes })
    });
    const j = await r.json().catch(() => ({}));
    console.log((r.ok ? "✔ " : "✘ ") + p.nombre + (r.ok ? " · " + (j.status || "enviada a revisión") : " · " + ((j.error && j.error.message) || r.status)));
  }
}

if (require.main === module) {
  if (process.argv.includes("--crear")) crearEnMeta();
  else for (const clave of Object.keys(P)) console.log(`${P[clave].nombre} (${P[clave].categoria})\n  ${P[clave].cuerpo}${P[clave].categoria === "MARKETING" ? "\n  Pie: " + PIE_PROMO : ""}${P[clave].botones ? "\n  Botones: " + P[clave].botones.join(" · ") : ""}\n`);
}

module.exports = { P, armar };
