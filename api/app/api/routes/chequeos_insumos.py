"""Chequeo semanal de insumos y medicamentos (issue #20).

El auxiliar de enfermería elige el móvil y escribe cuántas unidades de
cada ítem del catálogo encontró; el sistema las compara con el mínimo
del móvil y marca los faltantes. El administrador consulta el estado de
cada móvil y el historial. No genera PDF.

Quedan fuera (issues propios): las alertas por faltantes (#21), los
lotes y vencimientos (#22) y el control de existencias (#23).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DbSession, require_admin, require_roles
from app.core.chequeo_insumos import FRECUENCIA_CHEQUEO_DIAS, dias_desde, es_faltante
from app.models.ambulancia import Ambulancia
from app.models.chequeo_insumos import ChequeoInsumos
from app.models.empleado import Empleado
from app.models.insumo_catalogo import InsumoCatalogo
from app.schemas.insumos import (
    CatalogoChequeoInsumosOut,
    ChequeoInsumosCreate,
    ChequeoInsumosOut,
    ChequeoInsumosResumen,
    EstadoInsumosMovil,
    UltimoChequeoInsumos,
)

router = APIRouter(prefix="/chequeos-insumos", tags=["chequeos-insumos"])

require_auxiliar = require_roles("auxiliar_enfermeria")
# Ver el estado por móvil: quien hace el chequeo y quien lo supervisa.
require_ver_estado = require_roles("administrador", "auxiliar_enfermeria")


def _nombre(empleado: Empleado) -> str:
    return f"{empleado.nombres} {empleado.apellidos}"


def _resumen(chequeo: ChequeoInsumos) -> ChequeoInsumosResumen:
    return ChequeoInsumosResumen(
        id=chequeo.id,
        ambulancia_id=chequeo.ambulancia_id,
        movil=chequeo.ambulancia.movil,
        auxiliar_nombre=_nombre(chequeo.auxiliar),
        realizado_en=chequeo.realizado_en,
        tiene_faltantes=chequeo.tiene_faltantes,
        total_faltantes=chequeo.total_faltantes,
    )


def _detalle(chequeo: ChequeoInsumos) -> ChequeoInsumosOut:
    return ChequeoInsumosOut(
        id=chequeo.id,
        ambulancia_id=chequeo.ambulancia_id,
        movil=chequeo.ambulancia.movil,
        auxiliar_id=chequeo.auxiliar_id,
        auxiliar_nombre=_nombre(chequeo.auxiliar),
        realizado_en=chequeo.realizado_en,
        items=chequeo.items,  # type: ignore[arg-type]
        observaciones=chequeo.observaciones,
        tiene_faltantes=chequeo.tiene_faltantes,
        total_faltantes=chequeo.total_faltantes,
    )


@router.get(
    "/moviles",
    response_model=list[EstadoInsumosMovil],
    dependencies=[Depends(require_ver_estado)],
)
def estado_por_movil(db: DbSession) -> list[EstadoInsumosMovil]:
    ambulancias = db.scalars(
        select(Ambulancia).where(Ambulancia.activa.is_(True)).order_by(Ambulancia.movil)
    ).all()
    resultado: list[EstadoInsumosMovil] = []
    for a in ambulancias:
        total_items = len(
            db.scalars(select(InsumoCatalogo.id).where(InsumoCatalogo.ambulancia_id == a.id)).all()
        )
        ultimo = db.scalars(
            select(ChequeoInsumos)
            .options(joinedload(ChequeoInsumos.auxiliar))
            .where(ChequeoInsumos.ambulancia_id == a.id)
            .order_by(ChequeoInsumos.realizado_en.desc())
            .limit(1)
        ).first()
        dias = dias_desde(ultimo.realizado_en) if ultimo else None
        resultado.append(
            EstadoInsumosMovil(
                ambulancia_id=a.id,
                movil=a.movil,
                placa=a.placa,
                total_items=total_items,
                frecuencia_dias=FRECUENCIA_CHEQUEO_DIAS,
                ultimo_chequeo=(
                    UltimoChequeoInsumos(
                        id=ultimo.id,
                        realizado_en=ultimo.realizado_en,
                        auxiliar_nombre=_nombre(ultimo.auxiliar),
                        tiene_faltantes=ultimo.tiene_faltantes,
                        total_faltantes=ultimo.total_faltantes,
                    )
                    if ultimo
                    else None
                ),
                dias_desde_chequeo=dias,
                chequeo_al_dia=dias is not None and dias < FRECUENCIA_CHEQUEO_DIAS,
            )
        )
    return resultado


@router.get(
    "/formulario",
    response_model=CatalogoChequeoInsumosOut,
    dependencies=[Depends(require_auxiliar)],
)
def obtener_formulario(ambulancia_id: int, db: DbSession) -> CatalogoChequeoInsumosOut:
    """Lo que el auxiliar debe contar en ese móvil."""
    if db.get(Ambulancia, ambulancia_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ambulancia no encontrada")
    items = db.scalars(
        select(InsumoCatalogo)
        .where(InsumoCatalogo.ambulancia_id == ambulancia_id)
        .order_by(InsumoCatalogo.orden, InsumoCatalogo.id)
    ).all()
    return CatalogoChequeoInsumosOut(
        frecuencia_dias=FRECUENCIA_CHEQUEO_DIAS,
        items=items,  # type: ignore[arg-type]
    )


@router.post("", response_model=ChequeoInsumosOut, status_code=status.HTTP_201_CREATED)
def crear_chequeo(
    datos: ChequeoInsumosCreate,
    usuario: CurrentUser,
    db: DbSession,
    _: None = Depends(require_auxiliar),
) -> ChequeoInsumosOut:
    if usuario.empleado_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Tu usuario no está vinculado a un empleado, no puedes hacer el chequeo",
        )
    auxiliar = db.get(Empleado, usuario.empleado_id)
    if auxiliar is None or not auxiliar.activo:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="El empleado ligado a tu usuario no está activo"
        )
    ambulancia = db.get(Ambulancia, datos.ambulancia_id)
    if ambulancia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ambulancia no encontrada")
    if not ambulancia.activa:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Esa ambulancia no está activa")

    catalogo = {
        i.id: i
        for i in db.scalars(
            select(InsumoCatalogo)
            .where(InsumoCatalogo.ambulancia_id == ambulancia.id)
            .order_by(InsumoCatalogo.orden, InsumoCatalogo.id)
        ).all()
    }
    if not catalogo:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                "Ese móvil todavía no tiene catálogo de insumos; "
                "pídele al administrador que lo cargue"
            ),
        )
    enviados = {i.insumo_id: i.encontrado for i in datos.items}
    if len(enviados) != len(datos.items) or set(enviados) != set(catalogo):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El chequeo debe traer cada ítem del catálogo del móvil exactamente una vez",
        )

    items = [
        {
            "insumo_id": i.id,
            "categoria": i.categoria,
            "nombre": i.nombre,
            "unidad": i.unidad,
            "minimo": i.minimo,
            "encontrado": enviados[i.id],
            "faltante": es_faltante(enviados[i.id], i.minimo),
        }
        for i in catalogo.values()
    ]
    total_faltantes = sum(1 for i in items if i["faltante"])
    chequeo = ChequeoInsumos(
        ambulancia_id=ambulancia.id,
        auxiliar_id=auxiliar.id,
        realizado_en=datetime.now(UTC),
        items=items,
        observaciones=(datos.observaciones or "").strip() or None,
        tiene_faltantes=total_faltantes > 0,
        total_faltantes=total_faltantes,
    )
    db.add(chequeo)
    db.commit()
    db.refresh(chequeo)
    return _detalle(chequeo)


@router.get(
    "",
    response_model=list[ChequeoInsumosResumen],
    dependencies=[Depends(require_admin)],
)
def listar_chequeos(
    db: DbSession, ambulancia_id: int | None = None, limite: int = 50
) -> list[ChequeoInsumosResumen]:
    consulta = (
        select(ChequeoInsumos)
        .options(joinedload(ChequeoInsumos.ambulancia), joinedload(ChequeoInsumos.auxiliar))
        .order_by(ChequeoInsumos.realizado_en.desc())
        .limit(max(1, min(limite, 200)))
    )
    if ambulancia_id is not None:
        consulta = consulta.where(ChequeoInsumos.ambulancia_id == ambulancia_id)
    return [_resumen(c) for c in db.scalars(consulta).all()]


@router.get(
    "/{chequeo_id}", response_model=ChequeoInsumosOut, dependencies=[Depends(require_admin)]
)
def obtener_chequeo(chequeo_id: int, db: DbSession) -> ChequeoInsumosOut:
    chequeo = db.get(ChequeoInsumos, chequeo_id)
    if chequeo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Chequeo no encontrado")
    return _detalle(chequeo)