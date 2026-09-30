"""Tabla intermedia usuario↔rol.

Se modela como objeto de asociación (no como `Table` simple de
many-to-many) por si más adelante hace falta guardar algo sobre la
asignación misma (quién lo asignó, desde cuándo) — agregar una columna
ahí es trivial; migrar de `Table` a objeto de asociación después no lo
es.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.rol import Rol
    from app.models.usuario import Usuario


class UsuarioRol(Base):
    __tablename__ = "usuario_rol"

    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"), primary_key=True)
    rol_id: Mapped[int] = mapped_column(ForeignKey("rol.id"), primary_key=True)

    usuario: Mapped[Usuario] = relationship(back_populates="roles")
    rol: Mapped[Rol] = relationship(back_populates="usuarios")