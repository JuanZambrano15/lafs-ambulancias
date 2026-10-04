# ADR-0005: Crear atención y elegir móvil
 
- **Fecha:** 2026-10-03
- **Estado:** Aceptada
 
## Contexto
 
El issue #7 pide el flujo para iniciar una atención nueva y elegir el
móvil, "ya que la flota es rotativa". El modelo `Atencion` (del scaffold
inicial) ya tiene las columnas necesarias (`ambulancia_id`,
`conductor_id`, `responsable_id`, `tipo`, `estado`, `abierta_en`,
`cerrada_en`), pero nada definía todavía:
 
1. Quién es el `conductor_id` y quién el `responsable_id` al crear el
   registro — son dos empleados distintos.
2. Si el `tipo` (traslado / atención SOAT) se elige al crear la
   atención o se pospone.
3. Qué roles pueden iniciar una atención.
4. Cómo evitar que la misma ambulancia (o el mismo conductor) quede
   "en dos atenciones abiertas a la vez" — el punto central de que la
   flota sea rotativa.
 
## Decisión
 
**Responsable y conductor:** el responsable (quien llena y cierra el
formato) es siempre el empleado ligado al usuario logueado
(`usuario.empleado_id`) — nunca un dato que mande el cliente. El
conductor se elige de una lista de empleados activos con rol
"conductor" (`GET /atenciones/conductores-disponibles`).
 
**Tipo de atención:** se elige en el mismo paso de creación
(`POST /atenciones`), porque el campo es obligatorio en la base de
datos — no se puede crear el registro sin él. El contenido clínico del
formato en sí (traslado o SOAT) se llena después, en los issues
#8/#9 y #17.
 
**Quién puede crear una atención:** auxiliar de enfermería, médico y
conductor (`require_personal_operativo` en `app/api/deps.py`). El
administrador queda afuera a propósito: programar atenciones con
anticipación (idea que salió en la conversación) es una funcionalidad
distinta — un formato que alguien más llena en el momento, no un
registro que el admin abre de antemano — y se deja para un issue aparte
si el cliente lo pide.
 
**Disponibilidad (el porqué de "rotativa"):** una ambulancia o un
conductor con una atención ya `abierta` no puede volver a elegirse
hasta que esa atención se cierre (issue #12). Esto se aplica en dos
capas:
- `GET /atenciones/ambulancias-disponibles` y
  `GET /atenciones/conductores-disponibles` ya filtran lo ocupado, para
  que la app ni siquiera se lo muestre al usuario como opción.
- `POST /atenciones` revalida lo mismo al crear (409 si la ambulancia o
  el conductor elegido ya está en una atención abierta) — por si la
  lista que vio el cliente quedó desactualizada entre que la pidió y
  que envió el formulario (dos personas iniciando atenciones casi al
  mismo tiempo).
 
**Validación del conductor elegido:** `POST /atenciones` solo exige que
el `conductor_id` exista y esté activo — no vuelve a exigir que tenga
rol "conductor" en el momento de crear (ese filtro ya ocurre en la
lista de disponibles que ve el usuario). Evita una inconsistencia rara:
si alguien pierde el rol "conductor" justo después de aparecer en la
lista, la creación no le explota por una regla que el usuario nunca
vio en pantalla.
 
## Alternativas consideradas
 
- **El usuario elige tanto conductor como responsable de dos listas** —
  descartado: un paso más en una pantalla que se usa de pie, al lado de
  la ambulancia, con prisa; el responsable casi siempre es quien tiene
  el teléfono/tablet en la mano.
- **Permitir que el administrador también cree atenciones** —
  pospuesto: "programar con anticipación" es un caso de uso real pero
  distinto (atención sin responsable todavía asignado), se evalúa como
  issue propio si hace falta.
- **No validar disponibilidad al crear, solo filtrar en el listado** —
  descartado: sin la revalidación en el `POST`, dos personas podrían
  "ganarle" al listado desactualizado y dejar una ambulancia con dos
  atenciones abiertas a la vez — justo lo que se supone que esto evita.
 
## Consecuencias
 
- `Atencion` ahora tiene relaciones ORM (`ambulancia`, `conductor`,
  `responsable`) que no existían antes — necesarias para que
  `AtencionOut` devuelva los datos anidados sin armar la respuesta a
  mano. No cambia el esquema de la base de datos, solo el mapeo.
- Cerrar una atención (issue #12) es lo que libera de nuevo la
  ambulancia y el conductor para elegirse — hasta entonces, quedan
  "ocupados" aunque en la práctica ya hayan terminado el servicio.
- El filtro de "disponibles" por rol "conductor" depende de que el
  conductor tenga un `Usuario` con ese rol — un conductor sin cuenta en
  el sistema no aparecería en la lista, aunque sí podría crearse una
  atención a mano con su `empleado_id` si alguien ya sabe el id (caso
  de borde aceptado, no bloqueante para este issue).
