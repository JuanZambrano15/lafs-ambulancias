"""Esquema de salida del historial de versiones de un formato de
accidente SOAT (issue #17, mismo mecanismo que `FormatoVersionOut`
para traslado — issue #14, ADR-0012).
"""
 
from __future__ import annotations
 
from datetime import date, datetime, time
 
from pydantic import BaseModel, ConfigDict
 
from app.models.formato_accidente_soat import RolVictima, TriageNivel
from app.models.formato_traslado import (
    LesionTipo,
    ReflejoPupilar,
    SexoPaciente,
    TipoDocumentoPaciente,
    TratamientoAplicado,
)
from app.schemas.formato_traslado import SignoVitalItem
from app.schemas.formato_version import UsuarioResumenOut
 
 
class FormatoAccidenteSoatVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
 
    id: int
    atencion_id: int
    corregido_por: UsuarioResumenOut
    corregido_en: datetime
 
    fecha_atencion: date | None
    hora_atencion: time | None
    hora_entrega: time | None
 
    identificado: bool | None
    paciente_tipo_documento: TipoDocumentoPaciente | None
    paciente_numero_documento: str | None
    paciente_aseguradora: str | None
    paciente_nombres: str | None
    paciente_apellidos: str | None
    paciente_edad: int | None
    paciente_sexo: SexoPaciente | None
 
    lugar_ocurrencia: str | None
    ciudad: str | None
    telefono_contacto: str | None
    rol_victima: RolVictima | None
    poliza_vigente_desde: date | None
    poliza_vigente_hasta: date | None
    numero_poliza: str | None
 
    tratamiento: list[TratamientoAplicado]
    tratamiento_otro: str | None
    pupila_derecha: ReflejoPupilar | None
    pupila_izquierda: ReflejoPupilar | None
    signos_vitales: list[SignoVitalItem]
    lesiones: list[LesionTipo]
    lesion_otro: str | None
    glasgow_ocular: int | None
    glasgow_verbal: int | None
    glasgow_motora: int | None
    triage: TriageNivel | None
    descripcion: str | None
    profesional_recibe_nombre: str | None
    profesional_recibe_cedula: str | None