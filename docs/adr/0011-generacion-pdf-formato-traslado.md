# ADR-0011: Generación del PDF del formato de traslado
 
- **Fecha:** 2026-10-07
- **Estado:** Aceptada
 
## Contexto
 
El issue #13 pide: "Generar el PDF con WeasyPrint desde la misma
plantilla HTML del formato, al sincronizar en el servidor." WeasyPrint
ya estaba previsto desde el día uno (ADR-0001): `weasyprint==62.3` ya
estaba fijado en `requirements.txt` y el `Dockerfile` ya traía sus
dependencias de sistema instaladas (`libpango`, `libpangocairo`,
`libgdk-pixbuf`, etc.) con un comentario anticipando este issue.
 
Se confirmó con el cliente:
 
- **Cuándo se genera:** en cada guardado — encabezado, parte clínica,
  y al cerrar la atención — no de forma perezosa ni solo una vez al
  final. "Al sincronizar en el servidor" cubre tanto el uso en línea
  como la sincronización offline (ADR-0008), porque ambos casos pasan
  por los mismos endpoints `PUT`.
- **Quién puede descargarlo:** auxiliar de enfermería, médico y
  administrador — no el conductor. El administrador es la excepción
  notable frente al resto de endpoints de formato (ADR-0006, ADR-0007),
  que lo excluyen a propósito; aquí se incluye porque no participa en
  el traslado pero sí necesita consultar el documento final (pensado
  para el panel administrativo del issue #15).
 
El contenido y alcance del PDF ya estaban decididos por ADRs previos:
ADR-0006 especifica que la generación lee de una sola tabla
(`formato_traslado`) más un join con `Atencion` para la tripulación,
sin JOIN adicional; ADR-0007 deja "Observaciones" y
"Tripulación/placas" como campos dedicados fuera de alcance (no hay
columnas para eso, así que el PDF no tiene sección de Observaciones);
ADR-0009 ya anticipa que las firmas se insertan directamente como
imágenes.
 
## Decisión
 
**Jinja2 + WeasyPrint, una sola plantilla HTML inline (sin archivos
de plantilla separados):** el formato es un único documento, no una
familia de layouts — una plantilla en un string de Python, renderizada
con `Environment(autoescape=True)`, es suficiente y evita modelar un
sistema de archivos de plantillas para un solo documento.
 
**El PDF se guarda como bytes en una columna nueva
(`FormatoTraslado.pdf_generado: LargeBinary`), no en disco ni en
almacenamiento externo:** mismo criterio que la firma (ADR-0009) — el
volumen de este proyecto no justifica montar S3 ni un filesystem
compartido; los bytes del PDF caben en la misma fila. Se agrega
también `pdf_generado_en` para saber cuándo quedó ese PDF, sin tener
que inferirlo de otra parte.
 
**Regeneración eager, no perezosa:** `guardar_encabezado_traslado`,
`guardar_clinico_traslado` y `cerrar_atencion` llaman a un helper
común (`_regenerar_pdf`) después de cada `commit` exitoso, así que el
PDF guardado siempre refleja el último estado — descargarlo nunca
dispara trabajo de render ni puede quedar desincronizado del
contenido. El costo es regenerar el PDF en cada guardado aunque nadie
lo vaya a descargar nunca; se acepta ese costo a cambio de que
descargar sea instantáneo y nunca pueda fallar por un render que
ocurre justo en ese momento.
 
**`require_personal_clinico_o_admin` (nueva combinación de roles),
solo para el endpoint de descarga:** en vez de reutilizar
`require_personal_clinico` (que excluye admin, ADR-0006/0007) o
`require_personal_operativo` (que excluye admin e incluye conductor),
se crea una combinación nueva que es exactamente el conjunto pedido.
El conductor queda afuera, igual que en el resto de endpoints de
formato — él no diligencia ni consulta el documento clínico.
 
**El router de `/atenciones` deja de tener un `dependencies=` a nivel
de router:** antes, `require_personal_operativo` se aplicaba a *todas*
las rutas del router (incluida la nueva ruta de descarga), lo cual
bloqueaba al administrador antes de que su propio
`require_personal_clinico_o_admin` llegara a evaluarse — FastAPI exige
que pasen todas las dependencias, las del router y las de la ruta.
Se removió esa dependencia del router y se agregó explícitamente a
cada una de las tres rutas que la necesitaban
(`listar_ambulancias_disponibles`, `listar_conductores_disponibles`,
`crear_atencion`), dejando su comportamiento exactamente igual que
antes — las demás rutas ya tenían su propia dependencia explícita
(`require_personal_clinico`), así que no les cambia nada.
 
**`pydyf==0.11.0`, fijado explícitamente:** WeasyPrint 62.3 declara
`pydyf >=0.10.0` sin techo, y pip resuelve `pydyf==0.12.1` por
defecto — pero esa versión rompe la API interna que WeasyPrint espera
(`Stream.transform`), haciendo que `write_pdf()` falle siempre con
`AttributeError`. Se fija la última versión compatible en vez de
confiar en que el rango declarado por WeasyPrint sea correcto.
 
## Alternativas consideradas
 
- **Generar el PDF al vuelo en el momento de la descarga, sin
  guardarlo** — descartado por decisión explícita del cliente: el PDF
  debe reflejar lo guardado en cada sincronización, no solo lo que
  hay en el momento en que alguien lo pide.
- **ReportLab u otra librería de construcción de PDF por
  coordenadas** — descartado: ya existe una plantilla HTML del
  formato (el mismo que ve el frontend) y WeasyPrint la reutiliza tal
  cual, sin reconstruir el layout en otro lenguaje.
- **Guardar el PDF en disco o en un bucket aparte, con solo una ruta
  en la base de datos** — descartado por ahora, mismo razonamiento que
  ADR-0009 para la firma: no hay infraestructura de archivos en este
  proyecto y el volumen no la justifica todavía.
 
## Consecuencias
 
- Cada `PUT` de encabezado o clínico, y el cierre de la atención,
  ahora también renderiza un PDF completo — el guardado deja de ser
  una operación "barata"; si el volumen de atenciones simultáneas
  crece mucho, esto podría necesitar moverse a una tarea en segundo
  plano (hoy no hace falta).
- El PDF nunca tiene sección de Observaciones ni de
  tripulación/placas como campos propios — si el cliente pide
  agregarlos, primero hace falta el issue que modele esas columnas
  (ADR-0007 ya lo dejó anotado como pendiente), y este módulo de PDF
  solo necesitaría leer los campos nuevos.
- El administrador puede descargar el PDF aunque no participe en el
  traslado — si más adelante se agregan más endpoints de solo lectura
  pensados para el panel administrativo (issue #15), conviene revisar
  si conviene generalizar `require_personal_clinico_o_admin` o seguir
  creando combinaciones puntuales por endpoint.
