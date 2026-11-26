"""Cálculo de la edad del paciente a partir de su fecha de nacimiento.

Los formatos de traslado y de accidente SOAT solo guardan y muestran la
edad en años cumplidos. La fecha de nacimiento es un dato de apoyo: el
administrador recibe la foto de un documento que trae la fecha, no la
edad, así que se puede escribir una u otra y el servidor calcula los
años. La fecha de nacimiento no se guarda ni sale en el PDF.
"""

from __future__ import annotations

from datetime import date


def calcular_edad(nacimiento: date, referencia: date) -> int:
    """Años cumplidos de `nacimiento` a la fecha `referencia`.

    La referencia es la fecha del servicio (recepción del paciente en el
    traslado, fecha de atención en el accidente SOAT), no "hoy": así la
    edad del formato no cambia si se corrige meses después.
    """
    if nacimiento > referencia:
        raise ValueError("La fecha de nacimiento no puede ser posterior a la fecha del servicio")
    cumplio = (referencia.month, referencia.day) >= (nacimiento.month, nacimiento.day)
    return referencia.year - nacimiento.year - (0 if cumplio else 1)