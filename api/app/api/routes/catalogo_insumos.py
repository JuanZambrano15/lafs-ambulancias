"""Catálogo de insumos y medicamentos por móvil (issue #20).

El administrador mantiene la lista y el mínimo de cada ambulancia. El
auxiliar de enfermería solo la lee (es lo que ve al hacer el chequeo,
ver `chequeos_insumos.py`). Para no digitar ~100 ítems a mano, hay
plantillas con los datos del Excel de inventarios de la empresa.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.api.deps import DbSession, require_admin, require_roles
from app.core.catalogo_insumos_inicial import PLANTILLAS_INSUMOS
from app.models.ambulancia import Ambulancia
from app.models.insumo_catalogo import InsumoCatalogo
from app.schemas.insumos import (
    CargarPlantilla,
    InsumoCreate,
    InsumoOut,
    InsumoUpdate,
    PlantillaOut,
)

router = APIRouter(prefix="/insumos", tags=["insumos"])

require_ver_catalogo = require_roles("administrador", "auxiliar_enfermeria")


def _ambulancia_o_404(db: DbSession, ambulancia_id: int) -> Ambulancia:
    ambulancia = db.get(Ambulancia, ambulancia_id)
    if ambulancia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ambulancia no encontrada")
    return ambulancia


def _insumo_o_404(db: DbSession, insumo_id: int) -> InsumoCatalogo:
    insumo = db.get(InsumoCatalogo, insumo_id)
    if insumo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ítem no encontrado")
    return insumo


def _nombre_repetido(db: DbSession, ambulancia_id: int, nombre: str, excepto: int | None) -> bool:
    consulta = select(InsumoCatalogo.id).where(
        InsumoCatalogo.ambulancia_id == ambulancia_id,
        func.lower(InsumoCatalogo.nombre) == nombre.lower(),
    )
    if excepto is not None:
        consulta = consulta.where(InsumoCatalogo.id != excepto)
    return db.scalars(consulta).first() is not None


def _error_repetido() -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT, detail="Ese móvil ya tiene un ítem con ese nombre"
    )


@router.get("", response_model=list[InsumoOut], dependencies=[Depends(require_ver_catalogo)])
def listar_catalogo(ambulancia_id: int, db: DbSession) -> list[InsumoCatalogo]:
    _ambulancia_o_404(db, ambulancia_id)
    return list(
        db.scalars(
            select(InsumoCatalogo)
            .where(InsumoCatalogo.ambulancia_id == ambulancia_id)
            .order_by(InsumoCatalogo.orden, InsumoCatalogo.id)
        ).all()
    )


@router.get("/plantillas", response_model=list[PlantillaOut], dependencies=[Depends(require_admin)])
def listar_plantillas() -> list[PlantillaOut]:
    return [
        PlantillaOut(clave=clave, nombre=nombre, total=len(filas))
        for clave, (nombre, filas) in PLANTILLAS_INSUMOS.items()
    ]


@router.post(
    "/plantilla",
    response_model=list[InsumoOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def cargar_plantilla(datos: CargarPlantilla, db: DbSession) -> list[InsumoCatalogo]:
    """Llena el catálogo de un móvil con una plantilla. Solo si el móvil
    todavía no tiene ítems, para no pisar lo que el administrador ya
    ajustó."""
    _ambulancia_o_404(db, datos.ambulancia_id)
    if datos.plantilla not in PLANTILLAS_INSUMOS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plantilla no encontrada")
    existentes = db.scalar(
        select(func.count()).where(InsumoCatalogo.ambulancia_id == datos.ambulancia_id)
    )
    if existentes:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Ese móvil ya tiene ítems; la plantilla solo se carga en un catálogo vacío",
        )
    _, filas = PLANTILLAS_INSUMOS[datos.plantilla]
    creados = [
        InsumoCatalogo(
            ambulancia_id=datos.ambulancia_id,
            categoria=categoria,
            nombre=nombre,
            minimo=minimo,
            unidad=unidad,
            orden=posicion,
        )
        for posicion, (categoria, nombre, minimo, unidad) in enumerate(filas, start=1)
    ]
    db.add_all(creados)
    db.commit()
    return creados


@router.post(
    "",
    response_model=InsumoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def crear_insumo(datos: InsumoCreate, db: DbSession) -> InsumoCatalogo:
    _ambulancia_o_404(db, datos.ambulancia_id)
    if _nombre_repetido(db, datos.ambulancia_id, datos.nombre, None):
        raise _error_repetido()
    ultimo = db.scalar(
        select(func.max(InsumoCatalogo.orden)).where(
            InsumoCatalogo.ambulancia_id == datos.ambulancia_id
        )
    )
    insumo = InsumoCatalogo(**datos.model_dump(), orden=(ultimo or 0) + 1)
    db.add(insumo)
    db.commit()
    db.refresh(insumo)
    return insumo


@router.patch("/{insumo_id}", response_model=InsumoOut, dependencies=[Depends(require_admin)])
def editar_insumo(insumo_id: int, datos: InsumoUpdate, db: DbSession) -> InsumoCatalogo:
    insumo = _insumo_o_404(db, insumo_id)
    cambios = datos.model_dump(exclude_unset=True)
    for campo in ("categoria", "nombre", "minimo"):
        if campo in cambios and cambios[campo] is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{campo} no puede ser nulo"
            )
    if "unidad" in cambios:
        cambios["unidad"] = (cambios["unidad"] or "").strip() or None
    nombre = cambios.get("nombre")
    if nombre and _nombre_repetido(db, insumo.ambulancia_id, nombre, insumo.id):
        raise _error_repetido()
    for campo, valor in cambios.items():
        setattr(insumo, campo, valor)
    db.commit()
    db.refresh(insumo)
    return insumo


@router.delete(
    "/{insumo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_admin)],
)
def eliminar_insumo(insumo_id: int, db: DbSession) -> None:
    """Borra el ítem del catálogo. Los chequeos ya hechos no se alteran:
    guardan su propia copia del nombre y del mínimo."""
    db.delete(_insumo_o_404(db, insumo_id))
    db.commit()