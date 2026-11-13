// Configuración del servidor. Lee el archivo .env (sin dependencias) y deja valores por defecto
// para que todo funcione en local con los simuladores de WhatsApp y pagos.
"use strict";
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "..");

(function cargarEnv() {
  const archivo = path.join(RAIZ, ".env");
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let valor = m[2];
    if (/^(['"]).*\1$/.test(valor)) valor = valor.slice(1, -1);
    else valor = valor.replace(/\s+#.*$/, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = valor;
  }
})();

const e = process.env;
const puerto = Number(e.PUERTO || e.PORT || 8765);

module.exports = {
  RAIZ,
  puerto,
  urlPublica: (e.URL_PUBLICA || `http://localhost:${puerto}`).replace(/\/+$/, ""),
  zona: e.ZONA_HORARIA || "America/Bogota",
  archivoDB: path.resolve(RAIZ, e.ARCHIVO_DB || "datos/barbersaas.db"),
  produccion: e.NODE_ENV === "production",
  registroAbierto: (e.REGISTRO_ABIERTO || "si") !== "no",
  barberiaPrincipal: e.BARBERIA_PRINCIPAL || "", // slug que recibe el WhatsApp si el número no está asignado

  whatsapp: {
    proveedor: e.WHATSAPP_PROVEEDOR || (e.WHATSAPP_TOKEN ? "meta" : "simulador"),
    token: e.WHATSAPP_TOKEN || "",
    phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID || "",
    wabaId: e.WHATSAPP_WABA_ID || "",
    appSecret: e.WHATSAPP_APP_SECRET || "",
    verifyToken: e.WHATSAPP_VERIFY_TOKEN || "",
    version: e.WHATSAPP_API_VERSION || "v26.0",
    idioma: e.WHATSAPP_IDIOMA || "es",
  },

  pagos: {
    proveedor: e.PAGOS_PROVEEDOR || (e.WOMPI_LLAVE_PRIVADA ? "wompi" : "simulador"),
    wompiLlavePrivada: e.WOMPI_LLAVE_PRIVADA || "",
    wompiSecretoEventos: e.WOMPI_SECRETO_EVENTOS || "",
  },
};
