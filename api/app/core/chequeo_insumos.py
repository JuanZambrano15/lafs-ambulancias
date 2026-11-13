"""Reglas del chequeo de insumos y medicamentos (issue #20).

La frecuencia es la misma del chequeo del vehículo (una vez por semana,
mientras la gerencia define el tiempo definitivo), así que se reutiliza
esa constante: cambiarla en un solo lugar cambia los dos chequeos.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.chequeo_vehiculo import FRECUENCIA_CHEQUEO_DIAS, hoy_colombia

__all__ = ["FRECUENCIA_CHEQUEO_DIAS", "dias_desde", "es_faltante"]


def es_faltante(encontrado: int, minimo: int) -> bool:
    """Lo encontrado por debajo del mínimo del móvil es un faltante."""
    return encontrado < minimo


def dias_desde(momento: datetime) -> int:
    """Días (fecha de Colombia) transcurridos desde `momento`.

    SQLite (pruebas) devuelve fechas sin zona; Postgres, con zona. Todo
    se guarda en UTC."""
    con_zona = momento if momento.tzinfo else momento.replace(tzinfo=UTC)
    return (hoy_colombia() - hoy_colombia(con_zona)).days