"""CRUD de ambulancias (issue #5).
 
Lectura: administrador y contador (el contador la necesita para sus
reportes). Escritura (crear/editar/dar de baja): solo administrador.
 
El borrado es "soft" (`activa=False`), igual que empleados y usuarios:
una ambulancia dada de baja (choque total, venta) no se borra de la
base — puede seguir referenciada desde atenciones pasadas.
"""
 
from __future__ import annotations
 
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
 
from app.api.deps import DbSession, require_admin, require_admin_o_contador
from app.models.ambulancia import Ambulancia
from app.schemas.ambulancia import AmbulanciaCreate, AmbulanciaOut, AmbulanciaUpdate
 
router = APIRouter(prefix="/ambulancias", tags=["ambulancias"])
 
_ambulancia_duplicada = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Ya existe una ambulancia con ese móvil o esa placa",
)
 
 
def _obtener_ambulancia(ambulancia_id: int, db: DbSession) -> Ambulancia:
    ambulancia = db.get(Ambulancia, ambulancia_id)
    if ambulancia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ambulancia no encontrada"
        )
    return ambulancia
 
 
@router.get(
    "",
    response_model=list[AmbulanciaOut],
    dependencies=[Depends(require_admin_o_contador)],
)
def listar_ambulancias(db: DbSession, solo_activas: bool = False) -> list[Ambulancia]:
    query = db.query(Ambulancia)
    if solo_activas:
        query = query.filter(Ambulancia.activa.is_(True))
    return list(query.order_by(Ambulancia.movil).all())
 
 
@router.post(
    "",
    response_model=AmbulanciaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def crear_ambulancia(datos: AmbulanciaCreate, db: DbSession) -> Ambulancia:
    ambulancia = Ambulancia(**datos.model_dump())
    db.add(ambulancia)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _ambulancia_duplicada from None
    db.refresh(ambulancia)
    return ambulancia
 
 
@router.get(
    "/{ambulancia_id}",
    response_model=AmbulanciaOut,
    dependencies=[Depends(require_admin_o_contador)],
)
def obtener_ambulancia(ambulancia_id: int, db: DbSession) -> Ambulancia:
    return _obtener_ambulancia(ambulancia_id, db)
 
 
@router.patch(
    "/{ambulancia_id}",
    response_model=AmbulanciaOut,
    dependencies=[Depends(require_admin)],
)
def actualizar_ambulancia(ambulancia_id: int, datos: AmbulanciaUpdate, db: DbSession) -> Ambulancia:
    ambulancia = _obtener_ambulancia(ambulancia_id, db)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(ambulancia, campo, valor)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _ambulancia_duplicada from None
    db.refresh(ambulancia)
    return ambulancia
 
 
@router.delete(
    "/{ambulancia_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    dependencies=[Depends(require_admin)],
)
def desactivar_ambulancia(ambulancia_id: int, db: DbSession) -> None:
    ambulancia = _obtener_ambulancia(ambulancia_id, db)
    ambulancia.activa = False
    db.commit()