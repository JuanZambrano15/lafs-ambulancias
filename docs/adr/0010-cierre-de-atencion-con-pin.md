# ADR-0010: Cierre de atención con PIN (validación offline + revalidación en servidor)
 
- **Fecha:** 2026-10-07
- **Estado:** Aceptada
 
## Contexto
 
El ADR-0002 ya definió que una atención (`Atencion.estado`) pasa de
`abierto` a `cerrado` por una acción explícita del auxiliar/médico, y
que a partir de ahí cualquier edición del formato necesita permiso del
administrador (issue #14, todavía no implementado). Lo que faltaba era
la mecánica de esa acción: el issue #12 pide que se autorice con el
PIN de firma (`Usuario.pin_hash`, ya existente desde el issue #3/#4 —
`PUT /auth/pin`, nunca usado hasta ahora), y que la validación ocurra
"en el dispositivo" y se "revalide en el servidor al sincronizar" —
el mismo dispositivo donde corre la app puede estar sin señal en el
momento exacto en que el auxiliar quiere cerrar (típicamente al volver
al garaje, puede que todavía en movimiento).
 
## Decisión
 
### Backend: un endpoint, sin tabla ni columna nueva
 
`PUT /atenciones/{atencion_id}/cerrar`, body `{"pin": "1234"}` (mismo
esquema `PinRequest` de `/auth/pin`). Mismo criterio de permiso que ya
rige para editar el contenido clínico (`require_personal_clinico`:
auxiliar o médico, no se exige que sea el mismo `responsable_id` que
creó la atención — un turno puede tener un solo auxiliar y un solo
médico cubriendo varias atenciones, no tiene sentido amarrar el cierre
a quién la creó).
 
No hace falta migración: `Atencion.estado`/`cerrada_en` ya existen
desde el modelo base (issue #2), pensados exactamente para esto.
 
El PIN SIEMPRE se revalida contra `usuario.pin_hash` (Argon2id) en la
base de datos — nunca se confía en que el dispositivo ya lo validó.
 
### Frontend: hash local liviano para la validación offline
 
Al dispositivo le falta una forma de confirmar el PIN sin red. Guardar
el PIN en texto plano en el dispositivo sería peor que no validar
nada; pedirle a Argon2id que corra en el navegador es pesado y no
aporta nada (la autorización real ya la hace el servidor). La solución:
 
- Cada vez que el usuario define/cambia su PIN (`PUT /auth/pin`
  exitoso), el frontend guarda también un hash SHA-256 (Web Crypto,
  sin librería) del PIN en `@capacitor/preferences`, bajo una clave
  propia (`lib/pinLocal.ts`).
- Al intentar cerrar una atención, si existe ese hash local, se
  compara ahí mismo — "PIN incorrecto" instantáneo, sin red.
- Si no hay hash local (primera vez que este dispositivo ve a este
  usuario cerrar algo, o se borró al cerrar sesión), se omite el
  chequeo local y se deja la validación real al servidor — no bloquea
  al usuario por un caso que no es culpa suya.
- La revalidación en el servidor es la única que cuenta: si alguien
  cambió su PIN desde otro dispositivo, o el hash local quedó
  desincronizado por cualquier razón, el servidor la rechaza (401) y
  el cierre se deja pendiente para reintentar con el PIN correcto (ver
  abajo).
 
Este hash local es una conveniencia de UX, no un mecanismo de
seguridad — así queda documentado en el código para que no se
confunda con la autorización real.
 
### Cierre sin conexión: se encola igual que el resto del traslado (ADR-0008)
 
Dos casos:
 
1. **La atención todavía es local** (`local-<uuid>`, ni siquiera se
   ha sincronizado la creación): el PIN ingresado se guarda como parte
   del mismo `TrasladoPendiente` (`cierre: { pin }`), y se envía
   después de encabezado y clínico cuando por fin se sincroniza todo
   (mismo orden que ya sigue `sincronizarUno`).
2. **La atención ya existe en el servidor** pero el dispositivo está
   sin señal justo al cerrar: se guarda en una cola nueva,
   `cierres_pendientes` (otro almacén de IndexedDB, mismo
   `offlineStore.ts`), con `{ atencionId, pin }`. Se reintenta junto
   con el resto al recuperar señal.
 
El PIN viaja y se guarda en texto plano mientras está en la cola local
— mismo nivel de protección que ya tiene el resto de los datos
guardados sin conexión (nombre del paciente, notas clínicas, etc., ver
ADR-0008): es la superficie de riesgo que ya se aceptó para todo el
flujo offline, no una excepción nueva solo para el PIN. Se borra de la
cola en cuanto el cierre se confirma contra el servidor.
 
Si el servidor rechaza el cierre al sincronizar (401 PIN incorrecto,
409 ya cerrada, etc.), el error queda anotado en la fila pendiente —
igual que ya pasa con el resto de la sincronización — y el usuario
puede reintentar con el PIN correcto desde el aviso de pendientes.
 
### Flujo obligatorio de "configura tu PIN"
 
El backend ya traía `pin_configurado` en `TokenResponse`/`MeResponse`
desde el issue #4, pero el frontend nunca construyó la pantalla que lo
usa. Este issue la agrega: `ProtectedRoute` redirige a
`/configurar-pin` si `!pin_configurado`, mismo patrón que ya existe
para `debe_cambiar_password` (y en el mismo orden: contraseña primero,
luego PIN, para no encimar dos formularios obligatorios a la vez).
 
## Alternativas consideradas
 
- **No guardar ningún hash local, solo validar formato (4 dígitos) en
  el dispositivo** — descartado por ser la opción explícita que no se
  eligió: el issue pide que haya una validación real en el
  dispositivo, no solo un chequeo de formato.
- **Exigir que solo el `responsable_id` de la atención pueda
  cerrarla** — descartado por ahora: no hay ningún otro endpoint de
  este formato que distinga "el responsable" de "cualquier
  auxiliar/médico de turno", y cambiar ese criterio solo para el
  cierre sería inconsistente con cómo ya funciona la edición del
  contenido clínico.
- **Guardar el PIN hasheado con Argon2id también en el dispositivo**
  — descartado: Argon2id en el navegador/WebView es lento a propósito
  (ese es el punto del algoritmo) y aquí solo hace falta feedback
  rápido, no resistencia a fuerza bruta local — la resistencia real ya
  la da el servidor.
 
## Consecuencias
 
- Cerrar una atención ya bloquea automáticamente la edición del
  encabezado y la parte clínica (ambos endpoints ya exigían `estado ==
  abierto`) — sin trabajo adicional.
- Queda pendiente el issue #14 (edición post-cierre con permiso de
  administrador + historial de versiones) para cuando alguien necesite
  corregir algo después de cerrado.
- El hash local SHA-256 vive en el mismo dispositivo y se borra al
  cerrar sesión (`cerrarSesion`) — un usuario que cierra sesión y
  vuelve a entrar en otro dispositivo no tiene ese atajo ahí todavía,
  pero el cierre sigue funcionando (sin el chequeo instantáneo offline,
  la revalidación en el servidor sigue siendo la que manda).
