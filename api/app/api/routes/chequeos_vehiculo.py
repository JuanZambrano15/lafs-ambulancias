"""Chequeo semanal del vehículo (issue #19).

El conductor elige el móvil, ve cuándo vencen su SOAT y su
tecnomecánica y diligencia el checklist. El administrador y el contador
consultan el estado de la flota (semáforo de vigencias + último
chequeo) y el historial. No genera PDF (decisión de la gerencia).
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DbSession, require_admin_o_contador, require_roles
from app.core.chequeo_vehiculo import (
    FRECUENCIA_CHEQUEO_DIAS,
    ITEMS_CHEQUEO_VEHICULO,
    dias_para_vencer,
    hoy_colombia,
    semaforo_vencimiento,
)
from app.models.ambulancia import Ambulancia
from app.models.chequeo_vehiculo import ChequeoVehiculo, EstadoItemChequeo
from app.models.empleado import Empleado
from app.schemas.chequeo_vehiculo import (
    CatalogoChequeoOut,
    ChequeoVehiculoCreate,
    ChequeoVehiculoOut,
    ChequeoVehiculoResumen,
    EstadoFlotaOut,
    UltimoChequeo,
)

router = APIRouter(prefix="/chequeos-vehiculo", tags=["chequeos-vehiculo"])

require_conductor = require_roles("conductor")
# Ver el estado de la flota: quien hace el chequeo y quien lo supervisa.
require_ver_flota = require_roles("administrador", "contador", "conductor")


def _nombre(empleado: Empleado) -> str:
    return f"{empleado.nombres} {empleado.apellidos}"


def _total_fallas(chequeo: ChequeoVehiculo) -> int:
    return sum(1 for i in chequeo.items if i.get("estado") == EstadoItemChequeo.falla)


def _resumen(chequeo: ChequeoVehiculo) -> ChequeoVehiculoResumen:
    return ChequeoVehiculoResumen(
        id=chequeo.id,
        ambulancia_id=chequeo.ambulancia_id,
        movil=chequeo.ambulancia.movil,
        conductor_nombre=_nombre(chequeo.conductor),
        realizado_en=chequeo.realizado_en,
        tiene_fallas=chequeo.tiene_fallas,
        total_fallas=_total_fallas(chequeo),
    )


def _detalle(chequeo: ChequeoVehiculo) -> ChequeoVehiculoOut:
    return ChequeoVehiculoOut(
        id=chequeo.id,
        ambulancia_id=chequeo.ambulancia_id,
        movil=chequeo.ambulancia.movil,
        conductor_id=chequeo.conductor_id,
        conductor_nombre=_nombre(chequeo.conductor),
        realizado_en=chequeo.realizado_en,
        items=chequeo.items,  # type: ignore[arg-type]
        observaciones=chequeo.observaciones,
        tiene_fallas=chequeo.tiene_fallas,
        total_fallas=_total_fallas(chequeo),
    )


@router.get(
    "/catalogo",
    response_model=CatalogoChequeoOut,
    dependencies=[Depends(require_conductor)],
)
def obtener_catalogo() -> CatalogoChequeoOut:
    return CatalogoChequeoOut(
        frecuencia_dias=FRECUENCIA_CHEQUEO_DIAS, items=list(ITEMS_CHEQUEO_VEHICULO)
    )


@router.get(
    "/flota",
    response_model=list[EstadoFlotaOut],
    dependencies=[Depends(require_ver_flota)],
)
def estado_de_la_flota(db: DbSession) -> list[EstadoFlotaOut]:
    hoy = hoy_colombia()
    ambulancias = db.scalars(
        select(Ambulancia).where(Ambulancia.activa.is_(True)).order_by(Ambulancia.movil)
    ).all()
    resultado: list[EstadoFlotaOut] = []
    for a in ambulancias:
        ultimo = db.scalars(
            select(ChequeoVehiculo)
            .options(joinedload(ChequeoVehiculo.conductor))
            .where(ChequeoVehiculo.ambulancia_id == a.id)
            .order_by(ChequeoVehiculo.realizado_en.desc())
            .limit(1)
        ).first()
        dias_desde = (
            (hoy - hoy_colombia(_con_zona(ultimo.realizado_en))).days if ultimo else None
        )
        resultado.append(
            EstadoFlotaOut(
                ambulancia_id=a.id,
                movil=a.movil,
                placa=a.placa,
                tipo=a.tipo,
                vencimiento_soat=a.vencimiento_soat,
                dias_soat=dias_para_vencer(a.vencimiento_soat, hoy),
                semaforo_soat=semaforo_vencimiento(a.vencimiento_soat, hoy),  # type: ignore[arg-type]
                vencimiento_tecnomecanica=a.vencimiento_tecnomecanica,
                dias_tecnomecanica=dias_para_vencer(a.vencimiento_tecnomecanica, hoy),
                semaforo_tecnomecanica=semaforo_vencimiento(  # type: ignore[arg-type]
                    a.vencimiento_tecnomecanica, hoy
                ),
                ultimo_chequeo=(
                    UltimoChequeo(
                        id=ultimo.id,
                        realizado_en=ultimo.realizado_en,
                        conductor_nombre=_nombre(ultimo.conductor),
                        tiene_fallas=ultimo.tiene_fallas,
                        total_fallas=_total_fallas(ultimo),
                    )
                    if ultimo
                    else None
                ),
                dias_desde_chequeo=dias_desde,
                chequeo_al_dia=dias_desde is not None and dias_desde < FRECUENCIA_CHEQUEO_DIAS,
            )
        )
    return resultado


def _con_zona(momento: datetime) -> datetime:
    """SQLite (pruebas) devuelve fechas sin zona; Postgres, con zona.
    Todo se guarda en UTC."""
    return momento if momento.tzinfo else momento.replace(tzinfo=UTC)


@router.post("", response_model=ChequeoVehiculoOut, status_code=status.HTTP_201_CREATED)
def crear_chequeo(
    datos: ChequeoVehiculoCreate,
    usuario: CurrentUser,
    db: DbSession,
    _: None = Depends(require_conductor),
) -> ChequeoVehiculoOut:
    if usuario.empleado_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu usuario no está vinculado a un empleado, no puedes hacer el chequeo",
        )
    conductor = db.get(Empleado, usuario.empleado_id)
    if conductor is None or not conductor.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El empleado ligado a tu usuario no está activo",
        )
    ambulancia = db.get(Ambulancia, datos.ambulancia_id)
    if ambulancia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ambulancia no encontrada"
        )
    if not ambulancia.activa:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Esa ambulancia no está activa"
        )

    items = [i.model_dump(mode="json") for i in datos.items]
    chequeo = ChequeoVehiculo(
        ambulancia_id=ambulancia.id,
        conductor_id=conductor.id,
        realizado_en=datetime.now(UTC),
        items=items,
        observaciones=(datos.observaciones or "").strip() or None,
        tiene_fallas=any(i["estado"] == EstadoItemChequeo.falla for i in items),
    )
    db.add(chequeo)
    db.commit()
    db.refresh(chequeo)
    return _detalle(chequeo)


@router.get(
    "",
    response_model=list[ChequeoVehiculoResumen],
    dependencies=[Depends(require_admin_o_contador)],
)
def listar_chequeos(
    db: DbSession, ambulancia_id: int | None = None, limite: int = 50
) -> list[ChequeoVehiculoResumen]:
    consulta = (
        select(ChequeoVehiculo)
        .options(joinedload(ChequeoVehiculo.ambulancia), joinedload(ChequeoVehiculo.conductor))
        .order_by(ChequeoVehiculo.realizado_en.desc())
        .limit(max(1, min(limite, 200)))
    )
    if ambulancia_id is not None:
        consulta = consulta.where(ChequeoVehiculo.ambulancia_id == ambulancia_id)
    return [_resumen(c) for c in db.scalars(consulta).all()]


@router.get(
    "/{chequeo_id}",
    response_model=ChequeoVehiculoOut,
    dependencies=[Depends(require_admin_o_contador)],
)
def obtener_chequeo(chequeo_id: int, db: DbSession) -> ChequeoVehiculoOut:
    chequeo = db.get(ChequeoVehiculo, chequeo_id)
    if chequeo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chequeo no encontrado")
    return _detalle(chequeo)