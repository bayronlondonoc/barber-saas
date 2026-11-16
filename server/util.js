// Utilidades HTTP sin dependencias: cuerpo JSON, cookies, respuestas, archivos estáticos y límites.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

function id(prefijo) { return (prefijo || "id") + "_" + crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x") + Date.now().toString(36).slice(-4); }
function token(bytes) { return crypto.randomBytes(bytes || 24).toString("base64url"); }
function sha256(txt) { return crypto.createHash("sha256").update(txt).digest("hex"); }
function iguales(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Teléfono colombiano a 10 dígitos (3001234567). Acepta +57, espacios, etc. */
function normTel(t) {
  let d = String(t || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
  return d;
}
/** Formato que pide WhatsApp: 573001234567 */
function telWA(t) { const d = normTel(t); return d.length === 10 ? "57" + d : d; }
function telValido(t) { return /^3\d{9}$/.test(normTel(t)); }

class ErrorHTTP extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

function leerCuerpo(req, limite) {
  limite = limite || 2 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const partes = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > limite) { reject(new ErrorHTTP(413, "La solicitud es demasiado grande.")); req.destroy(); return; }
      partes.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(partes)));
    req.on("error", reject);
  });
}
async function leerJSON(req) {
  const crudo = await leerCuerpo(req);
  if (!crudo.length) return {};
  try { return JSON.parse(crudo.toString("utf8")); } catch (e) { throw new ErrorHTTP(400, "JSON inválido."); }
}

function cookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function ponerCookie(res, nombre, valor, maxAgeSeg) {
  const seguro = config.urlPublica.startsWith("https://") ? "; Secure" : "";
  const partes = `${nombre}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeg}${seguro}`;
  const previas = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", previas ? [].concat(previas, partes) : partes);
}

const CABECERAS_SEGURAS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};
function json(res, estado, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, CABECERAS_SEGURAS));
  res.end(cuerpo);
}

/** Límite simple por IP en memoria (suficiente para un servidor). */
const cubetas = new Map();
function limitar(req, clave, maximo, ventanaMs) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const k = clave + "|" + ip, ahora = Date.now();
  let c = cubetas.get(k);
  if (!c || c.reinicia < ahora) { c = { n: 0, reinicia: ahora + ventanaMs }; cubetas.set(k, c); }
  c.n++;
  if (c.n > maximo) throw new ErrorHTTP(429, "Demasiados intentos. Esperá un momento y volvé a probar.");
}
setInterval(() => { const a = Date.now(); for (const [k, c] of cubetas) if (c.reinicia < a) cubetas.delete(k); }, 60000).unref();

/** Las peticiones que cambian datos con cookie deben venir de nuestra propia página (anti-CSRF). */
function mismoOrigen(req) {
  const origen = req.headers.origin;
  if (!origen) return true;
  try { return new URL(origen).host === req.headers.host; } catch (e) { return false; }
}

/* ---------------- Archivos estáticos ---------------- */
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png",
  ".jpg": "image/jpeg", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2",
};
// Solo se publica el sitio: nunca el código del servidor, la base de datos ni el .env
const PUBLICOS = new Set(["", "index.html", "robots.txt", "app", "reserva", "explorar", "assets", "pago-simulado"]);

function servirEstatico(req, res, rutaUrl) {
  let ruta = decodeURIComponent(rutaUrl);
  const primera = ruta.replace(/^\/+/, "").split("/")[0];
  if (!PUBLICOS.has(primera)) return false;
  let archivo = path.normalize(path.join(config.RAIZ, ruta));
  if (!archivo.startsWith(config.RAIZ)) return false;
  try {
    let st = fs.statSync(archivo);
    if (st.isDirectory()) {
      if (!ruta.endsWith("/")) { res.writeHead(301, { Location: ruta + "/" }); res.end(); return true; }
      archivo = path.join(archivo, "index.html");
      st = fs.statSync(archivo);
    }
    const ext = path.extname(archivo).toLowerCase();
    const largo = /\.(webp|png|jpg|svg|ico|woff2)$/.test(ext);
    res.writeHead(200, Object.assign({
      "Content-Type": TIPOS[ext] || "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": largo ? "public, max-age=2592000" : "no-cache",
    }, CABECERAS_SEGURAS, ext === ".html" && (primera === "reserva" || primera === "pago-simulado" || primera === "") ? { "X-Frame-Options": "SAMEORIGIN" } : {}));
    if (req.method === "HEAD") { res.end(); return true; }
    fs.createReadStream(archivo).pipe(res);
    return true;
  } catch (e) { return false; }
}

module.exports = {
  id, token, sha256, iguales, normTel, telWA, telValido, ErrorHTTP, leerCuerpo, leerJSON,
  cookies, ponerCookie, json, limitar, mismoOrigen, servirEstatico,
};
