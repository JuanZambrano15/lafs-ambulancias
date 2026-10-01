"""Esquemas para el CRUD de empleados (solo administrador, issue #4)."""
 
from __future__ import annotations
 
from pydantic import BaseModel, ConfigDict, Field
 
from app.models.empleado import TipoVinculacion
 
 
class EmpleadoCreate(BaseModel):
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    cedula: str = Field(min_length=5, max_length=20)
    telefono: str | None = Field(default=None, max_length=20)
    tipo_vinculacion: TipoVinculacion = TipoVinculacion.planta
 
 
class EmpleadoUpdate(BaseModel):
    nombres: str | None = Field(default=None, min_length=1, max_length=100)
    apellidos: str | None = Field(default=None, min_length=1, max_length=100)
    telefono: str | None = Field(default=None, max_length=20)
    tipo_vinculacion: TipoVinculacion | None = None
 
 
class EmpleadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    nombres: str
    apellidos: str
    cedula: str
    telefono: str | None
    tipo_vinculacion: TipoVinculacion
    activo: bool