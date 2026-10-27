"""Esquemas del reporte del contador (issue #24): totales de servicios
por persona en un rango de fechas, desglosados por tipo de servicio.
"""
 
from __future__ import annotations
 
from typing import Literal
 
from pydantic import BaseModel
 
#: La función que tuvo la persona en ese servicio -- conductor o el
#: auxiliar de enfermería/médico responsable (quien llena y cierra el
#: formato). Una misma persona que hizo ambas cosas en el rango
#: aparece en dos filas distintas, una por función (decisión del
#: cliente, issue #24 -- ver mockup que compartió).
Funcion = Literal["conductor", "responsable"]
 
 
class ServicioPorPersona(BaseModel):
    """Una fila del reporte: cuántos servicios cerrados hizo este
    empleado, en esta función, en el rango pedido -- desglosados por
    tipo de servicio (básico y medicalizado son los dos niveles del
    formato de traslado; SOAT es el otro tipo de atención, que no se
    subdivide así).
    """
 
    empleado_id: int
    cedula: str
    nombres: str
    apellidos: str
    funcion: Funcion
    basicos: int
    medicalizados: int
    soat: int
    total: int