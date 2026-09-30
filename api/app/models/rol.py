"""Roles del sistema (administrador, auxiliar de enfermería, médico,
conductor, contador).

Se modelan como filas de tabla y no como un Enum de Python porque el
issue #4 pide que el administrador pueda mantenerlos por CRUD — un
Enum obligaría a un cambio de código y una migración por cada rol
nuevo.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.usuario_rol import UsuarioRol


class Rol(Base):
    __tablename__ = "rol"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    descripcion: Mapped[str | None] = mapped_column(String(255), default=None)

    usuarios: Mapped[list[UsuarioRol]] = relationship(back_populates="rol")
