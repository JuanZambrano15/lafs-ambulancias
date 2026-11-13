"""Catálogo de insumos y medicamentos por móvil, con su mínimo (issue #20).

Cada ambulancia tiene su propia lista (el Excel de inventarios es
distinto para M01, M02 e Iveco). El administrador la mantiene desde el
panel web.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ambulancia import Ambulancia


class InsumoCatalogo(Base):
    __tablename__ = "insumo_catalogo"
    __table_args__ = (
        UniqueConstraint("ambulancia_id", "nombre", name="uq_insumo_ambulancia_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    ambulancia_id: Mapped[int] = mapped_column(ForeignKey("ambulancia.id"), index=True)
    ambulancia: Mapped[Ambulancia] = relationship()

    # Respiratorio, Pediátrico, Circulatorio, Quirúrgico, Trauma, Equipos,
    # Medicamentos... Texto libre: el administrador puede crear categorías.
    categoria: Mapped[str] = mapped_column(String(60))
    nombre: Mapped[str] = mapped_column(String(150))
    # Cuántas unidades debe tener el móvil como mínimo.
    minimo: Mapped[int] = mapped_column(Integer)
    # Solo para mostrar (amp, blíster, vial...). Opcional.
    unidad: Mapped[str | None] = mapped_column(String(30), default=None)
    # Posición dentro de la lista, para conservar el orden del Excel.
    orden: Mapped[int] = mapped_column(Integer, default=0)