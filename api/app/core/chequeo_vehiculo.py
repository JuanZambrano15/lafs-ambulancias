"""Reglas del chequeo semanal del vehículo (issue #19) y del semáforo de
vencimientos (SOAT y tecnomecánica).

El catálogo sale de la sección de vehículo de la hoja "Lista de chequeo
ambulancia" (Inventarios_ambulancias.xlsx): las 37 filas desde
"Cojinería" hasta "Tacos". Los insumos y medicamentos de esa misma hoja
son el issue #20, no esto.

Los nombres se escriben ya corregidos (en el Excel dice "Bolante",
"cavina", "tracera"...); como el chequeo guarda el texto del ítem tal
cual se mostró, un cambio futuro de redacción no altera los chequeos ya
hechos.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta, timezone

# Cada cuánto debe hacerse el chequeo. Por ahora una vez por semana,
# mientras se define el tiempo definitivo con la gerencia: es la única
# constante a cambiar.
FRECUENCIA_CHEQUEO_DIAS = 7

# Semáforo de vencimientos, en días que faltan: de 15 hacia abajo (o ya
# vencido) rojo; hasta 30 amarillo; más de 30 verde.
DIAS_ROJO = 15
DIAS_AMARILLO = 30

# Colombia no usa horario de verano: UTC-5 fijo todo el año.
_ZONA_COLOMBIA = timezone(timedelta(hours=-5))

ITEMS_CHEQUEO_VEHICULO: tuple[str, ...] = (
    "Cojinería",
    "Volante",
    "Sirena",
    "Radio",
    "Megáfono",
    "Puertas de cabina",
    "Puertas de habitáculo",
    "Espejos laterales",
    "Vidrios puertas de cabina",
    "Vidrios puertas de habitáculo",
    "Direccionales izquierdas",
    "Direccionales derechas",
    "Luces de parqueo",
    "Cinturones de seguridad de cabina",
    "Cinturones de seguridad de habitáculo",
    "Luces frontales altas",
    "Luces frontales bajas",
    "Luces exploradoras",
    "Luces medias",
    "Luces de stop",
    "Baliza",
    "Luces laterales",
    "Luces internas de cabina",
    "Llantas delanteras",
    "Llantas traseras",
    "Llanta de repuesto",
    "Extintores",
    "Tapa del combustible",
    "Nivel de líquido refrigerante",
    "Nivel de líquido de frenos",
    "Nivel de aceite de motor",
    "Defensa delantera",
    "Defensa trasera",
    "Gato hidráulico",
    "Cruceta",
    "Barra del gato",
    "Tacos",
)


def hoy_colombia(ahora: datetime | None = None) -> date:
    """La fecha de hoy en Colombia (el servidor guarda todo en UTC)."""
    return (ahora or datetime.now(UTC)).astimezone(_ZONA_COLOMBIA).date()


def dias_para_vencer(vencimiento: date, hoy: date) -> int:
    """Negativo si ya venció."""
    return (vencimiento - hoy).days


def semaforo_vencimiento(vencimiento: date, hoy: date) -> str:
    dias = dias_para_vencer(vencimiento, hoy)
    if dias <= DIAS_ROJO:
        return "rojo"
    if dias <= DIAS_AMARILLO:
        return "amarillo"
    return "verde"