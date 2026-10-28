"""Esquemas del reporte del contador (issue #24): totales de servicios
por persona en un rango de fechas, desglosados por tipo de servicio,
y el detalle de viajes por persona (issue #25).
"""
 
from __future__ import annotations
 
from datetime import date
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
 
 
class ViajeDetalle(BaseModel):
    """Una fila del drill-down (issue #25): un viaje puntual de un
    empleado, en la función por la que se pidió el detalle. Solo lo
    que pide el issue -- origen, destino, paciente, cédula y fecha --
    sin el formato completo ni datos clínicos.
 
    En un servicio SOAT no hay "destino" en el papel (solo el lugar
    del accidente), así que queda como "No aplica"; y el paciente
    puede ser NN (sin identificar todavía), en cuyo caso se muestra
    así y la cédula queda vacía -- ambas decisiones del cliente para
    este issue.
    """
 
    atencion_id: int
    fecha: date
    origen: str
    destino: str
    paciente: str
    cedula: str