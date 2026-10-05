# ADR-0007: Parte clínica del formato de traslado
 
- **Fecha:** 2026-10-05
- **Estado:** Aceptada
 
## Contexto
 
El issue #9 pide la segunda mitad del formato "TRASLADO ASISTENCIAL DE
PACIENTES" (TAP-LAFS-002), siguiendo la misma tabla `formato_traslado`
decidida en ADR-0006: "Estado del paciente, pupilas (una opción por
ojo), signos vitales, lesiones, Glasgow, insumos entregados, nota de
auxiliar y nota médica, con límite de caracteres".
 
El PDF real tiene, además de eso, dos secciones que el issue no
menciona (OBSERVACIONES y TRIPULACIÓN A CARGO DEL TRASLADO/placas) y
dos pares de "nombre + firma" (ATENDIDO POR / EVOLUCIONADO POR) donde
solo el nombre entra en el alcance de este issue. Se confirmó con el
cliente antes de modelar:
 
1. **Observaciones** y **Tripulación/placas** quedan fuera de este
   issue — la tripulación en particular ya se puede derivar de la
   `Atencion` (conductor/ambulancia, issue #7), así que guardarla de
   nuevo aquí sería duplicar datos. Queda pendiente un issue nuevo (todavía sin número al escribir esto)
   para resolverlo más adelante (si se guarda como campo nuevo o se
   deriva de la `Atencion`).
2. **"ATENDIDO POR" y "EVOLUCIONADO POR"**: el nombre se guarda ya en
   este issue; la firma (trazo en pantalla o firma guardada del
   personal de planta) es del issue #11 y no se toca aquí.
3. **Límite de caracteres** de las notas de auxiliar y médica: no
   especificado en el issue, se acordó 2000 caracteres.
 
## Decisión
 
**Mismas columnas, misma tabla (`formato_traslado`), todas
`nullable`:** a diferencia del encabezado —que se llena de una sola
vez, al recibir al paciente—, la parte clínica se llena *progresivamente
durante el traslado* (los signos vitales son, literalmente, una
medición repetida en el tiempo). Exigir todos los campos de una
rompería ese flujo real, así que acá no hay nada obligatorio a nivel de
esquema.
 
**Sigue sin existir un PATCH parcial:** cada `PUT` a
`/atenciones/{id}/formato-traslado/clinico` manda el estado completo de
la parte clínica tal como esté hasta ese momento (mismo patrón del
encabezado, ADR-0006) — es más simple para el cliente mantener un solo
estado local y mandarlo completo, que calcular un diff.
 
**Endpoint separado del encabezado
(`PUT .../formato-traslado/clinico`), no el mismo `PUT`:** son datos
que llena gente distinta en momentos distintos del viaje — mezclarlos
en un solo cuerpo de request obligaría a mandar también el encabezado
completo cada vez que se actualiza un signo vital. Requiere que el
encabezado ya exista (404 si no) — no tiene sentido diligenciar lo
clínico de un traslado que ni siquiera se ha recibido.
 
**Listas como columnas `JSON`, no tablas aparte
(`tratamiento`, `signos_vitales`, `lesiones`, `insumos_entregados`):**
son datos de este formato nada más — nadie necesita consultar "todos
los signos vitales de todos los traslados" todavía. Si eso cambia, se
normalizan en su momento; por ahora una tabla nueva por cada lista
sería sobre-ingeniería.
 
**Glasgow total calculado en el backend, no mandado por el
cliente:** `glasgow_ocular + glasgow_verbal + glasgow_motora`, expuesto
como campo calculado (`glasgow_total`) en vez de columna — evita que
quede guardado un total que no cuadre con las tres partes. El cálculo
vive en `FormatoTrasladoOut` (`@computed_field` de Pydantic), no como
`@property` del modelo de SQLAlchemy: la primera versión lo puso en el
modelo y, en una máquina con otra combinación de versiones de
Pydantic/SQLAlchemy, `glasgow_total` desapareció de la respuesta sin
error (no era un atributo mapeado, y `from_attributes=True` no lo leyó
de forma confiable) — se corrigió moviendo el cálculo al esquema, sobre
campos que Pydantic ya validó.
 
**Diagrama corporal (adelante/atrás) fuera de alcance:** es una imagen
en el papel, no un dato estructurado; el checklist de
`LesionTipo` captura el tipo de lesión, no su ubicación exacta en el
cuerpo. Si se necesita más adelante, es un issue aparte (anotar puntos
sobre una imagen es un problema de UI distinto a un formulario).
 
## Alternativas consideradas
 
- **Exigir los mismos campos obligatorios que el encabezado** —
  descartado: no refleja cómo se llena el formulario en la vida real
  (durante el viaje, no de una sola vez al llegar).
- **Un solo `PUT` que reciba encabezado + clínico juntos** —
  descartado: forzaría a mandar el encabezado completo en cada
  actualización de un signo vital, y mezcla datos de gente distinta en
  momentos distintos.
- **Guardar "tratamiento"/"lesiones" como columnas `Enum[]` de Postgres
  en vez de `JSON`** — descartado por ahora: un array de enums de
  Postgres no es portable a SQLite (donde corren las pruebas) sin
  trabajo adicional, y `JSON` alcanza para lo que se necesita hoy.
 
## Consecuencias
 
- Un issue nuevo (pendiente de crear) va a resolver Observaciones y
  Tripulación/placas — decidir ahí si son columnas nuevas o datos
  derivados de la `Atencion`.
- El issue #11 (firmas) va a agregar las firmas de "quien entrega",
  "quien recibe", del auxiliar y del médico — los nombres de
  `atendido_por`/`evolucionado_por` ya están listos para asociarse con
  esas firmas cuando lleguen.
- El issue #13 (generación de PDF) ya puede leer de una sola tabla
  tanto el encabezado como lo clínico para armar el documento completo.