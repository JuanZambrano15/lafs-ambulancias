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
 
La firma del conductor no se diligencia en ninguna pantalla de este
formato -- queda para el PDF que se genera en un issue aparte (ver más
abajo), reconstruida a partir de `Atencion.conductor`, igual que en
`FormatoTraslado`.
 
El auxiliar que atiende sí firma en pantalla ("atendido por"/firma,
mismo patrón que `FormatoTraslado`, issue #11). Si participó un
médico (opcional -- este formato no tiene la noción de
"medicalizado" que sí tiene traslado), también queda su nombre y
firma ("evolucionado por"), mismo patrón.
 
El papel también pide la firma de el "profesional que recibe" en la
IPS/ESE, además de su nombre y cédula -- a diferencia de
`FormatoTraslado` (donde la firma de quien entrega/recibe no se
captura, por no ser personal de LAFS), acá sí se dibuja en pantalla.
El sello físico que acompaña esa firma en el papel no se captura en
la app.
 
El PDF descargable de este formato queda para un issue aparte (igual
que pasó con traslado: issue #13, separado de #8/#9) — por eso esta
tabla todavía no tiene columnas `pdf_generado`/`pdf_generado_en`.
 
Correcciones sobre el modelado original del issue #17 (antes de que
hubiera pantallas que lo usaran, al construir el issue #70 se
encontraron varias cosas que no correspondían con el papel real):
`vehiculo_placa`, `vehiculo_tipo`, `vehiculo_marca` y
`paciente_documento_expedido_en` no existen en el formato AA-LAFS-005,
así que se quitaron (columnas eliminadas por migración, no solo
dejadas de usar). `numero_poliza` sí está en el papel pero puede no
saberse al momento de la atención -- el dato del paciente a veces se
completa días después -- así que pasó a ser opcional, corregible por
el administrador como cualquier otro campo tras el cierre. Y faltaban
`atendido_por`/`firma_atendido_por`, `evolucionado_por`/
`firma_evolucionado_por` y `firma_profesional_recibe` (esta última
columna se agrega junto a `profesional_recibe_nombre`/
`profesional_recibe_cedula`, que sí correspondían desde el principio).
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
    # Opcional -- puede no saberse todavía al recibir al paciente (ver
    # nota de módulo), a diferencia de `lugar_ocurrencia`/`ciudad` de
    # arriba, que siempre se conocen aunque el paciente sea NN.
    numero_poliza: Mapped[str | None] = mapped_column(String(50), default=None)
 
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
 
    # Auxiliar que atiende — nombre y firma (autocompletados desde el
    # perfil del usuario que entrega el formato, o la firma reusada si
    # ya tiene una guardada; ver patrón idéntico en `FormatoTraslado`).
    atendido_por: Mapped[str | None] = mapped_column(String(150), default=None)
    firma_atendido_por: Mapped[str | None] = mapped_column(Text, default=None)
 
    # Médico que participó, si lo hubo — siempre opcional (este formato
    # no tiene la noción de "medicalizado" que sí tiene traslado). Su
    # firma siempre se dibuja en pantalla, nunca se autocompleta.
    evolucionado_por: Mapped[str | None] = mapped_column(String(150), default=None)
    firma_evolucionado_por: Mapped[str | None] = mapped_column(Text, default=None)
 
    # "Profesional que recibe" en la IPS/ESE — nombre, cédula y firma,
    # todos dibujados/escritos en pantalla al cerrar la atención (es un
    # tercero ajeno a la app, no se autocompleta de ningún perfil). El
    # sello físico que lo acompaña en el papel no se captura acá.
    profesional_recibe_nombre: Mapped[str | None] = mapped_column(String(150), default=None)
    profesional_recibe_cedula: Mapped[str | None] = mapped_column(String(20), default=None)
    firma_profesional_recibe: Mapped[str | None] = mapped_column(Text, default=None)