// Copia de seguridad en caliente de la base de datos (no hay que parar el servidor).
//   npm run respaldo   → datos/respaldos/barbersaas-AAAA-MM-DD-HH-MM.db  (se guardan los últimos 14)
// Copiá esa carpeta también fuera del servidor (Google Drive, otro disco…): si el servidor se daña, el respaldo no puede vivir solo ahí.
"use strict";
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const config = require("./config");

if (!fs.existsSync(config.archivoDB)) { console.error("No encontré la base de datos en " + config.archivoDB); process.exit(1); }
const dir = path.join(path.dirname(config.archivoDB), "respaldos");
fs.mkdirSync(dir, { recursive: true });
const sello = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const destino = path.join(dir, "barbersaas-" + sello + ".db");
if (fs.existsSync(destino)) fs.unlinkSync(destino);

const db = new DatabaseSync(config.archivoDB);
db.exec("VACUUM INTO '" + destino.replace(/'/g, "''") + "'");
db.close();

const viejos = fs.readdirSync(dir).filter((f) => /^barbersaas-[\d-]+\.db$/.test(f)).sort().slice(0, -14);
viejos.forEach((f) => fs.unlinkSync(path.join(dir, f)));
console.log("Respaldo listo: " + destino + (viejos.length ? " · borré " + viejos.length + " respaldos viejos" : ""));
