"""Versión anterior de un formato de traslado, guardada justo antes de
una corrección post-cierre (issue #14, ADR-0012).
 
Una atención cerrada normalmente no se puede editar (`estado ==
abierto` lo exigen los endpoints de `app/api/routes/atenciones.py`).
La única excepción es el administrador, que puede corregir el
encabezado o la parte clínica de un formato ya cerrado — y cada vez
que lo hace, la fila de `FormatoTraslado` tal como estaba *antes* de
esa corrección se copia acá, sin tocarla después: es un snapshot de
solo lectura, nunca se actualiza ni se borra.
 
`pdf_generado`/`pdf_generado_en` tampoco se versionan: son un
derivado del contenido (ADR-0011), no el contenido en sí — el PDF de
cada versión anterior no es algo que el issue haya pedido conservar,
y guardar binarios grandes en cada corrección es un costo de
almacenamiento que no se justifica sin un pedido explícito.
 
A diferencia de `FormatoTraslado` (donde el encabezado es obligatorio
y el PDF siempre ya pasó por esa validación), todas las columnas acá
son nullable: esto es un archivo histórico, no una entidad con sus
propias reglas de negocio — no tiene sentido que una restricción
NOT NULL haga fallar el guardado de un snapshot de algo que, cuando se
escribió originalmente, sí cumplía esas reglas.
"""
 
from __future__ import annotations
 
from datetime import date, datetime, time
from typing import TYPE_CHECKING, Any
 
from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
 
from app.db.base import Base
from app.models.formato_traslado import (
    CategoriaPaciente,
    ComplejidadTraslado,
    ModalidadTraslado,
    NivelServicioTraslado,
    ReflejoPupilar,
    SexoPaciente,
    TipoDocumentoPaciente,
)
 
if TYPE_CHECKING:
    from app.models.atencion import Atencion
    from app.models.usuario import Usuario
 
 
class FormatoVersion(Base):
    __tablename__ = "formato_version"
 
    id: Mapped[int] = mapped_column(primary_key=True)
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atencion.id"), index=True)
    atencion: Mapped[Atencion] = relationship()
 
    # Quién autorizó la corrección (siempre un administrador, ver
    # ADR-0012) y cuándo — lo único que el cliente pidió conservar
    # sobre el "quién y cuándo", sin motivo en texto libre.
    corregido_por_id: Mapped[int] = mapped_column(ForeignKey("usuario.id"))
    corregido_por: Mapped[Usuario] = relationship()
    corregido_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
 
    # --- Mismas columnas que FormatoTraslado (ver ese modelo para el
    # significado de cada una), menos diagnostico/notas/pdf — todas
    # nullable acá, ver nota de módulo.
    paciente_tipo_documento: Mapped[TipoDocumentoPaciente | None] = mapped_column(
        Enum(TipoDocumentoPaciente, name="tipo_documento_paciente"), default=None
    )
    paciente_numero_documento: Mapped[str | None] = mapped_column(String(20), default=None)
    paciente_eps: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_nombres: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_apellidos: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_edad: Mapped[int | None] = mapped_column(Integer, default=None)
    paciente_sexo: Mapped[SexoPaciente | None] = mapped_column(
        Enum(SexoPaciente, name="sexo_paciente"), default=None
    )
    paciente_direccion_residencial: Mapped[str | None] = mapped_column(String(255), default=None)
    paciente_ciudad: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_telefono: Mapped[str | None] = mapped_column(String(20), default=None)
 
    acompanante_nombres_apellidos: Mapped[str | None] = mapped_column(String(150), default=None)
    acompanante_parentesco: Mapped[str | None] = mapped_column(String(50), default=None)
    acompanante_telefono: Mapped[str | None] = mapped_column(String(20), default=None)
 
    recepcion_fecha: Mapped[date | None] = mapped_column(Date, default=None)
    recepcion_hora: Mapped[time | None] = mapped_column(Time, default=None)
    recepcion_ciudad: Mapped[str | None] = mapped_column(String(100), default=None)
    recepcion_ips: Mapped[str | None] = mapped_column(String(150), default=None)
    recepcion_servicio: Mapped[str | None] = mapped_column(String(100), default=None)
 
    entrega_fecha: Mapped[date | None] = mapped_column(Date, default=None)
    entrega_hora: Mapped[time | None] = mapped_column(Time, default=None)
    entrega_ciudad: Mapped[str | None] = mapped_column(String(100), default=None)
    entrega_ips: Mapped[str | None] = mapped_column(String(150), default=None)
    entrega_servicio: Mapped[str | None] = mapped_column(String(100), default=None)
 
    complejidad: Mapped[ComplejidadTraslado | None] = mapped_column(
        Enum(ComplejidadTraslado, name="complejidad_traslado"), default=None
    )
    categoria_paciente: Mapped[CategoriaPaciente | None] = mapped_column(
        Enum(CategoriaPaciente, name="categoria_paciente"), default=None
    )
    nivel_servicio: Mapped[NivelServicioTraslado | None] = mapped_column(
        Enum(NivelServicioTraslado, name="nivel_servicio_traslado"), default=None
    )
    modalidad: Mapped[ModalidadTraslado | None] = mapped_column(
        Enum(ModalidadTraslado, name="modalidad_traslado"), default=None
    )
 
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
 
    insumos_entregados: Mapped[list[str]] = mapped_column(JSON, default=list)
 
    atendido_por: Mapped[str | None] = mapped_column(String(150), default=None)
    firma_atendido_por: Mapped[str | None] = mapped_column(Text, default=None)
    evolucionado_por: Mapped[str | None] = mapped_column(String(150), default=None)
    firma_evolucionado_por: Mapped[str | None] = mapped_column(Text, default=None)

    # Profesional que recibe en la IPS/ESE de destino (issue #75) --
    # ver FormatoTraslado para el detalle, nullable acá igual que el
    # resto de este historial.
    profesional_recibe_nombre: Mapped[str | None] = mapped_column(String(150), default=None)
    profesional_recibe_cedula: Mapped[str | None] = mapped_column(String(20), default=None)
    firma_profesional_recibe: Mapped[str | None] = mapped_column(Text, default=None)