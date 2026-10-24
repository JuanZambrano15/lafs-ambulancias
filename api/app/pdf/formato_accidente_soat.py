"""Genera el PDF del formato de atención de accidentes SOAT
(AA-LAFS-005), issue #71 — ver ADR-0011 (mismo mecanismo que
`formato_traslado.py`: una sola plantilla HTML/Jinja2 + WeasyPrint).
 
`generar_pdf_formato_accidente_soat` es la única función pública:
recibe la `Atencion` y su `FormatoAccidenteSoat` ya cargados (con
`atencion.conductor`/`atencion.ambulancia`/`atencion.responsable`
-- esta última para la cédula del auxiliar, issue #88 -- precargados
en algunas rutas y cargados de forma perezosa en otras; cualquiera de
los dos funciona porque la sesión de SQLAlchemy sigue abierta) y
devuelve los bytes del PDF.
 
Instrucción explícita del cliente para este issue: el PDF tiene que
reproducir el papel real (AA-LAFS-005 v2, una sola página física) línea
por línea -- lo ÚNICO que cambia respecto al papel es "el muñequito del
cuerpo humano": en vez del dibujo realista de un esqueleto, se usa el
mismo mecanismo de `formato_traslado.py` (mismo diagrama base, mismos
colores por lesión, mismo método para ubicar los puntos) -- de ahí que
varios símbolos privados de ese módulo se importen directamente acá en
vez de duplicarlos (`_COLORES_LESION`, `_diagrama_corporal_con_puntos`,
etc.): operan sobre los mismos enums `LesionZona`/`LesionLado`/
`LesionVista`/`LesionTipo`, que este formato ya reutiliza sin duplicar
(ver `app/models/formato_accidente_soat.py`).
 
El papel real es de una sola página, pero el PDF generado por el
sistema agrega una SEGUNDA página -- a pedido explícito del cliente,
no por error -- con "Notas de enfermería"/"Notas del médico" por
separado, la firma de quien atendió/evolucionó y la tripulación a
cargo, exactamente con el mismo diseño visual que la página 2 de
`FormatoTraslado` (el cliente pidió explícitamente "copy-paste" de ese
diseño), con dos diferencias: no lleva "Observaciones" (este formato
no tiene ese campo) y la tripulación sí incluye una fila de Médico
(aunque el papel físico de SOAT no la trae en su propio pie de
página -- ahí sigue solo "profesional que recibe", que se queda en la
página 1 como en el papel real).
 
El código de documento (membrete) se deja con "Páginas: 1", igual que
el papel real, en vez de "2" -- es el único punto donde el PDF generado
difiere en cantidad de páginas de lo que ese campo describe, pero
cambiarlo no fue parte de lo pedido ("el resto queda igual como está
en el PDF") y el papel físico sigue siendo, en efecto, de una sola
página.
"""
 
from __future__ import annotations
 
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
 
from jinja2 import Environment
 
# WeasyPrint no distribuye stubs ni marcador py.typed (ver el mismo
# comentario en formato_traslado.py).
from weasyprint import HTML  # type: ignore[import-untyped]
 
from app.pdf.formato_traslado import (
    _LESION_COLUMNA_DERECHA,
    _LESION_COLUMNA_IZQUIERDA,
    _LOGO_DATA_URI,
    _OJO_DERECHA_DATA_URI,
    _OJO_IZQUIERDA_DATA_URI,
    ETIQUETAS_GLASGOW_MOTORA,
    ETIQUETAS_GLASGOW_OCULAR,
    ETIQUETAS_GLASGOW_VERBAL,
    ETIQUETAS_SEXO,
    ETIQUETAS_TIPO_DOCUMENTO,
    ETIQUETAS_TRATAMIENTO,
    _checklist,
    _checklist_lesiones,
    _checklist_reflejo,
    _diagrama_corporal_con_puntos,
    _lesiones_localizadas_texto,
    _opciones_glasgow,
)
 
if TYPE_CHECKING:
    from app.models.atencion import Atencion
    from app.models.formato_accidente_soat import FormatoAccidenteSoat
 
 
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
 
  /* --- Membrete (idéntico a formato_traslado.py, mismo diseño) --- */
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
 
  .estado-digital { margin-bottom: 4pt; font-size: 7.5pt; color: #555; text-align: right; }
  .estado-digital .estado { font-weight: bold; padding: 1.5pt 6pt; border: 1px solid #333; border-radius: 3pt; }
  .estado-digital .estado.borrador { color: #a15c00; border-color: #a15c00; }
  .estado-digital .estado.cerrado { color: #0a6b2e; border-color: #0a6b2e; }
 
  table.grid { width: 100%; margin-bottom: 3pt; page-break-inside: avoid; break-inside: avoid; }
  table.grid tr, table.grid td { page-break-inside: avoid; break-inside: avoid; }
  table.grid td { border: 1px solid #000; padding: 0.5pt 4pt; vertical-align: top; font-size: 8pt; }
  .barra td, td.barra { background: #FFD966; font-weight: bold; text-align: center; padding: 2pt; }
  .vacio-fila td { font-style: italic; color: #666; text-align: center; }
 
  .casilla { display: inline-block; width: 7pt; height: 7pt; border: 1px solid #000;
             margin-right: 3pt; text-align: center; font-size: 6.5pt; line-height: 7pt;
             font-weight: bold; vertical-align: middle; }
  ul.checklist { list-style: none; margin: 0; padding: 2pt 4pt; }
  ul.checklist li { margin-bottom: 0.8pt; white-space: nowrap; font-size: 7.5pt; line-height: 1.15; }
  ul.checklist-denso { list-style: none; margin: 0; padding: 1pt 3pt; }
  ul.checklist-denso li { margin-bottom: 0.2pt; white-space: nowrap; font-size: 6.8pt; line-height: 1.02; }
  ul.checklist-denso .casilla { width: 6pt; height: 6pt; margin-right: 2pt; }
 
  .punto-lesion { display: inline-block; width: 5pt; height: 5pt; border-radius: 50%;
                  border: 0.5pt solid rgba(0,0,0,0.45); margin-right: 3pt; vertical-align: middle; }
 
  table.columnas { width: 100%; margin-bottom: 3pt; page-break-inside: avoid; break-inside: avoid; }
 
  /* Mismo criterio que formato_traslado.py: "Localización de lesiones"
     (+ diagrama ADELANTE/TRÁS) es una sola caja con rowspan, junto a
     Tratamiento/Reflejo pupilar arriba y Escala de Glasgow abajo. */
  table.maestra-clinica { width: 100%; margin-bottom: 3pt; }
 
  table.signos { width: 100%; }
  table.signos td, table.signos th { border: 1px solid #000; padding: 1.5pt 3pt; text-align: center; font-size: 7.5pt; }
  table.signos th { background: #F2F2F2; font-weight: bold; }
  .glasgow-cabecera { font-weight: bold; text-align: center; background: #F2F2F2; font-size: 7.5pt; }
  .glasgow-total { text-align: center; font-weight: bold; padding: 3pt; }
  ul.checklist-plano { list-style: none; margin: 0; padding: 2pt 4pt; }
  ul.checklist-plano li { margin-bottom: 0.8pt; white-space: nowrap; font-size: 7.5pt; line-height: 1.15; }
  ul.checklist-plano li.glasgow-marcada { font-weight: bold; text-decoration: underline; }
 
  /* --- Firmas --- */
  table.firmas { width: 100%; margin-bottom: 3pt; page-break-inside: avoid; break-inside: avoid; }
  table.firmas td { width: 50%; vertical-align: top; padding: 0; text-align: center;
                            page-break-inside: avoid; break-inside: avoid; }
  .firma-cuerpo { padding: 0 6pt; }
  .firma-linea { border-bottom: 1px solid #000; height: 4pt; margin: 2pt 10pt 1pt; }
  .firma-img { max-height: 13pt; max-width: 90%; margin-top: 1pt; }
  .firma-caption { background: #FFD966; font-weight: bold; font-size: 6.5pt; text-align: center; padding: 1pt; }
  .firma-dato { text-align: left; font-size: 6.6pt; padding: 0.2pt 4pt; }
  .sin-firma { display: block; color: #999; font-style: italic; font-size: 7.5pt; margin-top: 4pt; }
 
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
  <tr><td class="titulo-cell">ATENCIÓN DE ACCIDENTES</td></tr>
</table>
{% endmacro %}
 
<div class="pagina">
{{ membrete() }}
 
<div class="estado-digital">
  Atención #{{ atencion_id }} — generado por el sistema el {{ generado_en }}
  <span class="estado {{ 'cerrado' if cerrada else 'borrador' }}">{{ 'CERRADO' if cerrada else 'BORRADOR — AÚN ABIERTO' }}</span>
</div>
 
<table class="grid">
  <tr>
    <td style="width:9%;"><b>FECHA</b></td>
    <td style="width:22%;">{{ fecha_atencion }}</td>
    <td style="width:17%;"><b>HORA DE ATENCIÓN</b></td>
    <td style="width:14%;">{{ hora_atencion }}</td>
    <td style="width:24%;"><b>HORA DE ENTREGA EN IPS / ESE</b></td>
    <td style="width:14%;">{{ hora_entrega or '—' }}</td>
  </tr>
</table>
 
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
      &nbsp;&nbsp;<b>N°</b>&nbsp;{{ paciente_numero_documento }}
    </td>
    <td><b>DE</b></td>
    <td><b>ASEGURADORA:</b> {{ paciente_aseguradora }}</td>
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
    <td><b>Lugar de ocurrencia</b></td>
    <td>{{ lugar_ocurrencia }}</td>
    <td><b>Ciudad</b></td>
    <td>{{ ciudad }}</td>
  </tr>
  <tr>
    <td><b>Tel</b></td>
    <td colspan="3">{{ telefono_contacto or '—' }}</td>
  </tr>
  <tr>
    <td colspan="3">
      Conductor&nbsp;<span class="casilla">{{ 'X' if rol_victima == 'conductor' else '' }}</span>
      &nbsp;&nbsp;Pasajero&nbsp;<span class="casilla">{{ 'X' if rol_victima == 'pasajero' else '' }}</span>
      &nbsp;&nbsp;Parrillero&nbsp;<span class="casilla">{{ 'X' if rol_victima == 'parrillero' else '' }}</span>
      &nbsp;&nbsp;Peatón&nbsp;<span class="casilla">{{ 'X' if rol_victima == 'peaton' else '' }}</span>
      &nbsp;&nbsp;Otro&nbsp;<span class="casilla">{{ 'X' if rol_victima == 'otro' else '' }}</span>
    </td>
    <!-- Issue #88: iba en dos <td> sueltos (label + valor) además del
    colspan="3" de arriba -- 5 "unidades" de columna en una tabla de 4,
    lo que descuadraba el resto de la tabla en cuanto esta fecha (es
    opcional) tenía un valor real. Mismo patrón que "ASEGURADORA" más
    arriba: label y valor en una sola celda. -->
    <td><b>Vigencia póliza:</b> {{ poliza_vigente_desde or '—' }} / {{ poliza_vigente_hasta or '—' }}</td>
  </tr>
  <tr>
    <td><b>Placa</b></td>
    <td><b>Tipo de vehículo</b></td>
    <td><b>Marca</b></td>
    <td><b>N° Póliza</b>: {{ numero_poliza or '—' }}</td>
  </tr>
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
  <td rowspan="2" style="width:38%; vertical-align:top; padding:0 0 0 2pt;">
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
      <tr>
        <td style="width:50%; text-align:center; background:#FFD966; font-weight:bold; font-size:7pt; padding:1pt;">ADELANTE</td>
        <td style="width:50%; text-align:center; background:#FFD966; font-weight:bold; font-size:7pt; padding:1pt;">TRÁS</td>
      </tr>
      <tr><td colspan="2" style="text-align:center; padding:1pt;">
        <img src="{{ diagrama_corporal_data_uri }}" style="height:140pt;" alt="Diagrama corporal ADELANTE / TRÁS">
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
</table>
 
<table class="grid">
  <tr><td class="barra">Descripción de la atención</td></tr>
  <tr><td>
    TRIAGE:&nbsp;
    I&nbsp;<span class="casilla">{{ 'X' if triage == 'i' else '' }}</span>
    &nbsp;&nbsp;II&nbsp;<span class="casilla">{{ 'X' if triage == 'ii' else '' }}</span>
    &nbsp;&nbsp;III&nbsp;<span class="casilla">{{ 'X' if triage == 'iii' else '' }}</span>
  </td></tr>
  <tr><td style="min-height:60pt;">{{ descripcion or '—' }}</td></tr>
</table>
 
<table class="columnas"><tr>
  <td style="width:55%; padding-right:4pt; vertical-align:top;">
    <table class="tripulacion">
      <tr><td class="tripulacion-etq">Conductor</td><td class="tripulacion-val">{{ conductor_nombre }}</td></tr>
      <tr><td class="tripulacion-etq">C.C.</td><td class="tripulacion-val">{{ conductor_cedula }}</td></tr>
      <tr><td class="tripulacion-etq">Auxiliar</td><td class="tripulacion-val">{{ atendido_por or '' }}</td></tr>
      <tr><td class="tripulacion-etq">C.C.</td><td class="tripulacion-val">{{ atendido_por_cedula if atendido_por else '' }}</td></tr>
      <tr><td class="tripulacion-etq">Placa móvil</td><td class="tripulacion-val">{{ placa }}</td></tr>
    </table>
  </td>
  <td style="width:45%; padding-left:4pt; vertical-align:top; text-align:center;">
    {% if firma_profesional_recibe %}
      <img class="firma-img" src="{{ firma_profesional_recibe }}" alt="Firma de quien recibe" style="max-height:24pt;">
    {% else %}
      <div class="firma-linea" style="margin:10pt 10pt 1pt;"></div>
    {% endif %}
    <div class="firma-caption">FIRMA Y SELLO PROFESIONAL QUE RECIBE</div>
    <div class="firma-dato"><b>NOMBRE:</b> {{ profesional_recibe_nombre or '' }}</div>
    <div class="firma-dato"><b>CEDULA:</b> {{ profesional_recibe_cedula or '' }}</div>
  </td>
</tr></table>
 
</div>
 
<div class="pagina">
{{ membrete() }}
 
<table class="columnas"><tr>
  <td style="width:62%; padding-right:2pt; vertical-align:top;">
    <table class="grid">
      <tr><td class="barra">Notas de enfermería</td></tr>
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
      <tr><td class="barra">Notas del médico</td></tr>
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
 
<div class="tripulacion-titulo">Tripulación a cargo</div>
<table class="tripulacion">
  <tr><td class="tripulacion-etq">Conductor</td><td class="tripulacion-val">{{ conductor_nombre }} &middot; C.C. {{ conductor_cedula }}</td></tr>
  <tr><td class="tripulacion-etq">Auxiliar de enfermería</td><td class="tripulacion-val">{{ atendido_por or '' }}{% if atendido_por and atendido_por_cedula %} &middot; C.C. {{ atendido_por_cedula }}{% endif %}</td></tr>
  <tr><td class="tripulacion-etq">Médico</td><td class="tripulacion-val">{{ evolucionado_por or '' }}</td></tr>
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
 
 
def generar_pdf_formato_accidente_soat(
    atencion: Atencion, formato: FormatoAccidenteSoat
) -> bytes:
    """Renderiza la plantilla HTML con los datos actuales del
    encabezado + parte clínica (issue #71) y la convierte a PDF con
    WeasyPrint -- mismo mecanismo que `generar_pdf_formato_traslado`
    (ver nota de módulo arriba para las decisiones de esta revisión).
    """
    contexto: dict[str, Any] = {
        "atencion_id": atencion.id,
        "cerrada": atencion.estado.value == "cerrado",
        "cerrada_en": atencion.cerrada_en.strftime("%d/%m/%Y %H:%M") if atencion.cerrada_en else None,
        "generado_en": datetime.now(UTC).strftime("%d/%m/%Y %H:%M UTC"),
        # Membrete -- datos fijos del formato en papel.
        "logo_data_uri": _LOGO_DATA_URI,
        "nit": "901535278-5",
        "codigo_formato": "AA-LAFS-005",
        "version_formato": "2",
        "fecha_version_formato": "07/05/2026",
        # El papel físico es de una sola página -- ver nota de módulo
        # sobre por qué este valor no cambia a "2" aunque el PDF
        # generado sí agregue una segunda página.
        "paginas_formato": "1",
        "fecha_atencion": formato.fecha_atencion.strftime("%d/%m/%Y"),
        "hora_atencion": formato.hora_atencion.strftime("%H:%M"),
        "hora_entrega": formato.hora_entrega.strftime("%H:%M") if formato.hora_entrega else None,
        # Paciente -- "paciente_tipo_documento"/"paciente_sexo" pueden
        # ser None (paciente NN sin identificar todavía, ADR-0002).
        "paciente_tipo_documento": (
            ETIQUETAS_TIPO_DOCUMENTO.get(
                formato.paciente_tipo_documento.value, formato.paciente_tipo_documento.value
            )
            if formato.paciente_tipo_documento
            else None
        ),
        "paciente_numero_documento": formato.paciente_numero_documento,
        "paciente_aseguradora": formato.paciente_aseguradora,
        "paciente_nombres": formato.paciente_nombres,
        "paciente_apellidos": formato.paciente_apellidos,
        "paciente_edad": formato.paciente_edad,
        "paciente_sexo": (
            ETIQUETAS_SEXO.get(formato.paciente_sexo.value, formato.paciente_sexo.value)
            if formato.paciente_sexo
            else None
        ),
        "lugar_ocurrencia": formato.lugar_ocurrencia,
        "ciudad": formato.ciudad,
        "telefono_contacto": formato.telefono_contacto,
        "rol_victima": formato.rol_victima.value,
        "poliza_vigente_desde": (
            formato.poliza_vigente_desde.strftime("%d/%m/%Y") if formato.poliza_vigente_desde else None
        ),
        "poliza_vigente_hasta": (
            formato.poliza_vigente_hasta.strftime("%d/%m/%Y") if formato.poliza_vigente_hasta else None
        ),
        "numero_poliza": formato.numero_poliza,
        # Tripulación -- Conductor viene de Atencion (ADR-0006), mismo
        # criterio que FormatoTraslado. "Auxiliar" reutiliza
        # atendido_por, que es texto libre sin cédula propia guardada
        # (mismo comentario que entrega_cedula en formato_traslado.py)
        # -- issue #88: el cliente sí quiere ver esa cédula en el PDF,
        # así que se usa la de `atencion.responsable` (el auxiliar
        # logueado que llenó el formato), asumiendo que coincide con
        # "atendido por" -- igual que ese campo ya se autocompleta con
        # su nombre (ver ClinicoAccidenteSoatPage.tsx). Si alguien
        # edita el nombre a mano a otra persona, la cédula mostrada
        # quedaría desajustada; no hay forma de saberlo desde acá.
        "movil": atencion.ambulancia.movil,
        "placa": atencion.ambulancia.placa,
        "conductor_nombre": f"{atencion.conductor.nombres} {atencion.conductor.apellidos}",
        "conductor_cedula": atencion.conductor.cedula,
        "atendido_por_cedula": atencion.responsable.cedula,
        # Clínico
        "tratamiento": _checklist(formato.tratamiento, ETIQUETAS_TRATAMIENTO),
        "tratamiento_otro": formato.tratamiento_otro,
        "reflejo_filas": _checklist_reflejo(formato.pupila_derecha, formato.pupila_izquierda),
        "signos_vitales": formato.signos_vitales,
        "lesiones_localizadas": _lesiones_localizadas_texto(formato.lesiones_localizadas),
        "lesiones_col_izq": _checklist_lesiones(formato.lesiones_localizadas, _LESION_COLUMNA_IZQUIERDA),
        "lesiones_col_der": _checklist_lesiones(formato.lesiones_localizadas, _LESION_COLUMNA_DERECHA),
        # Issue #71: el "muñequito" -- único cambio pedido respecto al
        # papel real -- reusa tal cual el mecanismo de
        # formato_traslado.py (mismo diagrama base, mismos colores).
        "diagrama_corporal_data_uri": _diagrama_corporal_con_puntos(formato.lesiones_localizadas),
        "ojo_derecha_data_uri": _OJO_DERECHA_DATA_URI,
        "ojo_izquierda_data_uri": _OJO_IZQUIERDA_DATA_URI,
        "glasgow_total": (
            formato.glasgow_ocular + formato.glasgow_verbal + formato.glasgow_motora
            if formato.glasgow_ocular is not None
            and formato.glasgow_verbal is not None
            and formato.glasgow_motora is not None
            else None
        ),
        "glasgow_ocular_opciones": _opciones_glasgow(formato.glasgow_ocular, ETIQUETAS_GLASGOW_OCULAR),
        "glasgow_verbal_opciones": _opciones_glasgow(formato.glasgow_verbal, ETIQUETAS_GLASGOW_VERBAL),
        "glasgow_motora_opciones": _opciones_glasgow(formato.glasgow_motora, ETIQUETAS_GLASGOW_MOTORA),
        "triage": formato.triage.value if formato.triage else None,
        "descripcion": formato.descripcion,
        # "Profesional que recibe" se queda en la página 1, como en el
        # papel real (confirmado con el cliente para este issue).
        "profesional_recibe_nombre": formato.profesional_recibe_nombre,
        "profesional_recibe_cedula": formato.profesional_recibe_cedula,
        "firma_profesional_recibe": formato.firma_profesional_recibe,
        # Página 2 (nueva en este issue, a pedido explícito del cliente
        # -- no existe en el papel físico, ver nota de módulo).
        "nota_auxiliar": formato.nota_auxiliar,
        "atendido_por": formato.atendido_por,
        "firma_atendido_por": formato.firma_atendido_por,
        "nota_medica": formato.nota_medica,
        "evolucionado_por": formato.evolucionado_por,
        "firma_evolucionado_por": formato.firma_evolucionado_por,
    }
 
    html = _PLANTILLA.render(**contexto)
    # `write_pdf` no tiene stubs (ver override de WeasyPrint arriba), así
    # que mypy solo ve `Any` -- se anota el cast explícitamente.
    pdf_bytes: bytes = HTML(string=html).write_pdf()
    return pdf_bytes