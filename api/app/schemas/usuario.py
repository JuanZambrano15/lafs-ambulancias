"""Esquemas para el CRUD de usuarios y asignación de roles (solo
administrador, issue #4).
"""
 
from __future__ import annotations
 
from pydantic import BaseModel, ConfigDict, Field
 
from app.schemas.rol import RolOut
 
 
class UsuarioCreate(BaseModel):
    """La contraseña inicial no la define el admin: se genera igual al
    documento (decisión del 30/09/2026) y el usuario queda obligado a
    cambiarla en su primer login (`debe_cambiar_password`).
    """
 
    documento: str = Field(min_length=5, max_length=20)
    empleado_id: int | None = None
    roles: list[int] = Field(default_factory=list)
 
 
class UsuarioUpdate(BaseModel):
    empleado_id: int | None = None
    activo: bool | None = None
 
 
class AsignarRolesRequest(BaseModel):
    roles: list[int]
 
 
class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    documento: str
    activo: bool
    empleado_id: int | None
    debe_cambiar_password: bool
    roles: list[RolOut]