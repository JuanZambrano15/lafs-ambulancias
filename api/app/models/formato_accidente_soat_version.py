"""Versión anterior de un formato de accidente SOAT, guardada justo
antes de una corrección post-cierre (issue #17, mismo mecanismo que
`FormatoVersion` para traslado — issue #14, ADR-0012).

Esta es también la vía por la que un paciente NN (ADR-0002) pasa a
tener sus datos reales: completar su identidad después del cierre es
una corrección como cualquier otra, y el estado "todavía NN" que tenía
el formato queda preservado acá antes de sobreescribirlo.

Mismo criterio que `FormatoVersion`: todas las columnas nullable (es
un archivo histórico de solo lectura, no una entidad con sus propias
reglas de negocio) y sin PDF (no aplica — este formato todavía no
genera PDF, ver `formato_accidente_soat.py`).
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.formato_accidente_soat import RolVictima, TriageNivel
from app.models.formato_traslado import ReflejoPupilar, SexoPaciente, TipoDocumentoPaciente

if TYPE_CHECKING:
    from app.models.atencion import Atencion
    from app.models.usuario import Usuario


class FormatoAccidenteSoatVersion(Base):
    __tablename__ = "formato_accidente_soat_version"

    id: Mapped[int] = mapped_column(primary_key=True)
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atencion.id"), index=True)
    atencion: Mapped[Atencion] = relationship()

    corregido_por_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    corregido_por: Mapped[Usuario] = relationship()
    corregido_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # --- Mismas columnas que FormatoAccidenteSoat (ver ese modelo
    # para el significado de cada una), todas nullable acá.
    fecha_atencion: Mapped[date | None] = mapped_column(Date, default=None)
    hora_atencion: Mapped[time | None] = mapped_column(Time, default=None)
    hora_entrega: Mapped[time | None] = mapped_column(Time, default=None)

    identificado: Mapped[bool | None] = mapped_column(Boolean, default=None)
    paciente_tipo_documento: Mapped[TipoDocumentoPaciente | None] = mapped_column(
        Enum(TipoDocumentoPaciente, name="tipo_documento_paciente"), default=None
    )
    paciente_numero_documento: Mapped[str | None] = mapped_column(String(20), default=None)
    paciente_documento_expedido_en: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_aseguradora: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_nombres: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_apellidos: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_edad: Mapped[int | None] = mapped_column(Integer, default=None)
    paciente_sexo: Mapped[SexoPaciente | None] = mapped_column(
        Enum(SexoPaciente, name="sexo_paciente"), default=None
    )

    lugar_ocurrencia: Mapped[str | None] = mapped_column(String(255), default=None)
    ciudad: Mapped[str | None] = mapped_column(String(100), default=None)
    telefono_contacto: Mapped[str | None] = mapped_column(String(20), default=None)
    rol_victima: Mapped[RolVictima | None] = mapped_column(
        Enum(RolVictima, name="rol_victima"), default=None
    )
    poliza_vigente_desde: Mapped[date | None] = mapped_column(Date, default=None)
    poliza_vigente_hasta: Mapped[date | None] = mapped_column(Date, default=None)
    vehiculo_placa: Mapped[str | None] = mapped_column(String(10), default=None)
    vehiculo_tipo: Mapped[str | None] = mapped_column(String(50), default=None)
    vehiculo_marca: Mapped[str | None] = mapped_column(String(50), default=None)
    numero_poliza: Mapped[str | None] = mapped_column(String(50), default=None)

    tratamiento: Mapped[list[str]] = mapped_column(JSON, default=list)
    tratamiento_otro: Mapped[str | None] = mapped_column(String(255), default=None)

    pupila_derecha: Mapped[ReflejoPupilar | None] = mapped_column(
        Enum(ReflejoPupilar, name="reflejo_pupilar"), default=None
    )
    pupila_izquierda: Mapped[ReflejoPupilar | None] = mapped_column(
        Enum(ReflejoPupilar, name="reflejo_pupilar"), default=None
    )

    signos_vitales: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    lesiones: Mapped[list[str]] = mapped_column(JSON, default=list)
    lesion_otro: Mapped[str | None] = mapped_column(String(255), default=None)

    glasgow_ocular: Mapped[int | None] = mapped_column(Integer, default=None)
    glasgow_verbal: Mapped[int | None] = mapped_column(Integer, default=None)
    glasgow_motora: Mapped[int | None] = mapped_column(Integer, default=None)

    triage: Mapped[TriageNivel | None] = mapped_column(
        Enum(TriageNivel, name="triage_nivel"), default=None
    )
    descripcion: Mapped[str | None] = mapped_column(Text, default=None)

    profesional_recibe_nombre: Mapped[str | None] = mapped_column(String(150), default=None)
    profesional_recibe_cedula: Mapped[str | None] = mapped_column(String(20), default=None)