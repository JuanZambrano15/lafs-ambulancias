"""Formato de atención de accidentes SOAT (AA-LAFS-005): encabezado y
parte clínica (issue #17), en la misma tabla — un solo documento en
papel (una sola página física, a diferencia del formato de traslado),
llenado en dos momentos, igual que `FormatoTraslado` (ver ADR-0002,
ADR-0006, ADR-0007 — las mismas decisiones aplican aquí, no se repiten
en cada comentario).

Varias casillas de este formato son idénticas a las del formato de
traslado (tratamiento, reflejo pupilar, lesiones, escala de Glasgow) —
son el mismo check-list que usa la empresa en los dos documentos de
papel, así que se reutilizan los enums de `formato_traslado.py` en vez
de duplicarlos.

Paciente NN (ADR-0002): en un accidente, el paciente puede llegar sin
poder identificarse. `identificado` marca ese caso; mientras sea
`False`, los demás campos de identidad del paciente quedan en blanco
(por eso son nullable, a diferencia de `FormatoTraslado` donde el
paciente siempre se identifica de entrada). Completar los datos reales
más tarde es una corrección post-cierre más, por el mismo mecanismo de
`formato_accidente_soat_version` que cualquier otra — no hay un flujo
especial para "convertir" un NN.

Los datos del conductor y del auxiliar que firman en el papel
("FIRMAS: Conductor ___ C.C. ___ / Auxiliar ___ C.C. ___ / Placa móvil
___") no se repiten acá: ya están en `Atencion.conductor`,
`Atencion.responsable` y `Atencion.ambulancia` — es la misma
tripulación y el mismo móvil de la atención, no un dato nuevo de este
formato. El papel tampoco les pide firma dibujada a ninguno de los
dos (a diferencia de "atendido por"/"evolucionado por" en traslado),
así que esta tabla no tiene columnas de firma para la tripulación.

La única firma que el papel sí pide es la del "profesional que
recibe" en la IPS/ESE — pero, igual que en `FormatoTraslado` (donde
la firma de quien entrega/recibe tampoco se captura, por no ser
personal de LAFS), acá solo se guarda su nombre y cédula, sin firma
dibujada.

El PDF descargable de este formato queda para un issue aparte (igual
que pasó con traslado: issue #13, separado de #8/#9) — por eso esta
tabla todavía no tiene columnas `pdf_generado`/`pdf_generado_en`.
"""

from __future__ import annotations

import enum
from datetime import date, time
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Boolean, Date, Enum, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.formato_traslado import ReflejoPupilar, SexoPaciente, TipoDocumentoPaciente

if TYPE_CHECKING:
    from app.models.atencion import Atencion


class RolVictima(enum.StrEnum):
    """Casillas de "DATOS DEL PACIENTE": qué rol tenía en el accidente."""

    conductor = "conductor"
    pasajero = "pasajero"
    parrillero = "parrillero"
    peaton = "peaton"
    otro = "otro"


class TriageNivel(enum.StrEnum):
    """Casillas de "DESCRIPCIÓN DE LA ATENCIÓN": I ☐ II ☐ III ☐."""

    i = "i"
    ii = "ii"
    iii = "iii"


class FormatoAccidenteSoat(Base):
    __tablename__ = "formato_accidente_soat"

    atencion_id: Mapped[int] = mapped_column(ForeignKey("atencion.id"), primary_key=True)
    atencion: Mapped[Atencion] = relationship()

    # --- Encabezado (issue #17, parte 1) ---
    fecha_atencion: Mapped[date] = mapped_column(Date)
    hora_atencion: Mapped[time] = mapped_column(Time)
    # Puede no saberse todavía al recibir al paciente (se llena cuando
    # efectivamente se entrega en la IPS/ESE, resubmitiendo el
    # encabezado completo, igual que cualquier otro campo de acá).
    hora_entrega: Mapped[time | None] = mapped_column(Time, default=None)

    identificado: Mapped[bool] = mapped_column(Boolean, default=True)
    paciente_tipo_documento: Mapped[TipoDocumentoPaciente | None] = mapped_column(
        Enum(TipoDocumentoPaciente, name="tipo_documento_paciente"), default=None
    )
    paciente_numero_documento: Mapped[str | None] = mapped_column(String(20), default=None)
    # "DE:" del papel — lugar de expedición del documento.
    paciente_documento_expedido_en: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_aseguradora: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_nombres: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_apellidos: Mapped[str | None] = mapped_column(String(100), default=None)
    paciente_edad: Mapped[int | None] = mapped_column(Integer, default=None)
    paciente_sexo: Mapped[SexoPaciente | None] = mapped_column(
        Enum(SexoPaciente, name="sexo_paciente"), default=None
    )

    # Datos del accidente/vehículo — se conocen aunque el paciente sea
    # NN, así que no dependen de `identificado`.
    lugar_ocurrencia: Mapped[str] = mapped_column(String(255))
    ciudad: Mapped[str] = mapped_column(String(100))
    telefono_contacto: Mapped[str | None] = mapped_column(String(20), default=None)
    rol_victima: Mapped[RolVictima] = mapped_column(Enum(RolVictima, name="rol_victima"))
    poliza_vigente_desde: Mapped[date | None] = mapped_column(Date, default=None)
    poliza_vigente_hasta: Mapped[date | None] = mapped_column(Date, default=None)
    vehiculo_placa: Mapped[str] = mapped_column(String(10))
    vehiculo_tipo: Mapped[str] = mapped_column(String(50))
    vehiculo_marca: Mapped[str] = mapped_column(String(50))
    numero_poliza: Mapped[str] = mapped_column(String(50))

    # --- Parte clínica (issue #17, parte 2) — se llena progresivamente
    # durante la atención, todo nullable (mismo criterio que
    # `FormatoTraslado`, ADR-0007).
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

    # "Profesional que recibe" en la IPS/ESE — solo nombre y cédula,
    # sin firma (ver nota de módulo).
    profesional_recibe_nombre: Mapped[str | None] = mapped_column(String(150), default=None)
    profesional_recibe_cedula: Mapped[str | None] = mapped_column(String(20), default=None)