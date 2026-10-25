"""Esquema de salida del historial de versiones de un formato de
traslado (issue #14, ADR-0012).
"""

from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict

from app.models.formato_traslado import (
    CategoriaPaciente,
    ComplejidadTraslado,
    ModalidadTraslado,
    NivelServicioTraslado,
    ReflejoPupilar,
    SexoPaciente,
    TipoDocumentoPaciente,
    TratamientoAplicado,
)
from app.schemas.formato_traslado import LesionLocalizadaItem, SignoVitalItem


class UsuarioResumenOut(BaseModel):
    """Identidad mínima de quien corrigió — no los roles completos de
    `UsuarioOut` (ese esquema espera `list[RolOut]`, construido a mano
    en `app/api/routes/usuarios.py` porque `Usuario.roles` en
    realidad son filas `UsuarioRol`, no `Rol`; acá ni hace falta, con
    el documento alcanza para identificar quién fue).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    documento: str


class FormatoVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    atencion_id: int
    corregido_por: UsuarioResumenOut
    corregido_en: datetime
    motivo: str

    # --- Paciente ---
    paciente_tipo_documento: TipoDocumentoPaciente | None
    paciente_numero_documento: str | None
    paciente_eps: str | None
    paciente_nombres: str | None
    paciente_apellidos: str | None
    paciente_edad: int | None
    paciente_sexo: SexoPaciente | None
    paciente_direccion_residencial: str | None
    paciente_ciudad: str | None
    paciente_telefono: str | None

    # --- Acompañante ---
    acompanante_nombres_apellidos: str | None
    acompanante_parentesco: str | None
    acompanante_telefono: str | None

    # --- Recepción / entrega ---
    recepcion_fecha: date | None
    recepcion_hora: time | None
    recepcion_ciudad: str | None
    recepcion_ips: str | None
    recepcion_servicio: str | None
    entrega_fecha: date | None
    entrega_hora: time | None
    entrega_ciudad: str | None
    entrega_ips: str | None
    entrega_servicio: str | None

    complejidad: ComplejidadTraslado | None
    categoria_paciente: CategoriaPaciente | None
    nivel_servicio: NivelServicioTraslado | None
    modalidad: ModalidadTraslado | None

    # --- Clínico---
    tratamiento: list[TratamientoAplicado]
    tratamiento_otro: str | None
    pupila_derecha: ReflejoPupilar | None
    pupila_izquierda: ReflejoPupilar | None
    signos_vitales: list[SignoVitalItem]
    lesiones_localizadas: list[LesionLocalizadaItem]
    glasgow_ocular: int | None
    glasgow_verbal: int | None
    glasgow_motora: int | None
    insumos_entregados: list[str]
    atendido_por: str | None
    firma_atendido_por: str | None
    evolucionado_por: str | None
    firma_evolucionado_por: str | None
    profesional_recibe_nombre: str | None
    profesional_recibe_cedula: str | None
    firma_profesional_recibe: str | None