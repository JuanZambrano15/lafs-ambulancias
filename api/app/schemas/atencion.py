"""Esquemas para iniciar una atención (issue #7).
 
Solo cubre la creación: elegir móvil, tipo y conductor. El contenido
clínico del formato (traslado o SOAT) llega en los issues #8/#9 y #17 —
esto únicamente abre el registro.
"""
 
from __future__ import annotations
 
from datetime import datetime
 
from pydantic import BaseModel, ConfigDict
 
from app.models.atencion import EstadoAtencion, TipoAtencion
from app.schemas.ambulancia import AmbulanciaOut
from app.schemas.empleado import EmpleadoOut
 
 
class AtencionCreate(BaseModel):
    tipo: TipoAtencion
    ambulancia_id: int
    # El responsable (quien llena el formato) es quien está logueado —
    # no se manda en el body, sale del token. Ver ADR-0005.
    conductor_id: int
 
 
class AtencionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    tipo: TipoAtencion
    estado: EstadoAtencion
    abierta_en: datetime
    cerrada_en: datetime | None
    ambulancia: AmbulanciaOut
    conductor: EmpleadoOut
    responsable: EmpleadoOut