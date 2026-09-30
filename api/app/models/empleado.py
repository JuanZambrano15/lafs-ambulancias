"""Personal de la empresa: auxiliares, médicos, conductores, etc.

Separado de `Usuario` a propósito: un empleado es una persona real de
la empresa (con cédula, teléfono), mientras que un usuario es una
credencial de acceso al sistema. No todo empleado necesita login (por
ahora), y el administrador del sistema no necesariamente es "empleado"
en el sentido operativo de la empresa.
"""

from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Empleado(Base):
    __tablename__ = "empleado"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombres: Mapped[str] = mapped_column(String(100))
    apellidos: Mapped[str] = mapped_column(String(100))
    cedula: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    telefono: Mapped[str | None] = mapped_column(String(20), default=None)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # La firma reutilizable (personal de planta) llega en el issue #11;
    # se agrega ahí como columna aparte para no adivinar el formato de
    # almacenamiento (URL a archivo vs. blob) antes de tiempo.
