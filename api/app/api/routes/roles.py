"""CRUD de roles — solo administrador (issue #4).
 
Los roles existen como filas de tabla (no como Enum de Python) para
que el administrador los pueda gestionar sin un despliegue de código —
ver el docstring de `app/models/rol.py`. Borrar un rol que todavía
tiene usuarios asignados se rechaza con 409: quitarle el rol a todos
esos usuarios de un plumazo es una sorpresa demasiado grande para un
DELETE.
"""
 
from __future__ import annotations
 
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
 
from app.api.deps import DbSession, require_admin
from app.models.rol import Rol
from app.schemas.rol import RolCreate, RolOut, RolUpdate
 
router = APIRouter(prefix="/roles", tags=["roles"], dependencies=[Depends(require_admin)])
 
_rol_duplicado = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Ya existe un rol con ese nombre",
)
 
 
def _obtener_rol(rol_id: int, db: DbSession) -> Rol:
    rol = db.get(Rol, rol_id)
    if rol is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol no encontrado")
    return rol
 
 
@router.get("", response_model=list[RolOut])
def listar_roles(db: DbSession) -> list[Rol]:
    return list(db.query(Rol).order_by(Rol.nombre).all())
 
 
@router.post("", response_model=RolOut, status_code=status.HTTP_201_CREATED)
def crear_rol(datos: RolCreate, db: DbSession) -> Rol:
    rol = Rol(**datos.model_dump())
    db.add(rol)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _rol_duplicado from None
    db.refresh(rol)
    return rol
 
 
@router.get("/{rol_id}", response_model=RolOut)
def obtener_rol(rol_id: int, db: DbSession) -> Rol:
    return _obtener_rol(rol_id, db)
 
 
@router.patch("/{rol_id}", response_model=RolOut)
def actualizar_rol(rol_id: int, datos: RolUpdate, db: DbSession) -> Rol:
    rol = _obtener_rol(rol_id, db)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(rol, campo, valor)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _rol_duplicado from None
    db.refresh(rol)
    return rol
 
 
@router.delete("/{rol_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def eliminar_rol(rol_id: int, db: DbSession) -> None:
    rol = _obtener_rol(rol_id, db)
    if rol.usuarios:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar un rol con usuarios asignados",
        )
    db.delete(rol)
    db.commit()