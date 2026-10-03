"""Esquemas para el CRUD de ambulancias (issue #5).
 
Escriben solo administradores; el contador solo puede consultar (ver
`require_admin_o_contador` en `app/api/deps.py`).
"""
 
from __future__ import annotations
 
from datetime import date
 
from pydantic import BaseModel, ConfigDict, Field
 
from app.models.ambulancia import TipoAmbulancia
 
 
class AmbulanciaCreate(BaseModel):
    movil: str = Field(min_length=1, max_length=20)
    placa: str = Field(min_length=1, max_length=10)
    tipo: TipoAmbulancia
    vencimiento_soat: date
    vencimiento_tecnomecanica: date
 
 
class AmbulanciaUpdate(BaseModel):
    movil: str | None = Field(default=None, min_length=1, max_length=20)
    placa: str | None = Field(default=None, min_length=1, max_length=10)
    tipo: TipoAmbulancia | None = None
    vencimiento_soat: date | None = None
    vencimiento_tecnomecanica: date | None = None
 
 
class AmbulanciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    movil: str
    placa: str
    tipo: TipoAmbulancia
    vencimiento_soat: date
    vencimiento_tecnomecanica: date
    activa: bool