"""Esquemas del encabezado del formato de traslado (issue #8).
 
Un solo esquema de entrada (`FormatoTrasladoEncabezado`) sirve tanto
para crear como para actualizar: mientras la atención sigue `abierta`,
el auxiliar/médico puede reescribir el encabezado completo las veces
que necesite (ver ADR-0002) — no hay un "parche parcial", siempre se
manda el formulario completo.
"""
 
from __future__ import annotations
 
from datetime import date, time
 
from pydantic import BaseModel, ConfigDict
 
from app.models.formato_traslado import (
    CategoriaPaciente,
    ComplejidadTraslado,
    ModalidadTraslado,
    NivelServicioTraslado,
    SexoPaciente,
    TipoDocumentoPaciente,
)
 
 
class FormatoTrasladoEncabezado(BaseModel):
    # Datos del paciente
    paciente_tipo_documento: TipoDocumentoPaciente
    paciente_numero_documento: str
    paciente_eps: str
    paciente_nombres: str
    paciente_apellidos: str
    paciente_edad: int
    paciente_sexo: SexoPaciente
    paciente_direccion_residencial: str
    paciente_ciudad: str
    paciente_telefono: str | None = None
 
    # Datos del acompañante (opcional: el paciente puede ir solo)
    acompanante_nombres_apellidos: str | None = None
    acompanante_parentesco: str | None = None
    acompanante_telefono: str | None = None
 
    # Recepción del paciente (origen del traslado)
    recepcion_fecha: date
    recepcion_hora: time
    recepcion_ciudad: str
    recepcion_ips: str
    recepcion_servicio: str
 
    # Entrega del paciente (destino del traslado)
    entrega_fecha: date
    entrega_hora: time
    entrega_ciudad: str
    entrega_ips: str
    entrega_servicio: str
 
    complejidad: ComplejidadTraslado
    categoria_paciente: CategoriaPaciente
    nivel_servicio: NivelServicioTraslado
    modalidad: ModalidadTraslado
 
 
class FormatoTrasladoOut(FormatoTrasladoEncabezado):
    model_config = ConfigDict(from_attributes=True)
 
    atencion_id: int