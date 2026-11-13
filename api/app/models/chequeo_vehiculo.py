"""Chequeo semanal del vehículo que hace el conductor (issue #19).

No es un tipo de `Atencion`: es por ambulancia, no por paciente (ver el
docstring de `app/models/atencion.py`). Cada fila es un chequeo
completo; los ítems (catálogo en `app/core/chequeo_vehiculo.py`) se
guardan en JSON con el texto tal cual se mostró, igual que
`signos_vitales` en el formato de traslado.
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ambulancia import Ambulancia
    from app.models.empleado import Empleado


class EstadoItemChequeo(enum.StrEnum):
    bien = "bien"
    falla = "falla"


class ChequeoVehiculo(Base):
    __tablename__ = "chequeo_vehiculo"

    id: Mapped[int] = mapped_column(primary_key=True)

    ambulancia_id: Mapped[int] = mapped_column(ForeignKey("ambulancia.id"), index=True)
    # El conductor que hizo el chequeo (el empleado ligado al usuario).
    conductor_id: Mapped[int] = mapped_column(ForeignKey("empleado.id"))
    ambulancia: Mapped[Ambulancia] = relationship()
    conductor: Mapped[Empleado] = relationship()

    realizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    # [{"item": "Volante", "estado": "bien" | "falla", "observacion": str | None}, ...]
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    observaciones: Mapped[str | None] = mapped_column(Text, default=None)

    # Redundante con `items`, pero deja filtrar chequeos con fallas sin
    # abrir el JSON (lo necesita el issue #21, alertas de chequeo con
    # fallas).
    tiene_fallas: Mapped[bool] = mapped_column(Boolean, default=False)