# ADR-0006: Encabezado del formato de traslado
 
- **Fecha:** 2026-10-04
- **Estado:** Aceptada
 
## Contexto
 
El issue #8 pide la primera mitad del formato en papel "TRASLADO
ASISTENCIAL DE PACIENTES" (TAP-LAFS-002): datos del paciente, del
acompañante, recepción y entrega del paciente, complejidad y tipo de
traslado. El cliente compartió el PDF real del formato, que resolvió la
mayoría de las dudas de campos, pero dejó tres puntos ambiguos por cómo
están agrupadas las casillas en el papel — se confirmaron directamente
con el cliente antes de modelar:
 
1. La fila "TIPO DE TRASLADO" tiene 4 casillas: BÁSICO, MEDICALIZADO,
   SENCILLO, REDONDO.
2. La fila "COMPLEJIDAD: ALTA/BAJA" aparece junto a "NEONATO /
   PEDIATRICO / ADULTO".
3. Junto al número de documento del paciente hay un campo "DE:" (en
   teoría, la ciudad de expedición del documento).
 
## Decisión
 
**Tipo de traslado → dos campos independientes:** `nivel_servicio`
(básico/medicalizado — la complejidad del servicio prestado en *este*
traslado, no necesariamente igual a `Ambulancia.tipo`) y `modalidad`
(sencillo/redondo — si el viaje es de ida o de ida y vuelta). Se marcan
uno de cada grupo, no una sola opción de cuatro.
 
**Complejidad → dos campos independientes:** `complejidad`
(alta/baja) y `categoria_paciente` (neonato/pediátrico/adulto),
independientes entre sí.
 
**Campo "DE:" eliminado:** el cliente pidió explícitamente quitarlo —
ya no se captura el lugar de expedición del documento del paciente.
 
**Una sola tabla para todo el formato (`formato_traslado`), no dos:**
aunque el formulario se llena en dos momentos (encabezado en el issue
#8, contenido clínico en el issue #9), es un solo documento en papel
(mismo código TAP-LAFS-002). El issue #9 va a agregar columnas nuevas
a esta misma tabla en vez de crear una tabla aparte — evita tener que
hacer un JOIN para armar el PDF final (issue #13) y refleja mejor que
es un solo registro, no dos relacionados.
 
**`atencion_id` como llave primaria de `formato_traslado`:** la
relación es 1-a-1 con `Atencion` (una atención de tipo `traslado` tiene
como mucho un encabezado), así que no hace falta un `id` autoincremental
aparte.
 
**Un solo endpoint de "guardar" (`PUT`), no uno de crear y otro de
editar:** mientras la atención sigue `abierta`, el auxiliar o médico
puede reescribir el encabezado completo las veces que necesite, sin
permiso ni historial (ADR-0002) — el `PUT` crea el registro si no
existe o lo sobreescribe si ya existía, siempre con el formulario
completo (no hay "parche parcial" de un campo suelto).
 
**Permiso: `require_personal_clinico` (auxiliar de enfermería,
médico), no `require_personal_operativo`:** el conductor puede iniciar
una atención y elegir el móvil (issue #7), pero no diligencia el
contenido del formato — por eso se creó una dependencia de rol más
estricta, específica para endpoints de contenido clínico, distinta de
la que ya existía para crear la atención.
 
## Alternativas consideradas
 
- **Guardar el "tipo de traslado" como una sola lista de 4 opciones** —
  descartado tras confirmar con el cliente que son dos decisiones
  independientes (complejidad del servicio + modalidad del viaje).
- **Tabla separada para el encabezado y otra para el contenido
  clínico, unidas 1 a 1** — descartado: es más JOIN para el mismo
  documento, sin beneficio real ya que ambas partes comparten el mismo
  ciclo de vida (se crean y se cierran junto con la atención).
- **Endpoints `POST` (crear) y `PATCH` (editar) separados** —
  descartado: con el formulario completo siempre mandado de una, un
  solo `PUT` idempotente es más simple y refleja mejor "mientras está
  abierta se reescribe libremente".
 
## Consecuencias
 
- El issue #9 va a hacer una migración que agrega columnas nuevas
  (nullable al principio) a `formato_traslado`, no una tabla nueva.
- La generación del PDF (issue #13) lee de una sola tabla para armar
  todo el documento, sin JOIN adicional más allá de `Atencion` (para
  los datos de tripulación/móvil que ya existían desde el issue #7).
- Si más adelante el cliente pide que el conductor también pueda ver
  (no editar) el encabezado, hay que agregar un endpoint de solo
  lectura con `require_personal_operativo` en vez de abrir el que ya
  existe — por ahora ni siquiera lectura tiene el conductor.
