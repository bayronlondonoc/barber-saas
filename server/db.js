// Base de datos: SQLite integrado en Node (node:sqlite), sin instalar nada.
// Cada barbería guarda su estado como un documento JSON versionado; lo que crece
// o es privado (usuarios, sesiones, llaves, mensajes, pagos) va en tablas aparte.
"use strict";
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const config = require("./config");

fs.mkdirSync(path.dirname(config.archivoDB), { recursive: true });
const db = new DatabaseSync(config.archivoDB);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS barberias (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, estado TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1, creada TEXT NOT NULL, actualizada TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY, barberia_id TEXT NOT NULL REFERENCES barberias(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL, nombre TEXT, hash TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'dueno', creado TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sesiones (
    token_hash TEXT PRIMARY KEY, usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira TEXT NOT NULL, creada TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS integraciones (
    barberia_id TEXT NOT NULL REFERENCES barberias(id) ON DELETE CASCADE, tipo TEXT NOT NULL, datos TEXT NOT NULL,
    PRIMARY KEY (barberia_id, tipo)
  );
  CREATE TABLE IF NOT EXISTS mensajes (
    id TEXT PRIMARY KEY, barberia_id TEXT NOT NULL, direccion TEXT NOT NULL, telefono TEXT NOT NULL,
    contenido TEXT NOT NULL, estado TEXT NOT NULL, intentos INTEGER NOT NULL DEFAULT 0, error TEXT,
    proveedor_id TEXT, auto_id TEXT, creado TEXT NOT NULL, enviar_desde TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mensajes_cola ON mensajes (estado, enviar_desde);
  CREATE INDEX IF NOT EXISTS mensajes_tel ON mensajes (barberia_id, telefono, direccion, creado);
  CREATE TABLE IF NOT EXISTS pagos (
    id TEXT PRIMARY KEY, barberia_id TEXT NOT NULL, cita_id TEXT NOT NULL, proveedor TEXT NOT NULL,
    proveedor_ref TEXT, monto INTEGER NOT NULL, estado TEXT NOT NULL, url TEXT, medio TEXT,
    redirect TEXT, creado TEXT NOT NULL, actualizado TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS pagos_ref ON pagos (proveedor, proveedor_ref);
  CREATE INDEX IF NOT EXISTS pagos_cita ON pagos (barberia_id, cita_id);
  CREATE TABLE IF NOT EXISTS conversaciones (
    barberia_id TEXT NOT NULL, telefono TEXT NOT NULL, datos TEXT NOT NULL, ultima_entrada TEXT, actualizada TEXT NOT NULL,
    PRIMARY KEY (barberia_id, telefono)
  );
  CREATE TABLE IF NOT EXISTS ofertas (
    id TEXT PRIMARY KEY, barberia_id TEXT NOT NULL, tipo TEXT NOT NULL, datos TEXT NOT NULL,
    estado TEXT NOT NULL, creada TEXT NOT NULL, expira TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tareas (clave TEXT PRIMARY KEY, barberia_id TEXT NOT NULL, ejecutada TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS webhooks_vistos (id TEXT PRIMARY KEY, origen TEXT NOT NULL, recibido TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS citas_archivo (id TEXT PRIMARY KEY, barberia_id TEXT NOT NULL, datos TEXT NOT NULL, inicio TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS ajustes_servidor (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
`);

/* Secreto del servidor (se crea solo la primera vez) para firmar los links públicos de citas y fila. */
const crypto = require("crypto");
let secretoServidor = (db.prepare("SELECT valor FROM ajustes_servidor WHERE clave = 'secreto'").get() || {}).valor;
if (!secretoServidor) {
  secretoServidor = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO ajustes_servidor (clave, valor) VALUES ('secreto', ?)").run(secretoServidor);
}
/** Token público de una cita o turno de fila: no se guarda, se recalcula. */
function firmar(id) { return crypto.createHmac("sha256", secretoServidor).update(String(id)).digest("base64url").slice(0, 22); }

function uno(sql, ...p) { return db.prepare(sql).get(...p) || null; }
function todos(sql, ...p) { return db.prepare(sql).all(...p); }
function ejecutar(sql, ...p) { return db.prepare(sql).run(...p); }

/** Corre fn dentro de una transacción SQLite (todo o nada). */
function enTransaccion(fn) {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (err) { try { db.exec("ROLLBACK"); } catch (e) { /* ya cerrada */ } throw err; }
}

/** Marca una tarea como hecha. Devuelve true solo la primera vez (sirve para no repetir envíos). */
function tareaNueva(clave, barberiaId) {
  const r = ejecutar("INSERT OR IGNORE INTO tareas (clave, barberia_id, ejecutada) VALUES (?, ?, ?)", clave, barberiaId, new Date().toISOString());
  return r.changes > 0;
}

module.exports = { db, uno, todos, ejecutar, enTransaccion, tareaNueva, firmar };
