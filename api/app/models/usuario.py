"""Credenciales de acceso al sistema.

`password_hash` se llena con `hash_secret()` de `app.core.security`
(Argon2id) — nunca se guarda ni se compara la contraseña en texto
plano en ningún punto del código.

`pin_hash` es el PIN de firma para cerrar formatos (issue #3/#12),
hasheado por separado de la contraseña: comprometer uno no compromete
el otro (ver SECURITY.md).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.usuario_rol import UsuarioRol


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    documento: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    pin_hash: Mapped[str | None] = mapped_column(String(255), default=None)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Nullable: el administrador del sistema no siempre corresponde a
    # un "empleado" operativo de la empresa (ver nota en empleado.py).
    empleado_id: Mapped[int | None] = mapped_column(
        ForeignKey("empleado.id"), default=None
    )

    roles: Mapped[list[UsuarioRol]] = relationship(
        back_populates="usuario", cascade="all, delete-orphan"
    )
