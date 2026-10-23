"""Esquemas del formato de atención de accidentes SOAT: encabezado y
parte clínica (issue #17) — mismo criterio que
`app/schemas/formato_traslado.py`: un solo esquema de entrada por
parte, siempre el formulario completo, nunca un parche parcial (ver
ADR-0002, ADR-0006, ADR-0007).

El encabezado acepta el paciente como NN (`identificado=False`, con
sus datos de identidad en blanco) — a diferencia de
`FormatoTrasladoEncabezado`, donde el paciente siempre se identifica.
Que un NN sin identificar no pueda *cerrarse* así de por vida es una
validación de negocio (`_campos_faltantes_para_cerrar_soat`), no una
restricción del esquema: el esquema solo valida la forma de los
datos, lo mismo que ya hace `FormatoTrasladoClinico` con sus propios
campos obligatorios al cierre.

Issue #71: `nota_auxiliar`/`nota_medica` se agregan a
`FormatoAccidenteSoatClinico` con el mismo `max_length=2000` que sus
homónimas en `FormatoTrasladoClinico` -- texto libre para la segunda
página del PDF (ver nota de módulo en `app/models/formato_accidente_soat.py`).
"""

from __future__ import annotations

from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.formato_accidente_soat import RolVictima, TriageNivel
from app.models.formato_traslado import (
    ReflejoPupilar,
    SexoPaciente,
    TipoDocumentoPaciente,
    TratamientoAplicado,
)
from app.schemas.formato_traslado import LesionLocalizadaItem, SignoVitalItem


class FormatoAccidenteSoatEncabezado(BaseModel):
    fecha_atencion: date
    hora_atencion: time
    hora_entrega: time | None = None

    identificado: bool = True
    paciente_tipo_documento: TipoDocumentoPaciente | None = None
    paciente_numero_documento: str | None = None
    paciente_aseguradora: str | None = None
    paciente_nombres: str | None = None
    paciente_apellidos: str | None = None
    paciente_edad: int | None = None
    paciente_sexo: SexoPaciente | None = None

    lugar_ocurrencia: str
    ciudad: str
    telefono_contacto: str | None = None
    rol_victima: RolVictima
    poliza_vigente_desde: date | None = None
    poliza_vigente_hasta: date | None = None
    numero_poliza: str | None = None


class FormatoAccidenteSoatClinico(BaseModel):
    tratamiento: list[TratamientoAplicado] = Field(default_factory=list)
    tratamiento_otro: str | None = None

    pupila_derecha: ReflejoPupilar | None = None
    pupila_izquierda: ReflejoPupilar | None = None

    signos_vitales: list[SignoVitalItem] = Field(default_factory=list)

    lesiones_localizadas: list[LesionLocalizadaItem] = Field(default_factory=list)

    glasgow_ocular: int | None = Field(default=None, ge=1, le=4)
    glasgow_verbal: int | None = Field(default=None, ge=1, le=5)
    glasgow_motora: int | None = Field(default=None, ge=1, le=6)

    triage: TriageNivel | None = None
    descripcion: str | None = Field(default=None, max_length=2000)

    # Issue #71 -- texto libre para la segunda página del PDF, no una
    # casilla del papel físico (ver nota de módulo del modelo).
    nota_auxiliar: str | None = Field(default=None, max_length=2000)

    atendido_por: str | None = None
    # Data URL en base64 de la firma dibujada en pantalla (issue #11) --
    # 300_000 caracteres alcanzan de sobra para un PNG pequeño de una
    # firma; es solo para no aceptar un payload arbitrariamente grande.
    firma_atendido_por: str | None = Field(default=None, max_length=300_000)

    # Issue #71 -- mismo criterio que nota_auxiliar, para el médico.
    nota_medica: str | None = Field(default=None, max_length=2000)

    evolucionado_por: str | None = None
    firma_evolucionado_por: str | None = Field(default=None, max_length=300_000)

    profesional_recibe_nombre: str | None = None
    profesional_recibe_cedula: str | None = None
    firma_profesional_recibe: str | None = Field(default=None, max_length=300_000)


class FormatoAccidenteSoatOut(FormatoAccidenteSoatEncabezado, FormatoAccidenteSoatClinico):
    model_config = ConfigDict(from_attributes=True)

    atencion_id: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def glasgow_total(self) -> int | None:
        """Suma de las tres escalas -- mismo criterio que
        `FormatoTrasladoOut.glasgow_total` (ver ese esquema): se calcula
        acá, sobre los campos ya validados por Pydantic, nunca como un
        atributo del modelo de SQLAlchemy (ADR-0007).
        """
        if (
            self.glasgow_ocular is None
            or self.glasgow_verbal is None
            or self.glasgow_motora is None
        ):
            return None
        return self.glasgow_ocular + self.glasgow_verbal + self.glasgow_motora