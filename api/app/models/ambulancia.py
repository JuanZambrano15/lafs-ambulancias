"""Las 4 ambulancias de la flota (issue #5 les agrega el CRUD)."""

from __future__ import annotations

import enum
from datetime import date

from sqlalchemy import Boolean, Date, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TipoAmbulancia(enum.StrEnum):
    basica = "basica"
    medicalizada = "medicalizada"


class Ambulancia(Base):
    __tablename__ = "ambulancia"

    id: Mapped[int] = mapped_column(primary_key=True)
    movil: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    placa: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    tipo: Mapped[TipoAmbulancia] = mapped_column(Enum(TipoAmbulancia, name="tipo_ambulancia"))
    vencimiento_soat: Mapped[date] = mapped_column(Date)
    vencimiento_tecnomecanica: Mapped[date] = mapped_column(Date)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)