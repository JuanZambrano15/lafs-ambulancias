"""Encabezado del formato de traslado asistencial de pacientes
(TAP-LAFS-002, issue #8): datos del paciente, del acompañante, la
recepción y entrega del paciente, y la clasificación del traslado.
 
Es la primera mitad del formato en papel — la parte clínica
(diagnóstico, tratamiento, signos vitales, lesiones, etc.) llega en el
issue #9, como columnas nuevas en esta misma tabla: es un solo
documento en papel, llenado en dos momentos (ver ADR-0002 sobre el
ciclo de vida del servicio y ADR-0006 sobre este formato).
"""
 
from __future__ import annotations
 
import enum
from datetime import date, time
from typing import TYPE_CHECKING
 
from sqlalchemy import Date, Enum, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
 
from app.db.base import Base
 
if TYPE_CHECKING:
    from app.models.atencion import Atencion
 
 
class TipoDocumentoPaciente(enum.StrEnum):
    rc = "rc"
    ti = "ti"
    cc = "cc"
    ce = "ce"
    ppt = "ppt"
 
 
class SexoPaciente(enum.StrEnum):
    m = "m"
    f = "f"
 
 
class ComplejidadTraslado(enum.StrEnum):
    alta = "alta"
    baja = "baja"
 
 
class CategoriaPaciente(enum.StrEnum):
    neonato = "neonato"
    pediatrico = "pediatrico"
    adulto = "adulto"
 
 
class NivelServicioTraslado(enum.StrEnum):
    """La complejidad del servicio prestado en este traslado — no
    confundir con `Ambulancia.tipo`: el móvil puede ser medicalizado
    pero el nivel que se reporta en el formato de este traslado en
    particular es un campo independiente (así está en el papel).
    """
 
    basico = "basico"
    medicalizado = "medicalizado"
 
 
class ModalidadTraslado(enum.StrEnum):
    sencillo = "sencillo"
    redondo = "redondo"
 
 
class FormatoTraslado(Base):
    __tablename__ = "formato_traslado"
 
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atencion.id"), primary_key=True)
    atencion: Mapped[Atencion] = relationship()
 
    # Datos del paciente. El campo "DE:" (lugar de expedición del
    # documento) que trae el formato en papel se queda por fuera a
    # pedido explícito del cliente.
    paciente_tipo_documento: Mapped[TipoDocumentoPaciente] = mapped_column(
        Enum(TipoDocumentoPaciente, name="tipo_documento_paciente")
    )
    paciente_numero_documento: Mapped[str] = mapped_column(String(20))
    paciente_eps: Mapped[str] = mapped_column(String(100))
    paciente_nombres: Mapped[str] = mapped_column(String(100))
    paciente_apellidos: Mapped[str] = mapped_column(String(100))
    paciente_edad: Mapped[int] = mapped_column(Integer)
    paciente_sexo: Mapped[SexoPaciente] = mapped_column(Enum(SexoPaciente, name="sexo_paciente"))
    paciente_direccion_residencial: Mapped[str] = mapped_column(String(255))
    paciente_ciudad: Mapped[str] = mapped_column(String(100))
    paciente_telefono: Mapped[str | None] = mapped_column(String(20), default=None)
 
    # Datos del acompañante — puede no haber (paciente solo).
    acompanante_nombres_apellidos: Mapped[str | None] = mapped_column(String(150), default=None)
    acompanante_parentesco: Mapped[str | None] = mapped_column(String(50), default=None)
    acompanante_telefono: Mapped[str | None] = mapped_column(String(20), default=None)
 
    # Recepción del paciente: dónde y cuándo lo recibe la tripulación (origen).
    recepcion_fecha: Mapped[date] = mapped_column(Date)
    recepcion_hora: Mapped[time] = mapped_column(Time)
    recepcion_ciudad: Mapped[str] = mapped_column(String(100))
    recepcion_ips: Mapped[str] = mapped_column(String(150))
    recepcion_servicio: Mapped[str] = mapped_column(String(100))
 
    # Entrega del paciente: dónde y cuándo lo entrega la tripulación (destino).
    entrega_fecha: Mapped[date] = mapped_column(Date)
    entrega_hora: Mapped[time] = mapped_column(Time)
    entrega_ciudad: Mapped[str] = mapped_column(String(100))
    entrega_ips: Mapped[str] = mapped_column(String(150))
    entrega_servicio: Mapped[str] = mapped_column(String(100))
 
    complejidad: Mapped[ComplejidadTraslado] = mapped_column(
        Enum(ComplejidadTraslado, name="complejidad_traslado")
    )
    categoria_paciente: Mapped[CategoriaPaciente] = mapped_column(
        Enum(CategoriaPaciente, name="categoria_paciente")
    )
    nivel_servicio: Mapped[NivelServicioTraslado] = mapped_column(
        Enum(NivelServicioTraslado, name="nivel_servicio_traslado")
    )
    modalidad: Mapped[ModalidadTraslado] = mapped_column(
        Enum(ModalidadTraslado, name="modalidad_traslado")
    )