"""Una atención/servicio: una salida de la ambulancia, con su formato
asociado (traslado, accidente SOAT, etc.).
 
El ciclo de vida `estado` (abierto/cerrado) es la decisión del
ADR-0002 (docs/adr/0002-ciclo-de-vida-del-servicio.md): mientras está
`abierta`, el auxiliar/médico asignado edita el formato libremente y
sin permiso; al cerrarla (acción explícita suya, normalmente al volver
al garaje), cualquier edición posterior requiere autorización del
administrador y queda registrada en `formato_version` (issue #14).
 
Los chequeos de vehículo e insumos (issues #19-#20) NO son un tipo más
de `Atencion`: tienen otra forma (por ambulancia, no por paciente) y se
modelan como sus propias tablas cuando llegue ese issue.
"""
 
from __future__ import annotations
 
import enum
from datetime import datetime
from typing import TYPE_CHECKING
 
from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
 
from app.db.base import Base
 
if TYPE_CHECKING:
    from app.models.ambulancia import Ambulancia
    from app.models.empleado import Empleado
 
 
class TipoAtencion(enum.StrEnum):
    traslado = "traslado"
    atencion_soat = "atencion_soat"
 
 
class EstadoAtencion(enum.StrEnum):
    abierto = "abierto"
    cerrado = "cerrado"
 
 
class Atencion(Base):
    __tablename__ = "atencion"
 
    id: Mapped[int] = mapped_column(primary_key=True)
 
    # Generado en el dispositivo (UUID) cuando la atención se crea sin
    # conexión (issue #10) — permite que el backend detecte un reintento
    # de sincronización y devuelva la fila ya creada en vez de
    # duplicarla. `None` en una atención creada normalmente, en línea
    # (sigue siendo el caso más común). Ver ADR-0008.
    client_id: Mapped[str | None] = mapped_column(String(36), unique=True, default=None)
 
    ambulancia_id: Mapped[int] = mapped_column(ForeignKey("ambulancia.id"))
    conductor_id: Mapped[int] = mapped_column(ForeignKey("empleado.id"))
    # El auxiliar o médico responsable de llenar y cerrar el formato.
    responsable_id: Mapped[int] = mapped_column(ForeignKey("empleado.id"))
 
    ambulancia: Mapped[Ambulancia] = relationship()
    # Dos relaciones distintas hacia Empleado: hace falta `foreign_keys`
    # explícito en cada una para que SQLAlchemy sepa cuál FK usar.
    conductor: Mapped[Empleado] = relationship(foreign_keys=[conductor_id])
    responsable: Mapped[Empleado] = relationship(foreign_keys=[responsable_id])
 
    tipo: Mapped[TipoAtencion] = mapped_column(Enum(TipoAtencion, name="tipo_atencion"))
    estado: Mapped[EstadoAtencion] = mapped_column(
        Enum(EstadoAtencion, name="estado_atencion"),
        default=EstadoAtencion.abierto,
    )
 
    abierta_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cerrada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)