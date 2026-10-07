# ADR-0009: Firma guardada (planta) y firma en pantalla (ocasional)
 
- **Fecha:** 2026-10-07
- **Estado:** Aceptada
 
## Contexto
 
El issue #11 pide: "Firma reutilizable para personal de planta; firma
en pantalla, sin guardar, para el que no lo es." `Empleado` ya tiene
`tipo_vinculacion` (`planta`/`ocasional`, issue #4), así que el issue
encaja directamente sobre ese dato existente — no hace falta modelar
nada nuevo para distinguir a quién se le guarda la firma.
 
El ADR-0007 había dejado anotado que este issue agregaría firma para
cuatro roles del papel: "quien entrega", "quien recibe", el auxiliar
(`atendido_por`) y el médico (`evolucionado_por`). Se confirmó con el
cliente que "quien entrega"/"quien recibe" son, en el papel, personal
de la IPS de destino — gente que no es empleado de LAFS y no tiene
usuario en el sistema — así que quedan fuera de este issue; solo se
cubren las firmas del auxiliar y del médico, que sí son personal
propio con `Empleado`/`Usuario`.
 
También se confirmó que la firma guardada se configura desde una
pantalla propia del empleado ("Configurar mi firma"), no algo que un
administrador suba por él.
 
## Decisión
 
**Firma = imagen PNG dibujada en pantalla (canvas), guardada como
data URL en base64:** no hay almacenamiento de archivos en este
proyecto (ni S3 ni algo similar), y una firma pesa poco — un blob de
texto en la misma fila alcanza sin montar esa infraestructura antes de
tiempo. Si más adelante el volumen lo justifica, se puede migrar a
archivos aparte sin cambiar el contrato de la API (sigue siendo una
cadena, solo cambiaría de dónde sale).
 
**`Empleado.firma_guardada` (columna nueva, nullable):** la firma
reutilizable vive en el empleado, no en el usuario — es un dato de la
persona, igual que el nombre o la cédula. Solo tiene valor para
personal de planta; el endpoint que la escribe (`PUT /auth/firma`) es
el que impone esa regla (409 si el empleado es `ocasional` o no está
vinculado), no una restricción a nivel de columna, porque nada impide
que el dato exista aunque hoy no se use por esa vía.
 
**`PUT /auth/firma`, autoservicio, mismo patrón que `/auth/password` y
`/auth/pin`:** el empleado configura su propia firma con solo tener
sesión válida, sin necesitar al administrador — consistente con que
"Configurar mi firma" es una pantalla propia. Sobreescribe la firma
anterior si ya existía (no hay un endpoint de "crear" separado de
"actualizar" — es la misma pantalla para la primera vez y para
rehacerla, igual que el PIN).
 
**`GET /auth/me` devuelve `empleado_tipo_vinculacion` y
`firma_guardada`:** el frontend los necesita para decidir, sin otra
llamada aparte, si mostrarle a alguien la opción de guardar su firma
(solo planta) y si puede autocompletarla al firmar un formato (si ya
tiene una guardada) — ya se llama una vez al iniciar sesión, cacheado
en el contexto de autenticación.
 
**`formato_traslado.firma_atendido_por` / `firma_evolucionado_por`
(columnas nuevas, nullable, igual patrón que el resto de lo clínico —
ADR-0007):** cada una es la firma que quedó en ese formato puntual,
sin importar si vino de la firma guardada del empleado o de un dibujo
nuevo en pantalla — el backend no necesita saber cuál de las dos fue;
eso lo decide el frontend antes de mandar el PUT. Mismo endpoint de
siempre (`PUT .../formato-traslado/clinico`), sin uno aparte para
firmas.
 
## Alternativas consideradas
 
- **Guardar también firma de "quien entrega"/"quien recibe"** —
  descartado por ahora: esas personas no son empleados de LAFS, no
  tienen usuario ni Empleado al que atarles nada; resolverlo bien
  (¿se registran como contactos externos? ¿basta un campo de texto?)
  es una decisión de modelo aparte, para un issue propio.
- **Firma como archivo subido a almacenamiento externo (S3 o
  similar)** — descartado por ahora: monta infraestructura nueva para
  un dato que, en este volumen, cabe perfectamente como texto en la
  misma fila.
- **Vector (trazos SVG/puntos) en vez de PNG rasterizado** — descartado:
  un PNG es lo que cualquier canvas HTML exporta de forma nativa
  (`toDataURL()`), sin lógica adicional de captura de trazos; para
  mostrarlo en un PDF (issue #13) una imagen es exactamente lo que se
  necesita de todas formas.
 
## Consecuencias
 
- El issue #13 (generación de PDF) puede insertar
  `firma_atendido_por`/`firma_evolucionado_por` directamente como
  imágenes en el documento.
- Queda pendiente, para un issue aparte, cómo se firma "quien
  entrega"/"quien recibe" (personal externo de la IPS).
- Si el cliente pide limitar quién puede ver la firma guardada de
  otro empleado (hoy nadie más la consulta: solo aparece en `/auth/me`
  del propio usuario), no hace falta cambiar el modelo — ya está
  aislado por persona.
