"""Esquemas para el CRUD de roles (solo administrador, issue #4)."""
 
from __future__ import annotations
 
from pydantic import BaseModel, ConfigDict, Field
 
 
class RolCreate(BaseModel):
    nombre: str = Field(min_length=2, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)
 
 
class RolUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)
 
 
class RolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    nombre: str
    descripcion: str | None