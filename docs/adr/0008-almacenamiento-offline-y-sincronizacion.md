# ADR-0008: Almacenamiento local sin conexión y sincronización
 
- **Fecha:** 2026-10-07
- **Estado:** Aceptada
 
## Contexto
 
El issue #10 pide que un traslado se pueda diligenciar aunque la
ambulancia no tenga señal (zonas sin cobertura, trayectos largos), y
que todo quede sincronizado al volver al garaje: "Guardar formatos en
el dispositivo (SQLite o IndexedDB en el WebView de Capacitor)
mientras no hay señal, y sincronizar al conectarse en el garaje. IDs
generados en el dispositivo para evitar duplicados."
 
Se confirmaron tres decisiones con el cliente antes de implementar:
 
1. **Storage: IndexedDB**, no SQLite — ya está disponible en el
   WebView sin plugin nativo ni rebuild de Android.
2. **IDs**: se agrega una columna `client_id` (UUID) aparte en
   `Atencion`, en vez de migrar las llaves primarias existentes a
   UUID — más simple y no toca las foreign keys que ya usan
   `atencion_id` como entero (issues #6-#9).
3. **Alcance**: el traslado completo (crear atención + encabezado +
   parte clínica) debe poder hacerse sin conexión, no solo el
   registro inicial — es lo que pide el milestone ("un traslado real
   de principio a fin").
 
## Decisión
 
**`client_id` (UUID) en `Atencion`, generado en el dispositivo,
único y nullable:** el dispositivo lo genera *siempre* que crea una
atención (en línea o sin conexión, no solo esta última) y lo manda en
`POST /atenciones`. Si el backend ya tiene una atención con ese
`client_id`, el endpoint es idempotente: devuelve la fila existente
(200) en vez de crear una duplicada (409 sería incorrecto — para la
app es un éxito, no un conflicto) — así un reintento de sincronización
(p. ej. la respuesta no llegó al dispositivo justo antes de perder la
señal) no duplica el registro ni rompe por "ambulancia/conductor ya
ocupado". Nullable porque atenciones creadas antes de este issue, o
por otros clientes que no lo manden, siguen siendo válidas.
 
Los endpoints de encabezado y parte clínica (`PUT
.../formato-traslado[/clinico]`) **no necesitaron cambios**: ya son
"manda el formulario completo cada vez" (ADR-0006, ADR-0007), así que
reintentarlos con el mismo cuerpo no duplica nada — son naturalmente
seguros de repetir.
 
**Cola local en IndexedDB (`traslados_pendientes`), una fila por
atención sin sincronizar:** cada fila guarda el `client_id`, los datos
para crear la atención (`AtencionCreate`), el encabezado y la parte
clínica tal como estén hasta el momento (pueden ir llegando en pasos
distintos, igual que en línea), y si ya se sincronizó. Se borra de la
cola una vez los tres pasos (crear, encabezado, clínico) se
confirmaron contra el backend.
 
**La app intenta la red primero, no la cola directamente:** al crear
una atención, al guardar el encabezado o al guardar lo clínico, la app
llama al backend como si hubiera señal; solo si la llamada falla por
red (no por una respuesta HTTP real del servidor) se guarda en la cola
local y la pantalla sigue funcionando con un identificador local
(`local-<uuid>`) en vez del id numérico del servidor. Esto evita
mantener dos implementaciones de cada pantalla (una online, otra
offline) — es la misma pantalla, con una capa debajo que decide dónde
vive el dato.
 
**La sincronización es pasiva, no durante la edición activa:**
dispara automáticamente cuando el dispositivo recupera señal
(evento `online` del navegador) y también se puede forzar con un botón
("Sincronizar ahora") desde un aviso visible en toda la app. No se
fuerza una sincronización a mitad de un formulario que se está
llenando — coincide con el escenario real que describe el issue
("sincronizar al conectarse en el garaje", es decir, después, no
durante el trayecto).
 
## Alternativas consideradas
 
- **Migrar `Atencion.id` (y las FK que dependen de él) a UUID
  generado en el cliente** — descartado: cambio mucho más invasivo
  sobre lo ya construido en los issues #6-#9, para el mismo resultado
  práctico que logra una columna `client_id` separada.
- **SQLite vía `@capacitor-community/sqlite`** — descartado por
  ahora: exige configuración nativa en Android y recompilar la app en
  cada cambio del esquema local; IndexedDB ya resuelve el mismo
  problema sin esa fricción.
- **Sincronizar con un solo endpoint de "bulk sync"** (mandar
  atención + encabezado + clínico en un solo request) — descartado:
  los tres ya existen como pasos independientes y reutilizarlos tal
  cual es más simple que diseñar un cuarto endpoint; el costo es tres
  llamadas en vez de una, aceptable porque la sincronización ocurre
  con buena señal (garaje), no en el momento crítico.
 
## Consecuencias
 
- Cualquier atención creada sin conexión queda, mientras no se
  sincronice, fuera de las listas que lee el backend (disponibilidad
  de ambulancias/conductores, por ejemplo) — el issue no pide
  resolver reservas sin conexión, solo que el formulario no se
  pierda.
- Si dos dispositivos distintos reutilizaran el mismo `client_id` (no
  debería pasar, es un UUID), el segundo en sincronizar recibiría de
  vuelta la atención del primero en lugar de crear la suya — no se
  protege contra esto porque un UUID generado correctamente hace la
  colisión estadísticamente irrelevante.
- Queda pendiente, para un issue aparte, qué pasa si el formato se
  edita en dos dispositivos a la vez sin que ninguno se sincronice
  (conflicto real de datos) — hoy el que sincronice de último
  sobrescribe, igual que ya pasa en línea entre dos pestañas (ADR-0002
  ya documenta que mientras la atención está "abierta" se puede
  reescribir libremente).
