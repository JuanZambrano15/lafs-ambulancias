"""Genera el PDF del formato de traslado asistencial (TAP-LAFS-002),
issue #13 — ver ADR-0011.
 
Una sola plantilla HTML (Jinja2) + WeasyPrint para convertirla a PDF;
nada de LaTeX ni de herramientas externas, ya que el único consumidor
es este mismo proceso (ver ADR-0001: un solo lenguaje de backend).
 
`generar_pdf_formato_traslado` es la única función pública: recibe la
`Atencion` y su `FormatoTraslado` ya cargados (con las relaciones de
`Atencion` — ambulancia/conductor/responsable — precargadas, para no
disparar una consulta perezosa por cada una) y devuelve los bytes del
PDF. No sabe nada de HTTP ni de la base de datos — eso lo maneja quien
la llama, en `app/api/routes/atenciones.py`.
 
Issue #66: el render original no coincidía con el papel real
(TAP-LAFS-002 v2) en varios puntos -- no por error de contenido, sino
porque el PDF se construyó antes de que alguien comparara contra una
copia física del formato. Correcciones de esta revisión:
 
- Encabezado con el membrete real (logo, razón social, NIT, título y
  la tablita de Código/Versión/Fecha/Páginas) -- antes era solo un
  <h1> genérico.
- "Profesional que entrega / que recibe" (fin de la página 1 del
  papel): el PDF nunca mostraba estas firmas, ni siquiera
  `profesional_recibe_*`, que ya existían en el modelo desde el issue
  #75 pero no estaban en la plantilla. "Quien entrega" no es un campo
  propio -- es la firma de quien atendió (traslado básico) o de quien
  evolucionó (medicalizado), según confirmó el cliente.
- "Tripulación a cargo del traslado" (página 2): el papel pide
  Conductor / Auxiliar de enfermería / Médico / Placas como cuatro
  líneas separadas -- el PDF mostraba Móvil + Conductor + un
  "Responsable" genérico que no corresponde a ninguna casilla del
  papel. Auxiliar/Médico ahora usan los mismos nombres ya capturados
  en `atendido_por`/`evolucionado_por`, y la sección se movió al final
  (el papel la trae después de Observaciones, no junto al encabezado).
- "Observaciones" (página 2, antes de la tripulación): no existía
  ninguna columna para esto -- se agregó en este mismo issue
  (`observaciones` en el modelo/esquema).
"""
 
from __future__ import annotations
 
import base64
from collections.abc import Mapping
from datetime import UTC, date, datetime, time
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING, Any, TypeVar
 
from jinja2 import Environment
from PIL import Image, ImageDraw
 
# WeasyPrint no distribuye stubs ni marcador py.typed — no es un
# problema de nuestro código. Se ignora inline (en vez de en
# pyproject.toml) porque mypy, a diferencia de ruff, no busca
# pyproject.toml en directorios padre: si se corre "mypy app" con
# cwd=api/ (como hace el CI), un override en la raíz no se encuentra.
from weasyprint import HTML  # type: ignore[import-untyped]
 
from app.models.formato_traslado import (
    LesionLado,
    LesionTipo,
    LesionVista,
    LesionZona,
    NivelServicioTraslado,
    ReflejoPupilar,
    TratamientoAplicado,
)
 
if TYPE_CHECKING:
    from app.models.atencion import Atencion
    from app.models.formato_traslado import FormatoTraslado
 
# Issue #66: el logo se incrusta como data URL, igual que las firmas
# dibujadas en pantalla -- `HTML(string=...)` no tiene `base_url`, así
# que una ruta de archivo relativa no resolvería nada. Se lee una sola
# vez al importar el módulo, no en cada PDF generado.
_LOGO_PATH = Path(__file__).parent / "assets" / "logo-lafs.png"
_LOGO_DATA_URI = "data:image/png;base64," + base64.b64encode(_LOGO_PATH.read_bytes()).decode(
    "ascii"
)
 
# Mismo criterio que el logo -- se leen una sola vez al importar el
# módulo. El diagrama corporal (ADELANTE/ATRÁS) y los dos iconos de ojo
# son el recorte EXACTO del PDF real (TAP-LAFS-002 v2) que mandó el
# cliente para este issue, no un dibujo aproximado -- así la sección
# "Localización de lesiones" y "Reflejo pupilar" quedan pixel por pixel
# iguales al papel en vez de solo "parecidas".
_ASSETS_DIR = Path(__file__).parent / "assets"
 
 
def _data_uri(nombre_archivo: str, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(
        (_ASSETS_DIR / nombre_archivo).read_bytes()
    ).decode("ascii")
 
 
_DIAGRAMA_CORPORAL_DATA_URI = _data_uri("diagrama-corporal.jpg", "image/jpeg")
_OJO_DERECHA_DATA_URI = _data_uri("ojo-derecha.png", "image/png")
_OJO_IZQUIERDA_DATA_URI = _data_uri("ojo-izquierda.png", "image/png")
 
# Issue #66 (feedback de Fresc tras la primera entrega): el diagrama
# corporal solo mostraba la lista de lesiones en texto aparte, sin
# nada marcado sobre el dibujo -- ahora se dibuja un punto rojo por
# cada lesión, en la región del cuerpo que le corresponde. No es una
# ubicación anatómicamente exacta (igual que `LesionZona`, ver más
# abajo): son coordenadas aproximadas, a mano, sobre los 600×554 px
# de `diagrama-corporal.jpg` (dos esqueletos lado a lado — ADELANTE
# a la izquierda, ATRÁS a la derecha), suficientes para que el punto
# caiga a simple vista en la región correcta.
_DIAGRAMA_CENTRO_X: dict[LesionVista, int] = {
    LesionVista.frontal: 150,
    LesionVista.posterior: 450,
}
_DIAGRAMA_ZONA_Y: dict[LesionZona, int] = {
    LesionZona.cabeza: 35,
    LesionZona.cuello: 72,
    LesionZona.torax: 130,
    LesionZona.abdomen: 195,
    LesionZona.hombro: 100,
    LesionZona.brazo: 165,
    LesionZona.antebrazo: 232,
    LesionZona.mano: 290,
    LesionZona.muslo: 350,
    LesionZona.pierna: 430,
    LesionZona.pie: 520,
}
# Desplazamiento horizontal (px) desde el centro de cada esqueleto
# para las zonas con lado izquierdo/derecho -- 0 para las centrales
# (cabeza, cuello), donde el punto siempre queda sobre el eje medio.
_DIAGRAMA_ZONA_OFFSET_X: dict[LesionZona, int] = {
    LesionZona.cabeza: 0,
    LesionZona.cuello: 0,
    LesionZona.torax: 30,
    LesionZona.abdomen: 25,
    # Issue #66 (feedback de ronda 5): los brazos quedaban con el punto
    # cayendo fuera del contorno del brazo (en las 2 vistas y los 2
    # lados) -- estos 4 valores se recalibraron midiendo pixel por
    # pixel el ancho real del brazo en `diagrama-corporal.jpg` en sus
    # 4 posiciones (frontal/posterior x izquierdo/derecho), en vez de
    # a ojo.
    LesionZona.hombro: 55,
    LesionZona.brazo: 75,
    LesionZona.antebrazo: 95,
    LesionZona.mano: 110,
    LesionZona.muslo: 45,
    LesionZona.pierna: 45,
    LesionZona.pie: 50,
}
 
 
# Issue #66 (feedback de ronda 4): un color distinto por lesión, en vez
# de siempre rojo, para poder distinguir varios puntos pegados en el
# diagrama -- con más de 5 lesiones el color se repite en ciclo (par
# relleno/contorno, el contorno es el mismo tono pero más oscuro para
# que el punto se note incluso sobre piel clara).
_COLORES_LESION: list[tuple[str, str]] = [
    ("#e03131", "#7a0000"),  # rojo
    ("#1971c2", "#0b3d6b"),  # azul
    ("#2f9e44", "#155724"),  # verde
    ("#f08c00", "#8a4b00"),  # naranja
    ("#9c36b5", "#5c1f6b"),  # morado
]
 
 
def _coordenada_lesion(zona: LesionZona, lado: LesionLado, vista: LesionVista) -> tuple[int, int]:
    centro_x = _DIAGRAMA_CENTRO_X[vista]
    y = _DIAGRAMA_ZONA_Y[zona]
    offset = _DIAGRAMA_ZONA_OFFSET_X[zona]
    if lado == LesionLado.central or offset == 0:
        return centro_x, y
    # Issue #54: en vista frontal el paciente da la cara a quien mira,
    # así que su lado derecho queda a la izquierda de la pantalla; en
    # vista posterior es al revés (mismo criterio que `_lado_texto`
    # usa para el texto, aplicado acá a coordenadas).
    va_a_la_izquierda_de_pantalla = (
        lado == LesionLado.derecho if vista == LesionVista.frontal else lado == LesionLado.izquierdo
    )
    x = centro_x - offset if va_a_la_izquierda_de_pantalla else centro_x + offset
    return x, y
 
 
def _diagrama_corporal_con_puntos(lesiones: list[dict[str, Any]]) -> str:
    """Diagrama corporal real del papel con un punto por cada lesión
    localizada, coloreado en ciclo según `_COLORES_LESION` (mismo orden
    y mismo color que la leyenda de texto, ver `_lesiones_localizadas_texto`)
    -- si no hay lesiones, se reutiliza la imagen estática ya cargada (no
    hace falta volver a abrirla ni redibujar nada)."""
    if not lesiones:
        return _DIAGRAMA_CORPORAL_DATA_URI
    imagen = Image.open(_ASSETS_DIR / "diagrama-corporal.jpg").convert("RGB")
    dibujo = ImageDraw.Draw(imagen)
    radio = 13
    for indice, lesion in enumerate(lesiones):
        x, y = _coordenada_lesion(
            LesionZona(lesion["zona"]), LesionLado(lesion["lado"]), LesionVista(lesion["vista"])
        )
        relleno, contorno = _COLORES_LESION[indice % len(_COLORES_LESION)]
        dibujo.ellipse(
            (x - radio, y - radio, x + radio, y + radio),
            fill=relleno,
            outline=contorno,
            width=2,
        )
    buffer = BytesIO()
    imagen.save(buffer, format="JPEG", quality=85, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
 
# Mismas etiquetas en español que ya usa el frontend
# (app/src/pages/ClinicoTrasladoPage.tsx) — se repiten aquí porque el
# backend no tiene ninguna capa de traducción compartida con el
# frontend, y este PDF es el único lugar donde el backend necesita
# mostrarle estas opciones a una persona en vez de solo guardarlas.
ETIQUETAS_TRATAMIENTO: dict[TratamientoAplicado, str] = {
    TratamientoAplicado.collar_cervical: "Collar cervical",
    TratamientoAplicado.inmovilizacion: "Inmovilización",
    TratamientoAplicado.succion_secrecion: "Succión secreción",
    TratamientoAplicado.oxigeno: "Oxígeno",
    TratamientoAplicado.hemostasia: "Hemostasia",
    TratamientoAplicado.linea_iv: "Línea IV",
    TratamientoAplicado.canula_orofaringea: "Cánula orofaríngea",
    TratamientoAplicado.rcp: "R.C.P.",
    TratamientoAplicado.canula_nasal: "Cánula nasal",
    TratamientoAplicado.monitoreo: "Monitoreo",
    TratamientoAplicado.parto: "Parto",
    TratamientoAplicado.vendaje: "Vendaje",
    TratamientoAplicado.asepsia: "Asepsia",
    TratamientoAplicado.otros: "Otros",
}
 
ETIQUETAS_REFLEJO: dict[ReflejoPupilar, str] = {
    ReflejoPupilar.midriatica: "Midriática",
    ReflejoPupilar.miotica: "Miótica",
    ReflejoPupilar.isocorica: "Isocórica",
    ReflejoPupilar.anisocorica: "Anisocórica",
    ReflejoPupilar.no_reactiva: "No reactiva",
}
 
ETIQUETAS_LESION: dict[LesionTipo, str] = {
    LesionTipo.tce: "TCE",
    LesionTipo.amputacion: "Amputación",
    LesionTipo.escalpe: "Escalpe",
    LesionTipo.eritema: "Eritema",
    LesionTipo.fractura_abierta: "Fractura abierta",
    LesionTipo.puncion: "Punción",
    LesionTipo.laceracion: "Laceración",
    LesionTipo.edema: "Edema",
    LesionTipo.luxacion: "Luxación",
    LesionTipo.mordedura: "Mordedura",
    LesionTipo.abrasion: "Abrasión",
    LesionTipo.hematoma: "Hematoma",
    LesionTipo.esguince: "Esguince",
    LesionTipo.picadura: "Picadura",
    LesionTipo.trauma: "Trauma",
    LesionTipo.torax_inestable: "Tórax inestable",
    LesionTipo.contusion: "Contusión",
    LesionTipo.cuerpo_extrano: "Cuerpo extraño",
    LesionTipo.hemotorax_masivo: "Hemotórax masivo",
    LesionTipo.abdomen_cerrado: "Abdomen cerrado",
    LesionTipo.hemorragia: "Hemorragia",
    LesionTipo.quemadura: "Quemadura",
    LesionTipo.aplastamiento: "Aplastamiento",
    LesionTipo.avulsion: "Avulsión",
    LesionTipo.dolor: "Dolor",
}
 
# El papel (TAP-LAFS-002) trae "Localización de lesiones" como una
# grilla fija de 25 casillas en dos columnas (13 + 12), siempre en este
# mismo orden -- no es un checklist genérico recorriendo el dict. Se
# marca una casilla si CUALQUIER lesión registrada (issue #54, con
# ubicación en el diagrama corporal) es de ese tipo, sin importar dónde
# quedó localizada -- la ubicación exacta se sigue mostrando aparte,
# como lista de texto, igual que antes de esta revisión.
_LESION_COLUMNA_IZQUIERDA: tuple[LesionTipo, ...] = (
    LesionTipo.tce,
    LesionTipo.fractura_abierta,
    LesionTipo.luxacion,
    LesionTipo.esguince,
    LesionTipo.contusion,
    LesionTipo.hemorragia,
    LesionTipo.avulsion,
    LesionTipo.escalpe,
    LesionTipo.laceracion,
    LesionTipo.abrasion,
    LesionTipo.trauma,
    LesionTipo.hemotorax_masivo,
    LesionTipo.aplastamiento,
)
_LESION_COLUMNA_DERECHA: tuple[LesionTipo, ...] = (
    LesionTipo.amputacion,
    LesionTipo.puncion,
    LesionTipo.mordedura,
    LesionTipo.picadura,
    LesionTipo.cuerpo_extrano,
    LesionTipo.quemadura,
    LesionTipo.dolor,
    LesionTipo.eritema,
    LesionTipo.edema,
    LesionTipo.hematoma,
    LesionTipo.torax_inestable,
    LesionTipo.abdomen_cerrado,
)
 
 
def _checklist_lesiones(
    lesiones: list[dict[str, Any]], columna: tuple[LesionTipo, ...]
) -> list[tuple[str, bool]]:
    tipos_presentes = {LesionTipo(lesion["tipo"]) for lesion in lesiones}
    return [(ETIQUETAS_LESION[tipo], tipo in tipos_presentes) for tipo in columna]
 
 
# Issue #54: etiquetas del DÓNDE de cada lesión (zona/vista del diagrama
# corporal) -- el lado ("derecho"/"izquierdo") no se traduce aparte,
# porque su género gramatical depende de la zona (ver `_lado_texto`).
ETIQUETAS_ZONA_LESION: dict[LesionZona, str] = {
    LesionZona.cabeza: "Cabeza",
    LesionZona.cuello: "Cuello",
    LesionZona.torax: "Tórax",
    LesionZona.abdomen: "Abdomen",
    LesionZona.hombro: "Hombro",
    LesionZona.brazo: "Brazo",
    LesionZona.antebrazo: "Antebrazo",
    LesionZona.mano: "Mano",
    LesionZona.muslo: "Muslo",
    LesionZona.pierna: "Pierna",
    LesionZona.pie: "Pie",
}
 
ETIQUETAS_VISTA_LESION: dict[LesionVista, str] = {
    LesionVista.frontal: "vista frontal",
    LesionVista.posterior: "vista posterior",
}
 
# Zonas laterales cuyo nombre es femenino en español -- afecta solo el
# "derecho"/"derecha" ("izquierdo"/"izquierda") del lado, nunca la
# etiqueta de la zona misma (esa siempre sale de ETIQUETAS_ZONA_LESION).
_ZONAS_FEMENINAS = frozenset({LesionZona.mano, LesionZona.pierna})
 
 
def _lado_texto(zona: LesionZona, lado: LesionLado) -> str:
    """Texto del lado (precedido por un espacio, listo para concatenar),
    con el género gramatical correcto según la zona -- "pierna derecha",
    nunca "pierna derecho". Vacío para zonas centrales (cabeza, cuello,
    tórax, abdomen), que no tienen lado.
    """
    if lado == LesionLado.central:
        return ""
    femenino = zona in _ZONAS_FEMENINAS
    if lado == LesionLado.derecho:
        return " derecha" if femenino else " derecho"
    return " izquierda" if femenino else " izquierdo"
 
 
def _lesiones_localizadas_texto(lesiones: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """Una línea de texto por lesión marcada en el diagrama corporal
    (issue #54), p.ej. "Hematoma — Pierna derecha (vista frontal)",
    junto con el color (mismo ciclo que `_diagrama_corporal_con_puntos`,
    mismo orden) de su punto en el diagrama -- para que la plantilla
    pueda pintar un puntico del mismo color al lado de cada línea y así
    se pueda identificar cuál punto del diagrama es cuál lesión.
    Reemplaza el checklist-con-X que tenía el papel: ahora cada lesión
    lleva su propia ubicación, no solo el tipo, y puede haber varias.
    """
    lineas = []
    for indice, lesion in enumerate(lesiones):
        tipo = LesionTipo(lesion["tipo"])
        if tipo == LesionTipo.otro:
            etiqueta_tipo = lesion.get("tipo_otro") or "Otro"
        else:
            etiqueta_tipo = ETIQUETAS_LESION[tipo]
        zona = LesionZona(lesion["zona"])
        lado = LesionLado(lesion["lado"])
        vista = LesionVista(lesion["vista"])
        zona_texto = ETIQUETAS_ZONA_LESION[zona] + _lado_texto(zona, lado)
        color, _ = _COLORES_LESION[indice % len(_COLORES_LESION)]
        lineas.append((f"{etiqueta_tipo} — {zona_texto} ({ETIQUETAS_VISTA_LESION[vista]})", color))
    return lineas
 
 
ETIQUETAS_SEXO = {"m": "Masculino", "f": "Femenino"}
ETIQUETAS_TIPO_DOCUMENTO = {"rc": "R.C.", "ti": "T.I.", "cc": "C.C.", "ce": "C.E.", "ppt": "PPT"}
ETIQUETAS_COMPLEJIDAD = {"alta": "Alta", "baja": "Baja"}
ETIQUETAS_CATEGORIA = {"neonato": "Neonato", "pediatrico": "Pediátrico", "adulto": "Adulto"}
ETIQUETAS_NIVEL_SERVICIO = {"basico": "Básico", "medicalizado": "Medicalizado"}
ETIQUETAS_MODALIDAD = {"sencillo": "Sencillo", "redondo": "Redondo"}
 
# El papel dibuja la escala de Glasgow como tres checklists numerados
# (uno por ocular/verbal/motora), no como un solo número suelto -- esto
# no cambia qué se guarda (sigue siendo un entero 1..6 en
# `formato.glasgow_*`), solo arma las etiquetas de cada puntaje posible
# para que la plantilla pueda dibujar el mismo checklist que el papel.
ETIQUETAS_GLASGOW_OCULAR: dict[int, str] = {4: "Espontáneo", 3: "Al llamado", 2: "Al dolor", 1: "Nulo"}
ETIQUETAS_GLASGOW_VERBAL: dict[int, str] = {
    5: "Orientado",
    4: "Confusa",
    3: "Inapropiada",
    2: "Incomprensible",
    1: "Nula",
}
ETIQUETAS_GLASGOW_MOTORA: dict[int, str] = {
    6: "Obedece órdenes",
    5: "Localiza el dolor",
    4: "Retira al dolor",
    3: "Flexión",
    2: "Extensión",
    1: "Nula",
}
 
 
def _opciones_glasgow(valor: int | None, mapa: dict[int, str]) -> list[tuple[int, str, bool]]:
    """Las opciones de una escala de Glasgow, de mayor a menor puntaje
    (mismo orden del papel), cada una con si es la que está guardada.
    """
    return [(puntos, etiqueta, puntos == valor) for puntos, etiqueta in sorted(mapa.items(), reverse=True)]
 
 
def _fecha_hora(fecha: date | None, hora: time | None) -> str:
    """`recepcion_fecha`/`recepcion_hora` siempre existen (obligatorios
    desde el encabezado inicial), pero `entrega_fecha`/`entrega_hora`
    no -- issue #55 (ADR-0014): se piden recién al cerrar la atención,
    así que el PDF se puede regenerar antes de que existan (se
    regenera en cada guardado del encabezado, no solo al cerrar). En
    ese caso se deja en blanco en vez de reventar con AttributeError.
    """
    if fecha is None or hora is None:
        return ""
    return f"{fecha.strftime('%d/%m/%Y')} {hora.strftime('%H:%M')}"
 
 
_ClaveEtiqueta = TypeVar("_ClaveEtiqueta")
 
 
def _checklist(
    seleccionados: list[str], etiquetas: Mapping[_ClaveEtiqueta, str]
) -> list[tuple[str, bool]]:
    """Todas las opciones del checklist, en el mismo orden del papel,
    cada una con si está marcada — para que la plantilla no tenga que
    saber nada de los enums, solo recorrer una lista de (etiqueta,
    marcada).
    """
    return [(etiqueta, valor in seleccionados) for valor, etiqueta in etiquetas.items()]
 
 
def _checklist_reflejo(
    derecha: ReflejoPupilar | None, izquierda: ReflejoPupilar | None
) -> list[tuple[str, bool, bool]]:
    """El papel dibuja el reflejo pupilar como una grilla de 5 filas
    (una por opción) con una casilla para Derecha y otra para
    Izquierda en cada fila -- no dos listas separadas."""
    return [
        (etiqueta, valor == derecha, valor == izquierda)
        for valor, etiqueta in ETIQUETAS_REFLEJO.items()
    ]
 
 
_PLANTILLA = Environment(autoescape=True).from_string(
    """
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  @page { size: letter; margin: 0.45cm; }
  body { font-family: "DejaVu Sans", sans-serif; font-size: 8pt; color: #000; }
  table { border-collapse: collapse; }
  .pagina + .pagina { page-break-before: always; }
 
  /* --- Membrete: logo, razón social y tabla de código (issue #66) --- */
  table.membrete { width: 100%; margin-bottom: 3pt; }
  table.membrete td { border: 1px solid #000; vertical-align: middle; }
  .logo-cell { text-align: center; padding: 3pt; width: 72pt; }
  .logo-cell img { height: 46pt; width: auto; }
  .razon-cell { text-align: center; padding: 3pt 6pt; }
  .razon-nombre { font-weight: bold; font-size: 12.5pt; }
  .razon-nit { font-weight: bold; font-size: 7.5pt; margin-top: 1pt; }
  .titulo-cell { background: #E2EFDA; font-weight: bold; font-size: 12.5pt; text-align: center; padding: 4pt; }
  .codigo-cell { padding: 0; width: 95pt; }
  table.codigo { width: 100%; font-size: 7.5pt; }
  table.codigo td { border: 1px solid #000; padding: 1.5pt 4pt; }
  .codigo-etq { width: 50%; }
 
  /* --- Franja de estado digital: no existe en el papel, es del sistema --- */
  .estado-digital { margin-bottom: 4pt; font-size: 7.5pt; color: #555; text-align: right; }
  .estado-digital .estado { font-weight: bold; padding: 1.5pt 6pt; border: 1px solid #333; border-radius: 3pt; }
  .estado-digital .estado.borrador { color: #a15c00; border-color: #a15c00; }
  .estado-digital .estado.cerrado { color: #0a6b2e; border-color: #0a6b2e; }
 
  /* --- Secciones con barra dorada, igual que el papel --- */
  table.grid { width: 100%; margin-bottom: 3pt; page-break-inside: avoid; break-inside: avoid; }
  table.grid tr, table.grid td { page-break-inside: avoid; break-inside: avoid; }
  table.grid td { border: 1px solid #000; padding: 0.5pt 4pt; vertical-align: top; font-size: 8pt; }
  .barra td, td.barra { background: #FFD966; font-weight: bold; text-align: center; padding: 2pt; }
  .vacio-fila td { font-style: italic; color: #666; text-align: center; }
 
  /* --- Casillas cuadradas de verificación (tratamiento, complejidad...) --- */
  .casilla { display: inline-block; width: 7pt; height: 7pt; border: 1px solid #000;
             margin-right: 3pt; text-align: center; font-size: 6.5pt; line-height: 7pt;
             font-weight: bold; vertical-align: middle; }
  ul.checklist { list-style: none; margin: 0; padding: 2pt 4pt; }
  ul.checklist li { margin-bottom: 0.8pt; white-space: nowrap; font-size: 7.5pt; line-height: 1.15; }
  /* Grilla de 25 casillas de "Localización de lesiones" -- más densa
     que los demás checklists porque son el doble de filas en la mitad
     del ancho. */
  ul.checklist-denso { list-style: none; margin: 0; padding: 1pt 3pt; }
  ul.checklist-denso li { margin-bottom: 0.2pt; white-space: nowrap; font-size: 6.8pt; line-height: 1.02; }
  ul.checklist-denso .casilla { width: 6pt; height: 6pt; margin-right: 2pt; }
 
  /* Punto de color junto a cada línea de la leyenda de "Localización
     de lesiones" -- mismo color que su punto en el diagrama corporal
     (ver _COLORES_LESION), para poder identificar cuál es cuál. */
  .punto-lesion { display: inline-block; width: 5pt; height: 5pt; border-radius: 50%;
                  border: 0.5pt solid rgba(0,0,0,0.45); margin-right: 3pt; vertical-align: middle; }
 
  /* --- Fila de columnas (recepción/entrega, el bloque de 3 columnas) --- */
  table.columnas { width: 100%; margin-bottom: 3pt; page-break-inside: avoid; break-inside: avoid; }
 
  /* El papel dibuja "Localización de lesiones" (+ diagrama ADELANTE/
     ATRÁS) como UNA sola caja que se extiende, a la derecha, junto a
     "Tratamiento"/"Reflejo pupilar" arriba Y junto a "Escala de
     Glasgow"/"Insumos" más abajo -- no como un bloque de 3 columnas
     seguido de 2 bloques de ancho completo. Se modela con un rowspan
     en vez de 3 tablas independientes. */
  table.maestra-clinica { width: 100%; margin-bottom: 3pt; }
 
  /* --- Signos vitales y escala de Glasgow --- */
  table.signos { width: 100%; }
  table.signos td, table.signos th { border: 1px solid #000; padding: 1.5pt 3pt; text-align: center; font-size: 7.5pt; }
  table.signos th { background: #F2F2F2; font-weight: bold; }
  .glasgow-cabecera { font-weight: bold; text-align: center; background: #F2F2F2; font-size: 7.5pt; }
  .glasgow-total { text-align: center; font-weight: bold; padding: 3pt; }
  /* El papel NO trae casillas en Glasgow -- es una lista de referencia
     plana; la opción registrada se resalta en negrita y subrayada. */
  ul.checklist-plano { list-style: none; margin: 0; padding: 2pt 4pt; }
  ul.checklist-plano li { margin-bottom: 0.8pt; white-space: nowrap; font-size: 7.5pt; line-height: 1.15; }
  ul.checklist-plano li.glasgow-marcada { font-weight: bold; text-decoration: underline; }
 
  /* --- Firmas --- */
  /* Página 1 (feedback de Fresc sobre la primera entrega): el título
     va en la misma barra dorada que el resto de los títulos de
     sección, para que quede consistente con "Atendido por"/
     "Evolucionado por" en la página 2 y con todo lo demás. */
  table.firmas { width: 100%; margin-bottom: 3pt; page-break-inside: avoid; break-inside: avoid; }
  table.firmas td { width: 50%; vertical-align: top; padding: 0; text-align: center;
                            page-break-inside: avoid; break-inside: avoid; }
  .firma-cuerpo { padding: 0 6pt; }
  .firma-linea { border-bottom: 1px solid #000; height: 4pt; margin: 2pt 10pt 1pt; }
  .firma-img { max-height: 13pt; max-width: 90%; margin-top: 1pt; }
  .firma-caption { background: #FFD966; font-weight: bold; font-size: 6.5pt; text-align: center; padding: 1pt; }
  .firma-dato { text-align: left; font-size: 6.6pt; padding: 0.2pt 4pt; }
  .sin-firma { display: block; color: #999; font-style: italic; font-size: 7.5pt; margin-top: 4pt; }
 
  /* El papel dibuja las filas como etiqueta + raya en blanco, sin
     bordes de tabla -- pero el título sí lleva la misma barra dorada
     que el resto de las secciones. */
  .tripulacion-titulo { background: #FFD966; font-weight: bold; text-align: center;
                                 padding: 2pt; font-size: 8pt; margin: 3pt 0 1pt; }
  table.tripulacion { width: 100%; margin-bottom: 3pt; }
  table.tripulacion td { border: none; padding: 1.5pt 4pt; font-size: 7.5pt; }
  .tripulacion-etq { font-weight: bold; width: 32%; }
  table.tripulacion td.tripulacion-val { border: none; border-bottom: 1px solid #000; }
 
  .pie { margin-top: 6pt; font-size: 6.5pt; color: #888; }
</style>
</head>
<body>
 
{% macro membrete() %}
<table class="membrete">
  <tr>
    <td rowspan="2" class="logo-cell"><img src="{{ logo_data_uri }}" alt="Logo L.A.F.S. Ambulancias"></td>
    <td class="razon-cell">
      <div class="razon-nombre">L.A.F.S. AMBULANCIAS S.A.S.</div>
      <div class="razon-nit">NIT: {{ nit }}</div>
    </td>
    <td rowspan="2" class="codigo-cell">
      <table class="codigo">
        <tr><td class="codigo-etq">Código</td><td>{{ codigo_formato }}</td></tr>
        <tr><td class="codigo-etq">Versión</td><td>{{ version_formato }}</td></tr>
        <tr><td class="codigo-etq">Fecha</td><td>{{ fecha_version_formato }}</td></tr>
        <tr><td class="codigo-etq">Páginas</td><td>{{ paginas_formato }}</td></tr>
      </table>
    </td>
  </tr>
  <tr><td class="titulo-cell">TRASLADO ASISTENCIAL DE PACIENTES</td></tr>
</table>
{% endmacro %}
 
<div class="pagina">
{{ membrete() }}
 
<div class="estado-digital">
  Atención #{{ atencion_id }} — generado por el sistema el {{ generado_en }}
  <span class="estado {{ 'cerrado' if cerrada else 'borrador' }}">{{ 'CERRADO' if cerrada else 'BORRADOR — AÚN ABIERTO' }}</span>
</div>
 
<table class="grid">
  <tr><td colspan="4" class="barra">Datos del paciente</td></tr>
  <tr>
    <td colspan="2">
      <b>ID</b>
      RC&nbsp;<span class="casilla">{{ 'X' if paciente_tipo_documento == 'R.C.' else '' }}</span>
      &nbsp;&nbsp;TI&nbsp;<span class="casilla">{{ 'X' if paciente_tipo_documento == 'T.I.' else '' }}</span>
      &nbsp;&nbsp;CC&nbsp;<span class="casilla">{{ 'X' if paciente_tipo_documento == 'C.C.' else '' }}</span>
      &nbsp;&nbsp;CE&nbsp;<span class="casilla">{{ 'X' if paciente_tipo_documento == 'C.E.' else '' }}</span>
      &nbsp;&nbsp;PPT&nbsp;<span class="casilla">{{ 'X' if paciente_tipo_documento == 'PPT' else '' }}</span>
    </td>
    <td><b>N°</b></td>
    <td>{{ paciente_numero_documento }}</td>
  </tr>
  <tr>
    <td><b>EPS</b></td>
    <td colspan="3">{{ paciente_eps }}</td>
  </tr>
  <tr>
    <td><b>Nombres</b></td>
    <td>{{ paciente_nombres }}</td>
    <td><b>Apellidos</b></td>
    <td>{{ paciente_apellidos }}</td>
  </tr>
  <tr>
    <td><b>Edad</b></td>
    <td>{{ paciente_edad }}</td>
    <td><b>Sexo</b></td>
    <td>
      M&nbsp;<span class="casilla">{{ 'X' if paciente_sexo == 'Masculino' else '' }}</span>
      &nbsp;&nbsp;F&nbsp;<span class="casilla">{{ 'X' if paciente_sexo == 'Femenino' else '' }}</span>
    </td>
  </tr>
  <tr>
    <td><b>Dirección residencial</b></td>
    <td colspan="3">{{ paciente_direccion_residencial }}</td>
  </tr>
  <tr>
    <td><b>Ciudad</b></td>
    <td>{{ paciente_ciudad }}</td>
    <td><b>Tel</b></td>
    <td>{{ paciente_telefono or '—' }}</td>
  </tr>
</table>
 
<table class="grid">
  <tr><td colspan="6" class="barra">Datos del acompañante</td></tr>
  {% if acompanante_nombres_apellidos %}
  <tr>
    <td style="width:16%; white-space:nowrap;"><b>Nombres y apellidos</b></td>
    <td style="width:34%;">{{ acompanante_nombres_apellidos }}</td>
    <td style="width:13%; white-space:nowrap;"><b>Parentesco</b></td>
    <td style="width:12%;">{{ acompanante_parentesco or '—' }}</td>
    <td style="width:7%;"><b>Tel</b></td>
    <td style="width:18%;">{{ acompanante_telefono or '—' }}</td>
  </tr>
  {% else %}
  <tr class="vacio-fila"><td colspan="6">El paciente viajó sin acompañante</td></tr>
  {% endif %}
</table>
 
<table class="columnas"><tr>
  <td style="width:50%; padding-right:2pt; vertical-align:top;">
    <table class="grid">
      <tr><td colspan="2" class="barra">Recepción del paciente</td></tr>
      <tr><td><b>Fecha</b></td><td>{{ recepcion_fecha }}</td></tr>
      <tr><td><b>Hora</b></td><td>{{ recepcion_hora }}</td></tr>
      <tr><td><b>Ciudad</b></td><td>{{ recepcion_ciudad }}</td></tr>
      <tr><td><b>IPS</b></td><td>{{ recepcion_ips }}</td></tr>
      <tr><td><b>Servicio</b></td><td>{{ recepcion_servicio }}</td></tr>
    </table>
  </td>
  <td style="width:50%; padding-left:2pt; vertical-align:top;">
    <table class="grid">
      <tr><td colspan="2" class="barra">Entrega del paciente</td></tr>
      <!-- Issue #55 (ADR-0014): nullable hasta que se cierra la
           atención -- mismo "or '—'" que ya usan los demás campos
           opcionales (ver acompanante_telefono arriba). -->
      <tr><td><b>Fecha</b></td><td>{{ entrega_fecha or '—' }}</td></tr>
      <tr><td><b>Hora</b></td><td>{{ entrega_hora or '—' }}</td></tr>
      <tr><td><b>Ciudad</b></td><td>{{ entrega_ciudad or '—' }}</td></tr>
      <tr><td><b>IPS</b></td><td>{{ entrega_ips or '—' }}</td></tr>
      <tr><td><b>Servicio</b></td><td>{{ entrega_servicio or '—' }}</td></tr>
    </table>
  </td>
</tr></table>
 
<table class="grid">
  <tr>
    <td style="width:50%;">
      <b>Complejidad</b>
      Alta&nbsp;<span class="casilla">{{ 'X' if complejidad == 'Alta' else '' }}</span>
      &nbsp;&nbsp;Baja&nbsp;<span class="casilla">{{ 'X' if complejidad == 'Baja' else '' }}</span>
    </td>
    <td style="width:50%;">
      Neonato&nbsp;<span class="casilla">{{ 'X' if categoria_paciente == 'Neonato' else '' }}</span>
      &nbsp;&nbsp;Pediátrico&nbsp;<span class="casilla">{{ 'X' if categoria_paciente == 'Pediátrico' else '' }}</span>
      &nbsp;&nbsp;Adulto&nbsp;<span class="casilla">{{ 'X' if categoria_paciente == 'Adulto' else '' }}</span>
    </td>
  </tr>
  <tr>
    <td>
      <b>Tipo de traslado</b>
      Básico&nbsp;<span class="casilla">{{ 'X' if nivel_servicio == 'Básico' else '' }}</span>
      &nbsp;&nbsp;Medicalizado&nbsp;<span class="casilla">{{ 'X' if nivel_servicio == 'Medicalizado' else '' }}</span>
    </td>
    <td>
      Sencillo&nbsp;<span class="casilla">{{ 'X' if modalidad == 'Sencillo' else '' }}</span>
      &nbsp;&nbsp;Redondo&nbsp;<span class="casilla">{{ 'X' if modalidad == 'Redondo' else '' }}</span>
    </td>
  </tr>
</table>
 
<table class="grid">
  <tr><td class="barra">Estado del paciente</td></tr>
  <tr><td><b>Diagnóstico:</b> {{ diagnostico or '—' }}</td></tr>
  <tr><td style="min-height:6pt;">&nbsp;</td></tr>
</table>
 
<table class="maestra-clinica"><tr>
  <td style="width:30%; vertical-align:top; padding:0 2pt 0 0;">
    <table class="grid">
      <tr><td class="barra">Tratamiento</td></tr>
      <tr><td style="padding:0;">
        <ul class="checklist">
          {% for etiqueta, marcada in tratamiento %}
          <li><span class="casilla">{{ 'X' if marcada else '' }}</span>{{ etiqueta }}</li>
          {% endfor %}
        </ul>
        {% if tratamiento_otro %}<div style="padding:2pt 4pt 3pt; font-size:7.5pt;">Otros: {{ tratamiento_otro }}</div>{% endif %}
      </td></tr>
    </table>
  </td>
  <td style="width:32%; vertical-align:top; padding:0 2pt;">
    <table class="grid">
      <tr><td colspan="3" class="barra">Reflejo pupilar</td></tr>
      <tr>
        <td style="width:28%; text-align:center;"><img src="{{ ojo_derecha_data_uri }}" style="height:9pt;" alt="Derecha"></td>
        <td style="width:44%;"></td>
        <td style="width:28%; text-align:center;"><img src="{{ ojo_izquierda_data_uri }}" style="height:9pt;" alt="Izquierda"></td>
      </tr>
      {% for etiqueta, marcada_derecha, marcada_izquierda in reflejo_filas %}
      <tr>
        <td style="text-align:center;"><span class="casilla">{{ 'X' if marcada_derecha else '' }}</span></td>
        <td style="font-size:7.5pt;">{{ etiqueta }}</td>
        <td style="text-align:center;"><span class="casilla">{{ 'X' if marcada_izquierda else '' }}</span></td>
      </tr>
      {% endfor %}
    </table>
    <table class="grid">
      <tr><td class="barra">Signos vitales</td></tr>
      {% if signos_vitales %}
      <tr><td style="padding:0;">
        <table class="signos">
          <tr><th>Hora</th><th>T.A.</th><th>F.C.</th><th>F.R.</th><th>SPO2</th></tr>
          {% for signo in signos_vitales %}
          <tr>
            <td>{{ signo.hora }}</td><td>{{ signo.ta or '—' }}</td>
            <td>{{ signo.fc if signo.fc is not none else '—' }}</td>
            <td>{{ signo.fr if signo.fr is not none else '—' }}</td>
            <td>{{ signo.spo2 if signo.spo2 is not none else '—' }}</td>
          </tr>
          {% endfor %}
        </table>
      </td></tr>
      {% else %}
      <tr class="vacio-fila"><td>Sin mediciones registradas</td></tr>
      {% endif %}
    </table>
  </td>
  <td rowspan="3" style="width:38%; vertical-align:top; padding:0 0 0 2pt;">
    <table class="grid">
      <tr><td colspan="2" class="barra">Localización de lesiones</td></tr>
      <tr><td colspan="2" style="padding:0;">
        <table class="columnas"><tr>
          <td style="width:50%; vertical-align:top; padding:0;">
            <ul class="checklist-denso">
              {% for etiqueta, marcada in lesiones_col_izq %}
              <li><span class="casilla">{{ 'X' if marcada else '' }}</span>{{ etiqueta }}</li>
              {% endfor %}
            </ul>
          </td>
          <td style="width:50%; vertical-align:top; padding:0;">
            <ul class="checklist-denso">
              {% for etiqueta, marcada in lesiones_col_der %}
              <li><span class="casilla">{{ 'X' if marcada else '' }}</span>{{ etiqueta }}</li>
              {% endfor %}
            </ul>
          </td>
        </tr></table>
      </td></tr>
      <tr><td colspan="2" style="text-align:center; padding:1pt;">
        <img src="{{ diagrama_corporal_data_uri }}" style="height:140pt;" alt="Diagrama corporal ADELANTE / ATRÁS">
        <div style="font-size:6pt; line-height:1;">ADELANTE&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ATRÁS</div>
      </td></tr>
      {% if lesiones_localizadas %}
      {% for linea, color in lesiones_localizadas %}
      <tr><td colspan="2" style="font-size:6.5pt; padding:0.5pt 4pt;"><span class="punto-lesion" style="background:{{ color }};"></span>{{ linea }}</td></tr>
      {% endfor %}
      {% else %}
      <tr class="vacio-fila"><td colspan="2">Sin lesiones registradas</td></tr>
      {% endif %}
    </table>
  </td>
</tr>
<tr>
  <td colspan="2" style="vertical-align:top; padding:0 2pt 0 0;">
    <table class="grid">
      <tr><td colspan="3" class="barra">Escala de Glasgow</td></tr>
      <tr>
        <td style="width:33%; vertical-align:top;">
          <div class="glasgow-cabecera">Respuesta ocular</div>
          <ul class="checklist-plano">
            {% for puntos, etiqueta, marcada in glasgow_ocular_opciones %}
            <li{% if marcada %} class="glasgow-marcada"{% endif %}>{% if marcada %}✓ {% endif %}{{ puntos }} {{ etiqueta }}</li>
            {% endfor %}
          </ul>
        </td>
        <td style="width:33%; vertical-align:top;">
          <div class="glasgow-cabecera">Respuesta verbal</div>
          <ul class="checklist-plano">
            {% for puntos, etiqueta, marcada in glasgow_verbal_opciones %}
            <li{% if marcada %} class="glasgow-marcada"{% endif %}>{% if marcada %}✓ {% endif %}{{ puntos }} {{ etiqueta }}</li>
            {% endfor %}
          </ul>
        </td>
        <td style="width:34%; vertical-align:top;">
          <div class="glasgow-cabecera">Respuesta motora</div>
          <ul class="checklist-plano">
            {% for puntos, etiqueta, marcada in glasgow_motora_opciones %}
            <li{% if marcada %} class="glasgow-marcada"{% endif %}>{% if marcada %}✓ {% endif %}{{ puntos }} {{ etiqueta }}</li>
            {% endfor %}
          </ul>
        </td>
      </tr>
      <tr><td colspan="3" class="glasgow-total">GLASGOW: {{ glasgow_total if glasgow_total is not none else '—' }} / 15</td></tr>
    </table>
  </td>
</tr>
<tr>
  <td colspan="2" style="vertical-align:top; padding:0 2pt 0 0;">
    <table class="grid">
      <tr><td class="barra">Insumos entregados por quien refiere</td></tr>
      {% for insumo in insumos_8 %}
      <tr><td style="padding:0.8pt 4pt;">{{ loop.index }}. {{ insumo or '' }}</td></tr>
      {% endfor %}
    </table>
  </td>
</tr>
</table>
 
<table class="firmas"><tr>
  <td>
    <div class="firma-caption">FIRMA Y SELLO PROFESIONAL QUE ENTREGA</div>
    <div class="firma-cuerpo">
      {% if firma_entrega %}
        <img class="firma-img" src="{{ firma_entrega }}" alt="Firma de quien entrega">
      {% else %}
        <div class="firma-linea"></div>
      {% endif %}
      <div class="firma-dato"><b>NOMBRE:</b> {{ entrega_nombre or '' }}</div>
      <div class="firma-dato"><b>CEDULA:</b> {{ entrega_cedula or '' }}</div>
    </div>
  </td>
  <td>
    <div class="firma-caption">FIRMA Y SELLO PROFESIONAL QUE RECIBE</div>
    <div class="firma-cuerpo">
      {% if firma_profesional_recibe %}
        <img class="firma-img" src="{{ firma_profesional_recibe }}" alt="Firma de quien recibe">
      {% else %}
        <div class="firma-linea"></div>
      {% endif %}
      <div class="firma-dato"><b>NOMBRE:</b> {{ profesional_recibe_nombre or '' }}</div>
      <div class="firma-dato"><b>CEDULA:</b> {{ profesional_recibe_cedula or '' }}</div>
    </div>
  </td>
</tr></table>
 
</div>
 
<div class="pagina">
{{ membrete() }}
 
<table class="columnas"><tr>
  <td style="width:62%; padding-right:2pt; vertical-align:top;">
    <table class="grid">
      <tr><td class="barra">Notas de enfermería durante el traslado</td></tr>
      <tr><td style="min-height:65pt;">{{ nota_auxiliar or '—' }}</td></tr>
    </table>
  </td>
  <td style="width:38%; padding-left:2pt; vertical-align:top;">
    <table class="grid">
      <tr><td class="barra">Atendido por</td></tr>
      <tr><td style="text-align:center; min-height:35pt;">
        {% if firma_atendido_por %}
          <img class="firma-img" src="{{ firma_atendido_por }}" alt="Firma de quien atendió">
        {% else %}
          <span class="sin-firma">Sin firma registrada</span>
        {% endif %}
      </td></tr>
      <tr><td class="barra" style="font-size:7.5pt;">Firma y sello del auxiliar</td></tr>
      <tr><td><b>Nombre:</b> {{ atendido_por or '—' }}</td></tr>
    </table>
  </td>
</tr></table>
 
<table class="columnas"><tr>
  <td style="width:62%; padding-right:2pt; vertical-align:top;">
    <table class="grid">
      <tr><td class="barra">Evolución médica</td></tr>
      <tr><td style="min-height:95pt;">{{ nota_medica or '—' }}</td></tr>
    </table>
  </td>
  <td style="width:38%; padding-left:2pt; vertical-align:top;">
    <table class="grid">
      <tr><td class="barra">Evolucionado por</td></tr>
      <tr><td style="text-align:center; min-height:35pt;">
        {% if firma_evolucionado_por %}
          <img class="firma-img" src="{{ firma_evolucionado_por }}" alt="Firma de quien evolucionó">
        {% else %}
          <span class="sin-firma">Sin firma registrada</span>
        {% endif %}
      </td></tr>
      <tr><td class="barra" style="font-size:7.5pt;">Firma y sello del médico</td></tr>
      <tr><td><b>Nombre:</b> {{ evolucionado_por or '—' }}</td></tr>
    </table>
  </td>
</tr></table>
 
<table class="grid">
  <tr><td class="barra">Observaciones</td></tr>
  <tr><td style="min-height:45pt;">{{ observaciones or '—' }}</td></tr>
</table>
 
<div class="tripulacion-titulo">Tripulación a cargo del traslado</div>
<table class="tripulacion">
  <tr><td class="tripulacion-etq">Conductor</td><td class="tripulacion-val">{{ conductor_nombre }} &middot; C.C. {{ conductor_cedula }}</td></tr>
  <tr><td class="tripulacion-etq">Auxiliar de enfermería</td><td class="tripulacion-val">{{ atendido_por or '' }}{% if entrega_rol == 'auxiliar de enfermería' and entrega_cedula %} &middot; C.C. {{ entrega_cedula }}{% endif %}</td></tr>
  <tr><td class="tripulacion-etq">Médico</td><td class="tripulacion-val">{{ evolucionado_por or '' }}{% if entrega_rol == 'médico' and entrega_cedula %} &middot; C.C. {{ entrega_cedula }}{% endif %}</td></tr>
  <tr><td class="tripulacion-etq">Placas del vehículo</td><td class="tripulacion-val">{{ placa }} (móvil {{ movil }})</td></tr>
</table>
 
<p class="pie">
  Generado automáticamente por el sistema L.A.F.S. Ambulancias el {{ generado_en }}.
  {% if cerrada %}Atención cerrada el {{ cerrada_en }}.{% endif %}
</p>
 
</div>
 
</body>
</html>
"""
)
 
 
def generar_pdf_formato_traslado(atencion: Atencion, formato: FormatoTraslado) -> bytes:
    """Renderiza la plantilla HTML con los datos actuales del
    encabezado + parte clínica + tripulación (issue #13, corregida en
    el #66 para que coincida con el papel real) y la convierte a PDF
    con WeasyPrint. No necesita I/O propio: las firmas ya llegan como
    data URLs en base64 (issue #11), así que un
    `<img src="data:image/png;base64,...">` las incrusta sin tocar
    disco ni red.
    """
    # Issue #66: "profesional que entrega" (fin de la página 1 del
    # papel) no es un campo propio en el modelo -- el cliente confirmó
    # que es la firma de quien atendió en un traslado básico, o la de
    # quien evolucionó en uno medicalizado.
    es_medicalizado = formato.nivel_servicio == NivelServicioTraslado.medicalizado
    entrega_rol = "médico" if es_medicalizado else "auxiliar de enfermería"
    entrega_nombre = formato.evolucionado_por if es_medicalizado else formato.atendido_por
    firma_entrega = formato.firma_evolucionado_por if es_medicalizado else formato.firma_atendido_por
    # "atendido_por"/"evolucionado_por" son texto libre (se autocompletan
    # con el nombre de quien está logueado, pero se pueden editar a
    # mano) -- no hay cédula propia guardada ahí. La única cédula que el
    # sistema sí tiene a mano es la del empleado responsable de la
    # atención (`atencion.responsable`, el mismo criterio que ya se usa
    # para la cédula del conductor), que en el caso normal es la misma
    # persona. Si alguien más terminó llenando el campo a mano, esta
    # cédula puede no corresponder con el nombre -- limitación conocida,
    # no hay forma de saberlo sin agregar un campo nuevo al modelo.
    entrega_cedula = atencion.responsable.cedula
 
    contexto = {
        "atencion_id": atencion.id,
        "cerrada": atencion.estado.value == "cerrado",
        "cerrada_en": atencion.cerrada_en.strftime("%d/%m/%Y %H:%M") if atencion.cerrada_en else None,
        "generado_en": datetime.now(UTC).strftime("%d/%m/%Y %H:%M UTC"),
        # Membrete (issue #66) — datos fijos del formato en papel, no
        # vienen de la base de datos porque no cambian entre atenciones.
        "logo_data_uri": _LOGO_DATA_URI,
        "nit": "901535278-5",
        "codigo_formato": "TAP-LAFS-002",
        "version_formato": "2",
        "fecha_version_formato": "15/04/2026",
        "paginas_formato": "2",
        # Paciente
        "paciente_tipo_documento": ETIQUETAS_TIPO_DOCUMENTO.get(
            formato.paciente_tipo_documento.value, formato.paciente_tipo_documento.value
        ),
        "paciente_numero_documento": formato.paciente_numero_documento,
        "paciente_eps": formato.paciente_eps,
        "paciente_nombres": formato.paciente_nombres,
        "paciente_apellidos": formato.paciente_apellidos,
        "paciente_edad": formato.paciente_edad,
        "paciente_sexo": ETIQUETAS_SEXO.get(formato.paciente_sexo.value, formato.paciente_sexo.value),
        "paciente_direccion_residencial": formato.paciente_direccion_residencial,
        "paciente_ciudad": formato.paciente_ciudad,
        "paciente_telefono": formato.paciente_telefono,
        # Acompañante
        "acompanante_nombres_apellidos": formato.acompanante_nombres_apellidos,
        "acompanante_parentesco": formato.acompanante_parentesco,
        "acompanante_telefono": formato.acompanante_telefono,
        # Recepción / entrega -- el papel trae FECHA y HORA como dos
        # columnas separadas, no una sola celda combinada.
        "recepcion_fecha_hora": _fecha_hora(formato.recepcion_fecha, formato.recepcion_hora),
        "recepcion_fecha": formato.recepcion_fecha.strftime("%d/%m/%Y"),
        "recepcion_hora": formato.recepcion_hora.strftime("%H:%M"),
        "recepcion_ciudad": formato.recepcion_ciudad,
        "recepcion_ips": formato.recepcion_ips,
        "recepcion_servicio": formato.recepcion_servicio,
        "entrega_fecha_hora": _fecha_hora(formato.entrega_fecha, formato.entrega_hora),
        # Issue #55 (ADR-0014): nullable hasta que se cierra la
        # atención -- en blanco en vez de .strftime() sobre None.
        "entrega_fecha": formato.entrega_fecha.strftime("%d/%m/%Y") if formato.entrega_fecha else "",
        "entrega_hora": formato.entrega_hora.strftime("%H:%M") if formato.entrega_hora else "",
        "entrega_ciudad": formato.entrega_ciudad,
        "entrega_ips": formato.entrega_ips,
        "entrega_servicio": formato.entrega_servicio,
        # Tipo de traslado
        "complejidad": ETIQUETAS_COMPLEJIDAD.get(
            formato.complejidad.value, formato.complejidad.value
        ),
        "categoria_paciente": ETIQUETAS_CATEGORIA.get(
            formato.categoria_paciente.value, formato.categoria_paciente.value
        ),
        "nivel_servicio": ETIQUETAS_NIVEL_SERVICIO.get(
            formato.nivel_servicio.value, formato.nivel_servicio.value
        ),
        "modalidad": ETIQUETAS_MODALIDAD.get(formato.modalidad.value, formato.modalidad.value),
        # Tripulación — Conductor viene de Atencion (ADR-0006); Auxiliar
        # y Médico reutilizan los nombres ya capturados en lo clínico
        # (issue #66: antes se mostraba un "Responsable" genérico que
        # no corresponde a ninguna casilla del papel).
        "movil": atencion.ambulancia.movil,
        "placa": atencion.ambulancia.placa,
        "conductor_nombre": f"{atencion.conductor.nombres} {atencion.conductor.apellidos}",
        "conductor_cedula": atencion.conductor.cedula,
        # Clínico
        "diagnostico": formato.diagnostico,
        "tratamiento": _checklist(formato.tratamiento, ETIQUETAS_TRATAMIENTO),
        "tratamiento_otro": formato.tratamiento_otro,
        "pupila_derecha": ETIQUETAS_REFLEJO.get(formato.pupila_derecha)
        if formato.pupila_derecha
        else None,
        "pupila_izquierda": ETIQUETAS_REFLEJO.get(formato.pupila_izquierda)
        if formato.pupila_izquierda
        else None,
        # El papel dibuja esto como una grilla de 5 filas con una
        # casilla para Derecha y otra para Izquierda en cada fila.
        "reflejo_filas": _checklist_reflejo(formato.pupila_derecha, formato.pupila_izquierda),
        "signos_vitales": formato.signos_vitales,
        "lesiones_localizadas": _lesiones_localizadas_texto(formato.lesiones_localizadas),
        # El papel dibuja "Localización de lesiones" como una grilla
        # FIJA de 25 casillas en dos columnas (issue #66, "exactamente
        # igual" al papel) -- la ubicación exacta de cada lesión (zona/
        # lado/vista, issue #54) se sigue mostrando aparte como texto,
        # en `lesiones_localizadas` arriba.
        "lesiones_col_izq": _checklist_lesiones(formato.lesiones_localizadas, _LESION_COLUMNA_IZQUIERDA),
        "lesiones_col_der": _checklist_lesiones(formato.lesiones_localizadas, _LESION_COLUMNA_DERECHA),
        "diagrama_corporal_data_uri": _diagrama_corporal_con_puntos(formato.lesiones_localizadas),
        "ojo_derecha_data_uri": _OJO_DERECHA_DATA_URI,
        "ojo_izquierda_data_uri": _OJO_IZQUIERDA_DATA_URI,
        "glasgow_ocular": formato.glasgow_ocular,
        "glasgow_verbal": formato.glasgow_verbal,
        "glasgow_motora": formato.glasgow_motora,
        "glasgow_total": (
            formato.glasgow_ocular + formato.glasgow_verbal + formato.glasgow_motora
            if formato.glasgow_ocular is not None
            and formato.glasgow_verbal is not None
            and formato.glasgow_motora is not None
            else None
        ),
        # El papel dibuja la escala de Glasgow como tres checklists
        # numerados (issue #66, "lo más parecido posible" al formato real).
        "glasgow_ocular_opciones": _opciones_glasgow(formato.glasgow_ocular, ETIQUETAS_GLASGOW_OCULAR),
        "glasgow_verbal_opciones": _opciones_glasgow(formato.glasgow_verbal, ETIQUETAS_GLASGOW_VERBAL),
        "glasgow_motora_opciones": _opciones_glasgow(formato.glasgow_motora, ETIQUETAS_GLASGOW_MOTORA),
        "insumos_entregados": formato.insumos_entregados,
        # El papel trae 8 líneas numeradas fijas (1 a 8), con o sin
        # dato -- no una lista que crece con lo registrado.
        "insumos_8": [
            formato.insumos_entregados[i] if i < len(formato.insumos_entregados) else None
            for i in range(8)
        ],
        # "Profesional que entrega" (issue #66, fin de página 1 del papel)
        "entrega_rol": entrega_rol,
        "entrega_nombre": entrega_nombre,
        "entrega_cedula": entrega_cedula,
        "firma_entrega": firma_entrega,
        "nota_auxiliar": formato.nota_auxiliar,
        "atendido_por": formato.atendido_por,
        "firma_atendido_por": formato.firma_atendido_por,
        "nota_medica": formato.nota_medica,
        "evolucionado_por": formato.evolucionado_por,
        "firma_evolucionado_por": formato.firma_evolucionado_por,
        "profesional_recibe_nombre": formato.profesional_recibe_nombre,
        "profesional_recibe_cedula": formato.profesional_recibe_cedula,
        "firma_profesional_recibe": formato.firma_profesional_recibe,
        # Issue #66
        "observaciones": formato.observaciones,
    }
 
    html = _PLANTILLA.render(**contexto)
    # `write_pdf` no tiene stubs (ver override de WeasyPrint arriba), así
    # que mypy solo ve `Any` — se anota el cast explícitamente en vez de
    # dejar que el `Any` se filtre al resto del código que llama a esto.
    pdf_bytes: bytes = HTML(string=html).write_pdf()
    return pdf_bytes