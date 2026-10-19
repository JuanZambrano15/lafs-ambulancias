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
from pathlib import Path
from typing import TYPE_CHECKING, Any, TypeVar
 
from jinja2 import Environment
 
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
 
 
def _lesiones_localizadas_texto(lesiones: list[dict[str, Any]]) -> list[str]:
    """Una línea de texto por lesión marcada en el diagrama corporal
    (issue #54), p.ej. "Hematoma — Pierna derecha (vista frontal)".
    Reemplaza el checklist-con-X que tenía el papel: ahora cada lesión
    lleva su propia ubicación, no solo el tipo, y puede haber varias.
    """
    lineas = []
    for lesion in lesiones:
        tipo = LesionTipo(lesion["tipo"])
        if tipo == LesionTipo.otro:
            etiqueta_tipo = lesion.get("tipo_otro") or "Otro"
        else:
            etiqueta_tipo = ETIQUETAS_LESION[tipo]
        zona = LesionZona(lesion["zona"])
        lado = LesionLado(lesion["lado"])
        vista = LesionVista(lesion["vista"])
        zona_texto = ETIQUETAS_ZONA_LESION[zona] + _lado_texto(zona, lado)
        lineas.append(f"{etiqueta_tipo} — {zona_texto} ({ETIQUETAS_VISTA_LESION[vista]})")
    return lineas
 
 
ETIQUETAS_SEXO = {"m": "Masculino", "f": "Femenino"}
ETIQUETAS_TIPO_DOCUMENTO = {"rc": "R.C.", "ti": "T.I.", "cc": "C.C.", "ce": "C.E.", "ppt": "PPT"}
ETIQUETAS_COMPLEJIDAD = {"alta": "Alta", "baja": "Baja"}
ETIQUETAS_CATEGORIA = {"neonato": "Neonato", "pediatrico": "Pediátrico", "adulto": "Adulto"}
ETIQUETAS_NIVEL_SERVICIO = {"basico": "Básico", "medicalizado": "Medicalizado"}
ETIQUETAS_MODALIDAD = {"sencillo": "Sencillo", "redondo": "Redondo"}
 
 
def _fecha_hora(fecha: date, hora: time) -> str:
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
 
 
_PLANTILLA = Environment(autoescape=True).from_string(
    """
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  @page { size: letter; margin: 1.4cm; }
  body { font-family: "DejaVu Sans", sans-serif; font-size: 9.5pt; color: #1a1a1a; }
  h1 { font-size: 13pt; margin: 0 0 2pt; }
  h2 { font-size: 10.5pt; margin: 10pt 0 4pt; border-bottom: 1px solid #999; padding-bottom: 2pt; }
  .subtitulo { font-size: 9pt; color: #555; margin: 0 0 8pt; }
  .membrete { display: flex; align-items: center; gap: 10pt; border: 1px solid #999;
              border-radius: 3pt; padding: 6pt 10pt; margin-bottom: 4pt; }
  .membrete img { height: 42pt; width: auto; }
  .membrete .razon-social { flex: 1; text-align: center; }
  .membrete .razon-social h1 { font-size: 13pt; }
  .membrete .razon-social .nit { font-size: 8pt; color: #555; }
  .membrete .razon-social .titulo { font-size: 11pt; font-weight: bold; margin-top: 2pt; }
  .membrete table.codigo { border-collapse: collapse; font-size: 8pt; }
  .membrete table.codigo td { border: 1px solid #999; padding: 1.5pt 5pt; }
  .membrete table.codigo td.etiqueta { color: #555; background: #f4f4f4; }
  .estado-digital { display: flex; justify-content: space-between; align-items: baseline;
                     margin-bottom: 8pt; }
  .estado { font-weight: bold; padding: 2pt 8pt; border: 1px solid #333; border-radius: 3pt; }
  .estado.borrador { color: #a15c00; border-color: #a15c00; }
  .estado.cerrado { color: #0a6b2e; border-color: #0a6b2e; }
  table.datos { width: 100%; border-collapse: collapse; margin-bottom: 4pt; }
  table.datos td { padding: 1.5pt 4pt; vertical-align: top; }
  table.datos td.etiqueta { color: #555; width: 32%; white-space: nowrap; }
  .columnas { display: flex; gap: 12pt; }
  .columnas > div { flex: 1; }
  ul.checklist { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 10pt; }
  ul.checklist li { margin-bottom: 1.5pt; }
  ul.checklist li.marcada { font-weight: bold; }
  .casilla { display: inline-block; width: 8pt; height: 8pt; border: 1px solid #333;
             margin-right: 4pt; text-align: center; font-size: 7pt; line-height: 8pt; }
  table.signos { width: 100%; border-collapse: collapse; margin-bottom: 4pt; }
  table.signos th, table.signos td { border: 1px solid #ccc; padding: 2pt 4pt; text-align: center; }
  table.signos th { background: #f0f0f0; }
  .firmas { display: flex; gap: 16pt; margin-top: 6pt; }
  .firmas > div { flex: 1; }
  .firma-img { max-height: 55pt; max-width: 100%; border: 1px solid #ccc; }
  .sin-firma { color: #999; font-style: italic; }
  .pie { margin-top: 14pt; font-size: 8pt; color: #777; border-top: 1px solid #ccc; padding-top: 4pt; }
  .vacio { color: #999; }
  table.tripulacion { width: 100%; border-collapse: collapse; }
  table.tripulacion td { padding: 2pt 4pt; }
  table.tripulacion td.etiqueta { color: #555; width: 35%; white-space: nowrap; }
</style>
</head>
<body>
 
<div class="membrete">
  <img src="{{ logo_data_uri }}" alt="Logo L.A.F.S. Ambulancias">
  <div class="razon-social">
    <h1>L.A.F.S. AMBULANCIAS S.A.S.</h1>
    <p class="nit">NIT: {{ nit }}</p>
    <p class="titulo">TRASLADO ASISTENCIAL DE PACIENTES</p>
  </div>
  <div class="codigo-wrap">
    <table class="codigo">
      <tr><td class="etiqueta">Código</td><td>{{ codigo_formato }}</td></tr>
      <tr><td class="etiqueta">Versión</td><td>{{ version_formato }}</td></tr>
      <tr><td class="etiqueta">Fecha</td><td>{{ fecha_version_formato }}</td></tr>
      <tr><td class="etiqueta">Páginas</td><td>{{ paginas_formato }}</td></tr>
    </table>
  </div>
</div>
 
<div class="estado-digital">
  <p class="subtitulo" style="margin:0;">Atención #{{ atencion_id }} — generado por el sistema</p>
  <div class="estado {{ 'cerrado' if cerrada else 'borrador' }}">
    {{ 'CERRADO' if cerrada else 'BORRADOR — AÚN ABIERTO' }}
  </div>
</div>
 
<h2>Datos del paciente</h2>
<table class="datos">
  <tr>
    <td class="etiqueta">Documento</td><td>{{ paciente_tipo_documento }} {{ paciente_numero_documento }}</td>
    <td class="etiqueta">EPS</td><td>{{ paciente_eps }}</td>
  </tr>
  <tr>
    <td class="etiqueta">Nombres</td><td>{{ paciente_nombres }}</td>
    <td class="etiqueta">Apellidos</td><td>{{ paciente_apellidos }}</td>
  </tr>
  <tr>
    <td class="etiqueta">Edad</td><td>{{ paciente_edad }} años</td>
    <td class="etiqueta">Sexo</td><td>{{ paciente_sexo }}</td>
  </tr>
  <tr>
    <td class="etiqueta">Dirección</td><td>{{ paciente_direccion_residencial }}</td>
    <td class="etiqueta">Ciudad</td><td>{{ paciente_ciudad }}</td>
  </tr>
  <tr>
    <td class="etiqueta">Teléfono</td><td colspan="3">{{ paciente_telefono or '—' }}</td>
  </tr>
</table>
 
<h2>Datos del acompañante</h2>
{% if acompanante_nombres_apellidos %}
<table class="datos">
  <tr>
    <td class="etiqueta">Nombre</td><td>{{ acompanante_nombres_apellidos }}</td>
    <td class="etiqueta">Parentesco</td><td>{{ acompanante_parentesco or '—' }}</td>
  </tr>
  <tr>
    <td class="etiqueta">Teléfono</td><td colspan="3">{{ acompanante_telefono or '—' }}</td>
  </tr>
</table>
{% else %}
<p class="vacio">El paciente viajó sin acompañante.</p>
{% endif %}
 
<h2>Recepción y entrega</h2>
<div class="columnas">
  <div>
    <strong>Recepción (origen)</strong>
    <table class="datos">
      <tr><td class="etiqueta">Fecha/hora</td><td>{{ recepcion_fecha_hora }}</td></tr>
      <tr><td class="etiqueta">Ciudad</td><td>{{ recepcion_ciudad }}</td></tr>
      <tr><td class="etiqueta">IPS</td><td>{{ recepcion_ips }}</td></tr>
      <tr><td class="etiqueta">Servicio</td><td>{{ recepcion_servicio }}</td></tr>
    </table>
  </div>
  <div>
    <strong>Entrega (destino)</strong>
    <table class="datos">
      <tr><td class="etiqueta">Fecha/hora</td><td>{{ entrega_fecha_hora }}</td></tr>
      <tr><td class="etiqueta">Ciudad</td><td>{{ entrega_ciudad }}</td></tr>
      <tr><td class="etiqueta">IPS</td><td>{{ entrega_ips }}</td></tr>
      <tr><td class="etiqueta">Servicio</td><td>{{ entrega_servicio }}</td></tr>
    </table>
  </div>
</div>
 
<h2>Tipo de traslado</h2>
<table class="datos">
  <tr>
    <td class="etiqueta">Complejidad</td><td>{{ complejidad }}</td>
    <td class="etiqueta">Categoría paciente</td><td>{{ categoria_paciente }}</td>
  </tr>
  <tr>
    <td class="etiqueta">Nivel de servicio</td><td>{{ nivel_servicio }}</td>
    <td class="etiqueta">Modalidad</td><td>{{ modalidad }}</td>
  </tr>
</table>
 
<h2>Estado del paciente</h2>
<p>{{ diagnostico or '—' }}</p>
 
<h2>Tratamiento</h2>
<ul class="checklist">
  {% for etiqueta, marcada in tratamiento %}
  <li class="{{ 'marcada' if marcada else '' }}">
    <span class="casilla">{{ 'X' if marcada else '' }}</span>{{ etiqueta }}
  </li>
  {% endfor %}
</ul>
{% if tratamiento_otro %}<p>Otros: {{ tratamiento_otro }}</p>{% endif %}
 
<h2>Reflejo pupilar</h2>
<table class="datos">
  <tr>
    <td class="etiqueta">Derecha</td><td>{{ pupila_derecha or 'Sin registrar' }}</td>
    <td class="etiqueta">Izquierda</td><td>{{ pupila_izquierda or 'Sin registrar' }}</td>
  </tr>
</table>
 
<h2>Signos vitales</h2>
{% if signos_vitales %}
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
{% else %}
<p class="vacio">Sin mediciones registradas.</p>
{% endif %}
 
<h2>Localización de lesiones</h2>
{% if lesiones_localizadas %}
<ol>
  {% for linea in lesiones_localizadas %}<li>{{ linea }}</li>{% endfor %}
</ol>
{% else %}
<p class="vacio">Sin lesiones registradas.</p>
{% endif %}
 
<h2>Escala de Glasgow</h2>
<table class="datos">
  <tr>
    <td class="etiqueta">Ocular</td><td>{{ glasgow_ocular if glasgow_ocular is not none else '—' }}/4</td>
    <td class="etiqueta">Verbal</td><td>{{ glasgow_verbal if glasgow_verbal is not none else '—' }}/5</td>
    <td class="etiqueta">Motora</td><td>{{ glasgow_motora if glasgow_motora is not none else '—' }}/6</td>
  </tr>
  <tr><td class="etiqueta">Total</td><td colspan="5"><strong>{{ glasgow_total if glasgow_total is not none else '—' }}/15</strong></td></tr>
</table>
 
<h2>Insumos entregados por quien refiere</h2>
{% if insumos_entregados %}
<ol>
  {% for insumo in insumos_entregados %}<li>{{ insumo }}</li>{% endfor %}
</ol>
{% else %}
<p class="vacio">Sin insumos registrados.</p>
{% endif %}
 
<h2>Firma y sello profesional que entrega / que recibe</h2>
<div class="firmas">
  <div>
    <strong>Profesional que entrega ({{ entrega_rol }})</strong>
    <p class="etiqueta">{{ entrega_nombre or '—' }}</p>
    {% if firma_entrega %}
      <img class="firma-img" src="{{ firma_entrega }}" alt="Firma de quien entrega">
    {% else %}
      <p class="sin-firma">Sin firma registrada</p>
    {% endif %}
  </div>
  <div>
    <strong>Profesional que recibe (IPS/ESE de destino)</strong>
    <p class="etiqueta">
      {{ profesional_recibe_nombre or '—' }}
      {% if profesional_recibe_cedula %}&middot; C.C. {{ profesional_recibe_cedula }}{% endif %}
    </p>
    {% if firma_profesional_recibe %}
      <img class="firma-img" src="{{ firma_profesional_recibe }}" alt="Firma de quien recibe">
    {% else %}
      <p class="sin-firma">Sin firma registrada</p>
    {% endif %}
  </div>
</div>
 
<h2>Notas de enfermería durante el traslado</h2>
<p>{{ nota_auxiliar or '—' }}</p>
<div class="firmas">
  <div>
    <p class="etiqueta">Atendido por: {{ atendido_por or '—' }}</p>
    {% if firma_atendido_por %}
      <img class="firma-img" src="{{ firma_atendido_por }}" alt="Firma de quien atendió">
    {% else %}
      <p class="sin-firma">Sin firma registrada</p>
    {% endif %}
  </div>
</div>
 
<h2>Evolución médica</h2>
<p>{{ nota_medica or '—' }}</p>
<div class="firmas">
  <div>
    <p class="etiqueta">Evolucionado por: {{ evolucionado_por or '—' }}</p>
    {% if firma_evolucionado_por %}
      <img class="firma-img" src="{{ firma_evolucionado_por }}" alt="Firma de quien evolucionó">
    {% else %}
      <p class="sin-firma">Sin firma registrada</p>
    {% endif %}
  </div>
</div>
 
<h2>Observaciones</h2>
<p>{{ observaciones or '—' }}</p>
 
<h2>Tripulación a cargo del traslado</h2>
<table class="tripulacion">
  <tr><td class="etiqueta">Conductor</td><td>{{ conductor_nombre }} &middot; C.C. {{ conductor_cedula }}</td></tr>
  <tr><td class="etiqueta">Auxiliar de enfermería</td><td>{{ atendido_por or '—' }}</td></tr>
  <tr><td class="etiqueta">Médico</td><td>{{ evolucionado_por or '—' }}</td></tr>
  <tr><td class="etiqueta">Placas del vehículo</td><td>{{ placa }} (móvil {{ movil }})</td></tr>
</table>
 
<p class="pie">
  Generado automáticamente por el sistema L.A.F.S. Ambulancias el {{ generado_en }}.
  {% if cerrada %}Atención cerrada el {{ cerrada_en }}.{% endif %}
</p>
 
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
        # Recepción / entrega
        "recepcion_fecha_hora": _fecha_hora(formato.recepcion_fecha, formato.recepcion_hora),
        "recepcion_ciudad": formato.recepcion_ciudad,
        "recepcion_ips": formato.recepcion_ips,
        "recepcion_servicio": formato.recepcion_servicio,
        "entrega_fecha_hora": _fecha_hora(formato.entrega_fecha, formato.entrega_hora),
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
        "signos_vitales": formato.signos_vitales,
        "lesiones_localizadas": _lesiones_localizadas_texto(formato.lesiones_localizadas),
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
        "insumos_entregados": formato.insumos_entregados,
        # "Profesional que entrega" (issue #66, fin de página 1 del papel)
        "entrega_rol": entrega_rol,
        "entrega_nombre": entrega_nombre,
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
