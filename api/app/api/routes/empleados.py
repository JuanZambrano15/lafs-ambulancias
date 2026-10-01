"""CRUD de empleados — solo administrador (issue #4).
 
El borrado es "soft" (`activo=False`), nunca se borra la fila: un
empleado desactivado puede seguir apareciendo como conductor o
responsable en atenciones pasadas, y borrarlo de verdad rompería ese
historial.
"""
 
from __future__ import annotations
 
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
 
from app.api.deps import DbSession, require_admin
from app.models.empleado import Empleado
from app.schemas.empleado import EmpleadoCreate, EmpleadoOut, EmpleadoUpdate
 
router = APIRouter(prefix="/empleados", tags=["empleados"], dependencies=[Depends(require_admin)])
 
 
def _obtener_empleado(empleado_id: int, db: DbSession) -> Empleado:
    empleado = db.get(Empleado, empleado_id)
    if empleado is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empleado no encontrado")
    return empleado
 
 
@router.get("", response_model=list[EmpleadoOut])
def listar_empleados(db: DbSession, solo_activos: bool = False) -> list[Empleado]:
    query = db.query(Empleado)
    if solo_activos:
        query = query.filter(Empleado.activo.is_(True))
    return list(query.order_by(Empleado.apellidos, Empleado.nombres).all())
 
 
@router.post("", response_model=EmpleadoOut, status_code=status.HTTP_201_CREATED)
def crear_empleado(datos: EmpleadoCreate, db: DbSession) -> Empleado:
    empleado = Empleado(**datos.model_dump())
    db.add(empleado)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un empleado con esa cédula",
        ) from None
    db.refresh(empleado)
    return empleado
 
 
@router.get("/{empleado_id}", response_model=EmpleadoOut)
def obtener_empleado(empleado_id: int, db: DbSession) -> Empleado:
    return _obtener_empleado(empleado_id, db)
 
 
@router.patch("/{empleado_id}", response_model=EmpleadoOut)
def actualizar_empleado(empleado_id: int, datos: EmpleadoUpdate, db: DbSession) -> Empleado:
    empleado = _obtener_empleado(empleado_id, db)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(empleado, campo, valor)
    db.commit()
    db.refresh(empleado)
    return empleado
 
 
@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def desactivar_empleado(empleado_id: int, db: DbSession) -> None:
    empleado = _obtener_empleado(empleado_id, db)
    empleado.activo = False
    db.commit()