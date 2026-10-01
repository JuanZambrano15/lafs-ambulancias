"""Personal de la empresa: auxiliares, médicos, conductores, etc.
 
Separado de `Usuario` a propósito: un empleado es una persona real de
la empresa (con cédula, teléfono), mientras que un usuario es una
credencial de acceso al sistema. No todo empleado necesita login (por
ahora), y el administrador del sistema no necesariamente es "empleado"
en el sentido operativo de la empresa.
 
`tipo_vinculacion` existe porque personal ocasional (médicos o
auxiliares que no son de planta) igual puede quedar como conductor o
responsable de una `Atencion` — son `Empleado` igual que cualquier
otro, la vinculación es solo un dato administrativo (issue #4).
"""
 
from __future__ import annotations
 
import enum
 
from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column
 
from app.db.base import Base
 
 
class TipoVinculacion(enum.StrEnum):
    planta = "planta"
    ocasional = "ocasional"
 
 
class Empleado(Base):
    __tablename__ = "empleado"
 
    id: Mapped[int] = mapped_column(primary_key=True)
    nombres: Mapped[str] = mapped_column(String(100))
    apellidos: Mapped[str] = mapped_column(String(100))
    cedula: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    telefono: Mapped[str | None] = mapped_column(String(20), default=None)
    tipo_vinculacion: Mapped[TipoVinculacion] = mapped_column(
        Enum(TipoVinculacion, name="tipo_vinculacion_empleado"),
        default=TipoVinculacion.planta,
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
 
    # La firma reutilizable (personal de planta) llega en el issue #11;
    # se agrega ahí como columna aparte para no adivinar el formato de
    # almacenamiento (URL a archivo vs. blob) antes de tiempo.