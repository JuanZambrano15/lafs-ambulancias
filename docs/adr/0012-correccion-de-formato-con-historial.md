# ADR-0012: Corrección de formato cerrado, con historial de versiones
 
- **Fecha:** 2026-10-09
- **Estado:** Aceptada
 
## Contexto
 
El issue #14 pide: "Solo el administrador autoriza. Se conserva la
versión anterior en `formato_version`."
 
El ADR-0002 ya había dejado anotado que, una vez cerrada una atención,
cualquier edición posterior del formato necesitaría permiso del
administrador — y el ADR-0010 reafirmó que esto quedaba pendiente para
este issue. Hasta ahora, `PUT .../formato-traslado` y
`PUT .../formato-traslado/clinico` simplemente rechazan con 409
cualquier intento de edición si `Atencion.estado != abierto`, sin
excepción para nadie.
 
Se confirmó con el cliente:
 
- **Quién corrige:** el administrador mismo edita — no hay un
  "auxiliar corrige con autorización del admin"; el administrador usa
  los mismos endpoints de siempre (`PUT` de encabezado/clínico), solo
  que con permiso para hacerlo incluso con la atención ya cerrada.
- **Alcance de este issue:** solo backend. El panel web del
  administrador (issue #15) todavía no existe, así que no hay dónde
  construir una pantalla para esto todavía — la UI de corrección e
  historial se construye cuando se aborde ese issue.
- **Sin motivo de texto libre:** el historial guarda quién corrigió y
  cuándo, no por qué.
 
## Decisión
 
**El administrador edita con los mismos `PUT` de siempre, no un
endpoint nuevo de "corrección":** `guardar_encabezado_traslado` y
`guardar_clinico_traslado` pasan de `require_personal_clinico` a
`require_personal_clinico_o_admin` (ya existía, del issue #13) a nivel
de ruta, y dentro de cada uno se decide el permiso real según el
estado de la atención:
 
- `abierto`: igual que siempre — auxiliar o médico editan; el
  administrador NO (sigue sin ser quien llena el formato día a día,
  ADR-0006). Si alguien con rol administrador pero sin rol clínico
  intenta editar una atención abierta, 403.
- `cerrado`: solo el administrador — cualquier otro rol (incluido
  auxiliar/médico, que normalmente sí podrían) recibe 409 ("ya está
  cerrada, solo un administrador puede corregirla"). Antes de aplicar
  los campos nuevos, se guarda una copia del estado actual en
  `formato_version`.
 
No se necesitó una dependencia de FastAPI nueva para esta lógica
condicional (depende del estado de la atención, no solo del rol) — se
resolvió con dos funciones simples (`_es_admin`, `_es_personal_clinico`)
que leen `usuario.roles` dentro del propio handler.
 
**`FormatoVersion`, una tabla nueva con (casi) las mismas columnas que
`FormatoTraslado`:** se evaluó guardar un JSON genérico del formato
completo en vez de columnas explícitas, pero el proyecto ya evita JSON
para datos con forma fija en todos lados excepto listas repetibles
(`signos_vitales`, `lesiones`, `tratamiento`, `insumos_entregados` —
esas sí se copian tal cual, siguen siendo JSON ahí también). Mantener
columnas explícitas es consistente con `formato_traslado` y hace que
una consulta directa a la base de datos (para soporte, por ejemplo)
sea legible sin tener que parsear un blob.
 
**Una fila de `formato_version` por corrección, nunca se edita ni se
borra:** `atencion_id` es una FK normal (indexada), no única —
una atención puede acumular varias correcciones a lo largo del tiempo,
cada una con su propia fila. `corregido_por_id` (FK a `usuario`) y
`corregido_en` registran quién y cuándo; no hay campo de motivo.
 
**`GET /{atencion_id}/formato-traslado/historial`, mismo permiso que
ver el formato actual (`require_personal_clinico_o_admin`):** lista
las versiones más reciente primero. Devuelve lista vacía (no 404)
cuando nunca hubo una corrección — es el caso normal para la inmensa
mayoría de atenciones, no un error.
 
**La corrección también regenera el PDF (`_regenerar_pdf`),
reutilizando el mismo helper del issue #13:** el PDF guardado en
`FormatoTraslado.pdf_generado` siempre debe reflejar el último estado,
corregido o no — no hay razón para que la corrección sea la única
operación de guardado que deje el PDF desactualizado.
 
## Alternativas consideradas
 
- **Endpoint separado para "corregir" (`POST .../corregir`), distinto
  de los `PUT` normales** — descartado: hubiera significado duplicar
  toda la validación de cada campo en dos lugares. Reutilizar los
  mismos `PUT` con una rama de permiso según el estado es menos
  código y el mismo contrato de entrada/salida de siempre.
- **El admin "autoriza" y el auxiliar/médico original hace la
  edición** (una especie de ventana desbloqueada) — descartado por
  decisión explícita del cliente: el administrador es quien edita.
- **Guardar diagnóstico/notas en `formato_version` pero ocultarlos
  solo en el endpoint de salida** — descartado por decisión explícita
  del cliente: ni siquiera deben persistir ahí.
- **JSON genérico para el snapshot completo en vez de columnas
  explícitas** — descartado por consistencia con el resto del
  proyecto (ver Decisión).
 
## Consecuencias
 
- La UI para que un administrador corrija un formato y vea el
  historial queda pendiente del issue #15 (panel web del
  administrador) — el backend ya está listo para cuando se aborde.
- Una corrección sobre un formato con un PDF ya generado deja ese PDF
  reemplazado por el corregido; el PDF de la versión anterior no se
  conserva en ningún lado (ni en `formato_version` ni aparte).
