# Barber SaaS

Plataforma de automatización para barberías de Medellín: la agenda se llena sola, el asistente de WhatsApp agenda y cobra el anticipo, y los que llegan sin cita esperan desde la casa con la fila virtual.

**Demo en línea:** https://bayronlondonoc.github.io/barber-saas/ (con datos de ejemplo, sin servidor)

## Qué hace

- **Asistente de WhatsApp.** Agenda, cambia y cancela turnos, responde precios, dirección y horario, y manda el link del anticipo.
- **Fila virtual con QR.** El cliente se anota desde la puerta o desde la casa, y le avisamos por WhatsApp cuando se acerca su turno.
- **Ciclo de corte.** Aprende cada cuánto se motila cada cliente y le escribe cuando le toca.
- **Anti-plantón.** Pide anticipo para separar el turno y lo retiene si el cliente no llega.
- **Lista de espera relámpago.** Si alguien cancela, el turno se ofrece de inmediato.
- **Huecos libres, cumpleaños y clientes dormidos.** Mensajes que traen de vuelta a los clientes.
- **Caja y liquidación de barberos.** Cada peso queda unido a su cita, y cada automatización muestra cuánta plata recuperó.
- **El cliente maneja su cita.** Desde su link cambia la hora, cancela (hasta 2 horas antes), califica su corte y repite "lo de siempre" con un toque.
- **Mi silla.** Vista simple para cada barbero: quién está en la silla, quién sigue, botones grandes y cuánto lleva ganado en el día.
- **Explorar.** Buscador de barberías con turnos en vivo, precios y calificaciones de clientes reales: el cliente toca la hora y reserva (motor de reservas).

## Cómo está hecho

- **Front-end:** HTML, CSS y JavaScript sin frameworks ni paso de compilación.
- **Servidor:** Node.js 22.13+ sin dependencias, con SQLite (`node:sqlite`).
- **WhatsApp:** WhatsApp Cloud API de Meta.
- **Pagos:** Wompi (Nequi, PSE, tarjeta…).
- **Simuladores:** WhatsApp y pagos tienen simulador, así que todo se puede probar sin cuentas.

Sin servidor, el sitio funciona como **demo**: los datos se guardan en el navegador. Con el servidor, funciona **de verdad**: cuentas, base de datos, sincronización en vivo y automatizaciones que corren aunque el panel esté cerrado.

## Correrlo

```bash
npm start
```

Después abre http://localhost:8765/app/entrar.html y crea una cuenta.

Para conectar WhatsApp y Wompi y publicarlo en un servidor, sigue la [guía de producción](GUIA-PRODUCCION.md).
