# Barber SaaS: guía para ponerlo a funcionar de verdad

Esta guía explica cómo correr Barber SaaS en tu computador, cómo conectar WhatsApp y los pagos, y cómo publicarlo para que lo usen barberías reales.

---

## 1. Qué hay en el proyecto

| Carpeta / archivo | Qué es |
|---|---|
| `index.html` | La página de ventas de Barber SaaS. |
| `app/` | La plataforma: el panel de la barbería (`app/`) y la entrada/registro (`app/entrar.html`). |
| `reserva/` | La página pública donde los clientes reservan y hacen la fila virtual. |
| `pago-simulado/` | Pasarela de mentiras para probar anticipos sin plata real. |
| `assets/` | Estilos, scripts e imágenes. `store.js`, `engine.js` y `asistente-core.js` corren igual en el navegador y en el servidor. |
| `server/` | El servidor: cuentas, base de datos, automatizaciones, WhatsApp, pagos y webhooks. |
| `datos/` | La base de datos (SQLite). **Nunca se publica ni se sube a Git.** |
| `.env.example` | Plantilla de la configuración. Se copia como `.env`. |

Sin servidor, las páginas funcionan como **demo**: lo que se crea queda guardado en el navegador, y con `?demo=1` se ve una barbería de ejemplo llena de datos. Con el servidor andando, funcionan **de verdad**: cuentas, base de datos, sincronización en vivo entre dispositivos y automatizaciones que corren aunque el panel esté cerrado.

---

## 2. Probarlo en tu computador

1. Instala **Node.js 22.13 o más nuevo** desde [nodejs.org](https://nodejs.org). Para ver la versión: `node -v`.
2. Desde la carpeta del proyecto, ejecuta:
   ```bash
   npm start
   ```
3. Abre <http://localhost:8765/app/entrar.html> y crea una cuenta. Enseguida sale el **registro paso a paso**: ubicación, horario, servicios con precios y equipo. Al final aparece el link de reservas con el mensaje listo para mandarles a los clientes, y el panel abre **vacío**, en la agenda.

Sin configurar nada, WhatsApp y pagos funcionan en **modo simulador**:

- Los mensajes de WhatsApp aparecen en la actividad del panel y en la consola del servidor. No le llegan a ningún celular.
- Los anticipos abren la pasarela de prueba (`/pago-simulado/`), donde se aprueba o se rechaza el pago.
- Para ver la plataforma llena de datos sin crear nada, abre `/app/?demo=1` (barbería de ejemplo, aparte de la tuya).

**Para arrancar de cero:** detén el servidor y borra la carpeta `datos/`. Ahí quedaron las barberías de prueba que creé mientras probaba.

### Direcciones útiles

| Qué | Dirección |
|---|---|
| Panel | `/app/` |
| Entrar / crear cuenta | `/app/entrar.html` |
| Reservas de una barbería | `/reserva/?b=<slug>` (el link exacto está en Ajustes) |
| Fila virtual (el QR de la puerta) | `/reserva/?b=<slug>&modo=fila` |
| Aviso de WhatsApp (para Meta) | `/webhooks/whatsapp` |
| Aviso de pagos (para Wompi) | `/webhooks/wompi/<id-de-la-barbería>` (aparece en Ajustes → Conexiones) |
| Estado del servidor | `/api/salud` |

---

## 3. Lo que necesitas para producción

- [ ] Un **servidor con Node 22.13+** que quede prendido siempre, con **disco que no se borre** y **HTTPS**. Ver la sección 4.
- [ ] Un **dominio**, por ejemplo `app.barbersaas.co`.
- [ ] Una **cuenta de Meta Business** con la app de WhatsApp y un número para el asistente. Ver la sección 5.
- [ ] **Wompi**: cada barbería con su cuenta, para que el anticipo le llegue directo a ella. Ver la sección 6.
- [ ] **Política de tratamiento de datos** publicada. Ver la sección 7.

> **Hostinger compartido no sirve para la plataforma.** El hosting compartido no mantiene un programa de Node prendido con su base de datos. Sí sirve para la página de ventas y la demo; el `.htaccess` ya bloquea `server/`, `datos/`, `.env` y estas guías. Para la plataforma real usa un VPS (Hostinger también los vende) o un servicio como Railway, Render o Fly.io con disco persistente.

---

## 4. Publicarlo

### Opción A: VPS con Ubuntu (recomendada)

1. **Instala Node 22** (o más nuevo) y [Caddy](https://caddyserver.com/docs/install), que pone el HTTPS solo.
2. **Copia el proyecto** a `/opt/barbersaas`. No hace falta copiar `datos/`.
3. **Crea el `.env`** a partir de `.env.example`. Para producción, como mínimo:
   ```ini
   NODE_ENV=production
   PUERTO=8765
   URL_PUBLICA=https://app.tudominio.co
   ZONA_HORARIA=America/Bogota
   ARCHIVO_DB=./datos/barbersaas.db
   REGISTRO_ABIERTO=si
   ```
   Protégelo con `chmod 600 .env`.
4. **Déjalo como servicio** para que arranque solo y se reinicie si se cae. Crea `/etc/systemd/system/barbersaas.service`:
   ```ini
   [Unit]
   Description=Barber SaaS
   After=network.target

   [Service]
   WorkingDirectory=/opt/barbersaas
   ExecStart=/usr/bin/node server/index.js
   Restart=always
   User=barbersaas

   [Install]
   WantedBy=multi-user.target
   ```
   Luego actívalo:
   ```bash
   sudo systemctl enable --now barbersaas
   ```
5. **Configura el HTTPS con Caddy.** En `/etc/caddy/Caddyfile`:
   ```
   app.tudominio.co {
     reverse_proxy localhost:8765
   }
   ```
   Luego aplica el cambio:
   ```bash
   sudo systemctl reload caddy
   ```
6. **Programa las copias de seguridad diarias** con `crontab -e`:
   ```
   0 3 * * * cd /opt/barbersaas && /usr/bin/node server/respaldo.js
   ```
   Guardan los últimos 14 días en `datos/respaldos/`. **Copia esa carpeta también fuera del servidor** (otro disco, Drive, etc.).

### Opción B: Railway, Render o Fly.io

- Crea un **volumen/disco persistente** montado, por ejemplo, en `/data`, y pon `ARCHIVO_DB=/data/barbersaas.db`. **Sin volumen, la base de datos se borra en cada despliegue.**
- Comando de arranque: `npm start`. El servidor también lee la variable `PORT` que ponen estas plataformas.
- Pon las demás variables del `.env` en el panel de la plataforma.

### Después de publicar

- Abre `https://app.tudominio.co/api/salud`: debe responder `"barbersaas": true`.
- Si la página de ventas la sirve el mismo servidor, no hay que cambiar nada: «Probar gratis» lleva al registro y «Entrar» al inicio de sesión.
- Si la página de ventas vive en otro dominio (por ejemplo en Hostinger), cambia en `index.html` los enlaces `app/index.html?nuevo=1…` por `https://app.tudominio.co/app/index.html?nuevo=1…`, y `app/index.html` por `https://app.tudominio.co/app/`.

---

## 5. Conectar WhatsApp (API oficial de Meta)

Barber SaaS usa la **WhatsApp Cloud API** de Meta. No usa WhatsApp Web ni trucos que hacen bloquear el número.

1. **Portafolio comercial.** En [business.facebook.com](https://business.facebook.com) crea o usa el portafolio del negocio. Haz la **verificación del negocio**: la necesitas para pasar los límites iniciales de mensajes.
2. **App.** En [developers.facebook.com](https://developers.facebook.com) → *Crear app* → tipo *Empresa* → agrega el producto **WhatsApp**.
3. **Número.** En *WhatsApp → Configuración de la API*, agrega el número del asistente. Lo más simple es un número dedicado. De esa pantalla copia:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **WhatsApp Business Account ID** → `WHATSAPP_WABA_ID`
4. **Token permanente.** No uses el token temporal de 24 h.
   1. Ve a *Configuración del negocio → Usuarios del sistema* y crea un usuario administrador.
   2. Asígnale la app y la cuenta de WhatsApp.
   3. Genera un token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
   4. Ponlo en `WHATSAPP_TOKEN`.
5. **Secreto de la app.** Está en *Configuración de la app → Básica → Clave secreta* y va en `WHATSAPP_APP_SECRET`. Con él, el servidor rechaza avisos falsos. **En producción es obligatorio:** sin él, el servidor no acepta avisos.
6. **Token de verificación.** Inventa una palabra larga y ponla en `WHATSAPP_VERIFY_TOKEN`.
7. **Reinicia el servidor.** Al arrancar debe decir `WhatsApp: API de Meta`.
8. **Webhook.** En *WhatsApp → Configuración*:
   1. URL de devolución de llamada: `https://app.tudominio.co/webhooks/whatsapp`
   2. Token de verificación: la palabra del paso 6.
   3. Dale *Verificar y guardar*.
   4. En *Campos del webhook*, suscríbete a **`messages`**.
9. **Plantillas.** Para escribirle a un cliente que no te ha escrito en las últimas 24 h, Meta exige plantillas aprobadas. Ya están escritas: 14 plantillas `bs_*`.
   - Para verlas:
     ```bash
     npm run plantillas
     ```
   - Para registrarlas en tu cuenta:
     ```bash
     npm run plantillas:crear
     ```
   - La aprobación tarda de minutos a un día. Revisa el estado en *WhatsApp Manager → Plantillas*.
   - Las promociones llevan el pie «Escribí BAJA si no querés más promociones».
10. **Asignar el número a la barbería.** En el panel, ve a *Ajustes → Conexiones* → **ID del número de WhatsApp Business**.
    - Si hay **una sola barbería**, puedes dejarlo vacío.
    - Si hay **varias**, cada una necesita su propio número, dentro de una cuenta a la que tenga acceso el token del servidor. Un mensaje que llegue a un número sin asignar no se le entrega a nadie, para no mezclar clientes. Si quieres que esos mensajes los reciba una barbería fija, ponla en `BARBERIA_PRINCIPAL`.
11. **Prueba real.** Desde tu celular, escribe al número: *«Hola, quiero un corte mañana en la tarde»*. El asistente debe ofrecerte horarios y agendarte.

### Cuánto cuesta WhatsApp

Meta cobra **por plantilla entregada**, según la categoría. Revisa la [tabla de precios de Meta para Colombia](https://developers.facebook.com/docs/whatsapp/pricing) antes de fijar el precio del plan.

- **Responder cuando el cliente escribe no se cobra.** Las plantillas de **utilidad** también son gratis si el cliente escribió en las últimas 24 h.
- **Plantillas de utilidad** (más baratas): confirmación, link de pago, anticipo recibido, recordatorio, «no llegaste», turno de la fila, liquidación y cierre de caja.
- **Plantillas de marketing** (las más caras): ciclo de corte, turno liberado, huecos libres, reseña, cumpleaños y clientes dormidos.

---

## 6. Conectar los pagos de anticipos (Wompi)

La plata del anticipo **le llega directo a la barbería**; Barber SaaS nunca la toca. Por eso cada barbería conecta **su propia** cuenta de Wompi.

1. La barbería crea su cuenta en [comercios.wompi.co](https://comercios.wompi.co), con su cédula o NIT y su cuenta bancaria.
2. En Wompi, en *Desarrolladores*, copia de **Sandbox** (pruebas):
   - la **llave privada** (`prv_test_…`)
   - el **secreto de eventos** (`test_events_…`)
3. En Barber SaaS, ve a *Ajustes → Conexiones*, pega las dos llaves y dale **Guardar conexiones**. Debe decir *Wompi · sandbox*. Las llaves se guardan solo en el servidor y nunca vuelven al navegador.
4. Copia la **«URL de eventos para pegar en Wompi»** que aparece ahí. En Wompi, pégala en *Desarrolladores → URL de eventos* del ambiente Sandbox.
5. **Prueba completa.**
   1. Activa el anticipo en Ajustes.
   2. Haz una reserva en la página pública.
   3. Paga en el checkout de Wompi con los [datos de prueba de Wompi](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/).
   4. La reserva debe pasar sola a *confirmada* y al cliente le llega «anticipo recibido».
6. **Paso a producción.** Repite los pasos 2 a 4 con las llaves de **Producción** (`prv_prod_…` y `prod_events_…`) y la URL de eventos del ambiente de Producción.

**Detalles útiles:**

- Si Wompi no responde al crear el link, la reserva igual queda apartada. El WhatsApp con el link se reintenta solo (al minuto y a los 5 minutos); nunca sale un mensaje con el link vacío.
- Un aviso de pago repetido no se procesa dos veces.
- Los medios de pago que ve el cliente (Nequi, PSE, tarjeta, Bre-B…) los define el checkout de Wompi según lo que tenga habilitado esa cuenta.

---

## 7. Datos personales (Ley 1581 de 2012)

**Lo que ya hace la plataforma:**

- **Autorización registrada.** Se pide al crear la cuenta, al reservar y al entrar a la fila. Cuando el cliente escribe primero por WhatsApp, queda registrado que él inició la conversación.
- **Baja de promociones.** Si el cliente escribe **«BAJA»** (o algo como «no quiero más mensajes»), deja de recibir promociones. Las confirmaciones y recordatorios de sus citas sí le siguen llegando.
  - Si escribe «quiero promociones», vuelve a recibirlas.
  - El dueño también puede cambiarlo en la ficha del cliente.
- **Datos de ejemplo protegidos.** Esos clientes nunca reciben mensajes.

**Lo que falta, y conviene hacerlo con un abogado:**

- **Publicar la política de tratamiento de datos** y enlazarla en el registro, las reservas y la fila. En este modelo, normalmente cada barbería es la **responsable** de los datos de sus clientes y Barber SaaS es la **encargada**.
- **Contrato con cada barbería** (términos del servicio y transmisión de datos).
- **Registro Nacional de Bases de Datos (SIC):** revisa si te aplica según el tamaño de la empresa.

Para cerrar el registro abierto mientras pruebas con pocas barberías, usa `REGISTRO_ABIERTO=no`.

---

## 8. Seguridad: lista antes de abrir al público

- [ ] `NODE_ENV=production` y `URL_PUBLICA` con `https://`. Así las cookies de sesión salen marcadas como seguras.
- [ ] `WHATSAPP_APP_SECRET` configurado.
- [ ] Secreto de eventos de Wompi configurado en cada barbería.
- [ ] `.env` con permisos `600` y fuera de Git. El `.gitignore` ya excluye `.env` y `datos/`.
- [ ] Respaldos diarios funcionando **y copiados fuera del servidor**.
- [ ] El servidor solo es accesible a través de Caddy (HTTPS). No abras el puerto 8765 al público.

---

## 9. Lo que falta para venderlo

1. **Validar con 3 a 5 barberías reales:** el precio del plan y el tono del asistente (hoy habla paisa, con voseo: «agendame», «querés»).
2. **Registro insertado de Meta (Embedded Signup)**, para que cada barbería conecte su número de WhatsApp sola desde el panel. Hoy se hace a mano con el token del servidor.
3. **Usuarios para los barberos.** Hoy hay un solo login por barbería: el del dueño.
4. **Recuperar contraseña por correo.** Requiere un servicio de envío de correos.
5. **Cobro de la suscripción de Barber SaaS**, por ejemplo con cobros recurrentes de Wompi.
6. **Política de datos y términos publicados** (sección 7).
7. **Opcional: asistente con IA**, para entender mensajes más libres. Hoy entiende con reglas y cubre agendar, cambiar, cancelar, precios, dirección, horario y fila.
8. **Monitoreo**, con una alerta si el servidor se cae o si la cola de WhatsApp acumula errores.
