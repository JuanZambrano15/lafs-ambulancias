# ADR-0015: Varios servicios activos a la vez y recordatorio en la tablet

- **Fecha:** 2026-11-10
- **Estado:** Aceptada (reemplaza la regla de "disponibilidad" del ADR-0005)

## Contexto

Al cierre de la primera fase, la gerencia pidió correcciones sobre lo
que ya funcionaba. Dos de ellas cambian reglas de fondo:

1. En un accidente múltiple, un mismo auxiliar o conductor (y la misma
   ambulancia) puede atender más de un servicio a la vez. El ADR-0005
   decía lo contrario: una ambulancia o un conductor con una atención
   `abierta` no podía volver a elegirse hasta cerrarla ("flota
   rotativa"), y el backend lo imponía con un 409 al crear y con un
   filtro en las listas de disponibles.
2. Mientras un servicio siga abierto, la tablet debe recordarlo con una
   notificación en la barra, cada 30 minutos o cada hora, que no se
   quite hasta cerrar el servicio.

## Decisión

- **Se quita la exclusividad** de ambulancia y conductor:
  `POST /atenciones` ya no responde 409 por "ya tiene una atención
  abierta", y `GET /atenciones/ambulancias-disponibles` y
  `GET /atenciones/conductores-disponibles` ya no descartan a quien
  está en servicio (siguen descartando inactivos, y la lista de
  conductores sigue sin ofrecer a quien inicia la atención, issue #62).
  Nunca hubo restricción en la base de datos (solo en el código), así
  que no hay migración para esto.
- **Home ya listaba una tarjeta por servicio en curso** y siempre ofrece
  "Iniciar atención"; guardar o cerrar vuelve a Home, desde donde se
  puede abrir otro servicio. No hizo falta cambiar el flujo, solo
  cubrirlo con una prueba.
- **Recordatorio:** módulo `app/src/lib/recordatorioServicio.ts` con
  `@capacitor/local-notifications`. Home lo sincroniza cada vez que
  carga los servicios en curso: si hay alguno, programa una
  notificación persistente (`ongoing`, no se descarta deslizando) que
  se repite cada `INTERVALO_MINUTOS` (30; poner 60 para cada hora); si
  no queda ninguno, la cancela. Es una sola notificación por tablet, y
  su texto dice cuántos servicios hay abiertos. Al ser alarmas del
  sistema, sigue apareciendo con la app en segundo plano o cerrada.
  Android 13+ pide el permiso de notificaciones la primera vez; si se
  niega, la app funciona igual, sin recordatorio. El plugin ya declara
  `POST_NOTIFICATIONS` en su manifest, que se fusiona con el de la app.

## Alternativas consideradas

- Mantener la regla y pedir que se cierre un servicio antes de abrir
  otro — no sirve para el accidente múltiple, que es justo el caso.
- Dejar el límite pero configurable — complejidad sin un caso real que
  lo pida; si más adelante hace falta limitar, se puede reintroducir
  como regla explícita.
- Notificación push desde el servidor — requiere Firebase y conexión;
  el recordatorio local funciona sin red y sin infraestructura nueva.
- Una notificación por servicio — varios avisos idénticos para la
  misma persona; una sola con el conteo es menos ruido.

## Consecuencias

- Una ambulancia puede aparecer en varias atenciones abiertas a la vez;
  el panel y los reportes no deben asumir lo contrario.
- La protección contra dos personas eligiendo el mismo móvil
  "casi al mismo tiempo" deja de existir; ya no es un error.
- El recordatorio se actualiza al abrir Home: si un servicio se cierra
  desde otro lugar (por ejemplo el panel), el aviso de la tablet se
  quita la próxima vez que se abra la app. El conductor no tiene
  servicios "en curso" en su pantalla (solo el responsable), así que el
  recordatorio llega a quien inició el servicio.
- Android puede retrasar un poco las alarmas repetidas para ahorrar
  batería; la repetición es aproximada, no exacta al minuto.
