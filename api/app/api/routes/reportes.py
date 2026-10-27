"""Reporte del contador: totales de servicios por persona en un rango
de fechas (issue #24) -- para el tema del pago, cuántos servicios hizo
cada conductor y cada auxiliar/médico responsable, con descarga en
Excel.
 
Solo cuentan las atenciones ya CERRADAS: una recién abierta todavía
puede cambiar o cancelarse, así que no es un servicio "hecho" para
efectos de pago (decisión del cliente, issue #24). El rango filtra por
`cerrada_en` -- la fecha en la que el servicio realmente se completó,
mismo campo que ya usa la lista de servicios cerrados del panel
(`GET /atenciones/cerradas`, issue #15/#80) -- no `abierta_en`, que
podría quedar fuera del rango si el cierre pasó un tiempo después.
 
`desde`/`hasta` son fechas de calendario (sin hora): igual que el
resto del proyecto, que guarda todo en UTC sin manejar explícitamente
la zona horaria de Colombia (ver `datetime.now(UTC)` en todo
`atenciones.py`), el rango se interpreta como ese día calendario en
UTC -- no hay conversión especial acá tampoco.
"""
 
from __future__ import annotations
 
from collections import defaultdict
from datetime import UTC, date, datetime, time
from io import BytesIO
 
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook  # type: ignore[import-untyped]
from openpyxl.styles import Font  # type: ignore[import-untyped]
from openpyxl.worksheet.worksheet import Worksheet  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
 
from app.api.deps import DbSession, require_admin_o_contador
from app.models.atencion import Atencion, EstadoAtencion
from app.models.empleado import Empleado
from app.schemas.reporte import ServicioPorPersona
 
router = APIRouter(
    prefix="/reportes",
    tags=["reportes"],
    dependencies=[Depends(require_admin_o_contador)],
)
 
_ENCABEZADOS = ("Cédula", "Nombres", "Apellidos", "Como conductor", "Como auxiliar/médico", "Total")
_ANCHOS_COLUMNA = (16, 20, 20, 16, 20, 10)
 
 
def _validar_rango(desde: date, hasta: date) -> None:
    if desde > hasta:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'desde' no puede ser posterior a 'hasta'",
        )
 
 
def _calcular_totales(db: Session, desde: date, hasta: date) -> list[ServicioPorPersona]:
    """Trae las atenciones cerradas cuyo `cerrada_en` cae en
    `[desde, hasta]` (límites inclusive, día calendario completo) y
    arma los totales por empleado en Python -- no son tantas filas
    por rango típico (un cierre de nómina quincenal/mensual de 4
    ambulancias) como para justificar un GROUP BY + UNION en SQL
    entre `conductor_id` y `responsable_id`.
    """
    inicio = datetime.combine(desde, time.min, tzinfo=UTC)
    fin = datetime.combine(hasta, time.max, tzinfo=UTC)
    atenciones = (
        db.execute(
            select(Atencion)
            .options(joinedload(Atencion.conductor), joinedload(Atencion.responsable))
            .where(
                Atencion.estado == EstadoAtencion.cerrado,
                Atencion.cerrada_en >= inicio,
                Atencion.cerrada_en <= fin,
            )
        )
        .unique()
        .scalars()
        .all()
    )
 
    empleados: dict[int, Empleado] = {}
    como_conductor: dict[int, int] = defaultdict(int)
    como_responsable: dict[int, int] = defaultdict(int)
    for atencion in atenciones:
        empleados[atencion.conductor_id] = atencion.conductor
        como_conductor[atencion.conductor_id] += 1
        empleados[atencion.responsable_id] = atencion.responsable
        como_responsable[atencion.responsable_id] += 1
 
    filas = [
        ServicioPorPersona(
            empleado_id=empleado_id,
            cedula=empleado.cedula,
            nombres=empleado.nombres,
            apellidos=empleado.apellidos,
            como_conductor=como_conductor[empleado_id],
            como_responsable=como_responsable[empleado_id],
            total=como_conductor[empleado_id] + como_responsable[empleado_id],
        )
        for empleado_id, empleado in empleados.items()
    ]
    filas.sort(key=lambda fila: (fila.apellidos.lower(), fila.nombres.lower()))
    return filas
 
 
def _armar_libro(filas: list[ServicioPorPersona]) -> Worksheet:
    libro = Workbook()
    hoja = libro.active
    assert hoja is not None  # `Workbook()` siempre trae una hoja activa.
    hoja.title = "Servicios por persona"
    hoja.append(_ENCABEZADOS)
    for celda in hoja[1]:
        celda.font = Font(bold=True)
    for fila in filas:
        hoja.append(
            (
                fila.cedula,
                fila.nombres,
                fila.apellidos,
                fila.como_conductor,
                fila.como_responsable,
                fila.total,
            )
        )
    for columna, ancho in zip(hoja.columns, _ANCHOS_COLUMNA, strict=True):
        hoja.column_dimensions[columna[0].column_letter].width = ancho
    return hoja
 
 
@router.get("/servicios-por-persona", response_model=list[ServicioPorPersona])
def reporte_servicios_por_persona(
    db: DbSession,
    desde: date,
    hasta: date,
) -> list[ServicioPorPersona]:
    """Totales de servicios cerrados por persona (como conductor y
    como responsable) en `[desde, hasta]`, para la pantalla del
    reporte en el panel (issue #24).
    """
    _validar_rango(desde, hasta)
    return _calcular_totales(db, desde, hasta)
 
 
@router.get("/servicios-por-persona.xlsx")
def reporte_servicios_por_persona_excel(
    db: DbSession,
    desde: date,
    hasta: date,
) -> StreamingResponse:
    """Igual que `reporte_servicios_por_persona`, como archivo de
    Excel descargable -- el pedido explícito del cliente para el
    issue #24, no solo verlo en pantalla.
    """
    _validar_rango(desde, hasta)
    filas = _calcular_totales(db, desde, hasta)
    hoja = _armar_libro(filas)
 
    buffer = BytesIO()
    hoja.parent.save(buffer)
    buffer.seek(0)
 
    nombre_archivo = f"servicios-por-persona_{desde.isoformat()}_{hasta.isoformat()}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )