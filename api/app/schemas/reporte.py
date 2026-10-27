"""Esquemas del reporte del contador (issue #24): totales de servicios
por persona en un rango de fechas.
"""
 
from __future__ import annotations
 
from pydantic import BaseModel
 
 
class ServicioPorPersona(BaseModel):
    """Una fila del reporte: cuántos servicios cerrados hizo este
    empleado en el rango pedido, separados según si participó como
    conductor o como responsable (auxiliar de enfermería o médico --
    quien llenó y cerró el formato). Una misma persona puede aparecer
    con ambos conteos en más de cero si alguna vez hizo de las dos
    cosas (p. ej. un conductor que también es auxiliar de enfermería
    en otro servicio).
    """
 
    empleado_id: int
    cedula: str
    nombres: str
    apellidos: str
    como_conductor: int
    como_responsable: int
    total: int