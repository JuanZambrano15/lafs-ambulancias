"""Chequeo de insumos y medicamentos que hace el auxiliar (issue #20).

Igual que `ChequeoVehiculo`: por ambulancia, no por paciente. Los ítems
se guardan en JSON con una copia de lo que el catálogo decía en ese
momento (nombre, categoría, mínimo), para que el historial no cambie si
después el administrador edita el catálogo.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ambulancia import Ambulancia
    from app.models.empleado import Empleado


class ChequeoInsumos(Base):
    __tablename__ = "chequeo_insumos"

    id: Mapped[int] = mapped_column(primary_key=True)

    ambulancia_id: Mapped[int] = mapped_column(ForeignKey("ambulancia.id"), index=True)
    # El auxiliar que hizo el chequeo (el empleado ligado al usuario).
    auxiliar_id: Mapped[int] = mapped_column(ForeignKey("empleado.id"))
    ambulancia: Mapped[Ambulancia] = relationship()
    auxiliar: Mapped[Empleado] = relationship()

    realizado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    # [{"insumo_id", "categoria", "nombre", "unidad", "minimo",
    #   "encontrado", "faltante"}, ...]
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    observaciones: Mapped[str | None] = mapped_column(Text, default=None)

    # Redundantes con `items`, para filtrar sin abrir el JSON (los usan
    # las alertas del issue #21 y las existencias del #23).
    tiene_faltantes: Mapped[bool] = mapped_column(Boolean, default=False)
    total_faltantes: Mapped[int] = mapped_column(Integer, default=0)