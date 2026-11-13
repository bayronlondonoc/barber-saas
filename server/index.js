// Barber SaaS — servidor. Sin dependencias: solo Node 22.13 o superior.
//   node server/index.js
"use strict";
const config = require("./config");
process.env.TZ = config.zona; // horarios de la barbería en hora de Colombia, esté donde esté el servidor

const http = require("http");
const rutas = require("./rutas");
const motor = require("./motor");
const wa = require("./whatsapp");

const servidor = http.createServer((req, res) => { rutas.atender(req, res); });
servidor.requestTimeout = 30000;
servidor.headersTimeout = 35000;

servidor.listen(config.puerto, () => {
  console.log(`\n  Barber SaaS corriendo en ${config.urlPublica}  (puerto ${config.puerto})`);
  console.log(`  WhatsApp: ${config.whatsapp.proveedor === "meta" ? "API de Meta" : "simulador"} · Pagos: ${config.pagos.proveedor === "wompi" ? "Wompi" : "simulador"} · Zona: ${config.zona}`);
  console.log(`  Base de datos: ${config.archivoDB}\n`);
});

// El reloj de las automatizaciones revisa cada minuto (recordatorios, ciclo de corte, huecos...)
setInterval(() => { try { motor.tick(); } catch (e) { console.warn("[reloj]", e); } }, 60000);
setTimeout(() => { try { motor.tick(); } catch (e) { console.warn("[reloj]", e); } }, 5000);
setTimeout(() => wa.procesarCola().catch(() => {}), 2000);

function cerrar() { console.log("\n  Cerrando Barber SaaS…"); servidor.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on("SIGINT", cerrar);
process.on("SIGTERM", cerrar);
process.on("unhandledRejection", (e) => console.warn("[promesa]", e));
