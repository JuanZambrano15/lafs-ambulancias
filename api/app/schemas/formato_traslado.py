"""Esquemas del formato de traslado: encabezado (issue #8) y parte
clínica (issue #9).
 
El encabezado usa un solo esquema de entrada
(`FormatoTrasladoEncabezado`) que sirve tanto para crear como para
actualizar: mientras la atención sigue `abierta`, el auxiliar/médico
puede reescribirlo completo las veces que necesite (ver ADR-0002) — no
hay un "parche parcial", siempre se manda el formulario completo.
 
La parte clínica (`FormatoTrasladoClinico`) sigue la misma idea de
"siempre el formulario completo" pero con todo opcional (ver
ADR-0007): se llena progresivamente durante el traslado, así que cada
PUT manda el estado de esa parte tal como esté hasta ese momento.
"""
 
from __future__ import annotations
 
from datetime import date, time
 
from pydantic import BaseModel, ConfigDict, Field, computed_field
 
from app.models.formato_traslado import (
    CategoriaPaciente,
    ComplejidadTraslado,
    LesionTipo,
    ModalidadTraslado,
    NivelServicioTraslado,
    ReflejoPupilar,
    SexoPaciente,
    TipoDocumentoPaciente,
    TratamientoAplicado,
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
 
 
class SignoVitalItem(BaseModel):
    """Una fila de la tabla de signos vitales — se repite tantas veces
    como mediciones se tomen durante el traslado. `hora` queda como
    texto libre (no `time`) porque es solo una columna más de una
    tabla repetible, no un campo con lógica propia.
    """
 
    hora: str
    ta: str | None = None
    fc: int | None = Field(default=None, ge=0, le=300)
    fr: int | None = Field(default=None, ge=0, le=120)
    spo2: int | None = Field(default=None, ge=0, le=100)
 
 
class FormatoTrasladoClinico(BaseModel):
    diagnostico: str | None = None
 
    tratamiento: list[TratamientoAplicado] = Field(default_factory=list)
    tratamiento_otro: str | None = None
 
    pupila_derecha: ReflejoPupilar | None = None
    pupila_izquierda: ReflejoPupilar | None = None
 
    signos_vitales: list[SignoVitalItem] = Field(default_factory=list)
 
    lesiones: list[LesionTipo] = Field(default_factory=list)
    lesion_otro: str | None = None
 
    glasgow_ocular: int | None = Field(default=None, ge=1, le=4)
    glasgow_verbal: int | None = Field(default=None, ge=1, le=5)
    glasgow_motora: int | None = Field(default=None, ge=1, le=6)
 
    # Máximo 8: el formato en papel trae exactamente 8 líneas numeradas.
    insumos_entregados: list[str] = Field(default_factory=list, max_length=8)
 
    nota_auxiliar: str | None = Field(default=None, max_length=2000)
    atendido_por: str | None = None
 
    nota_medica: str | None = Field(default=None, max_length=2000)
    evolucionado_por: str | None = None
 
 
class FormatoTrasladoOut(FormatoTrasladoEncabezado, FormatoTrasladoClinico):
    model_config = ConfigDict(from_attributes=True)
 
    atencion_id: int
 
    @computed_field  # type: ignore[prop-decorator]
    @property
    def glasgow_total(self) -> int | None:
        """Suma de las tres escalas — el papel la escribe a mano junto
        a "GLASGOW: ___/15"; se calcula aquí, sobre los campos ya
        validados por Pydantic, en vez de confiar en que el modelo de
        SQLAlchemy expone un atributo que no es una columna mapeada
        (eso es lo que falló: ver ADR-0007).
        """
        if (
            self.glasgow_ocular is None
            or self.glasgow_verbal is None
            or self.glasgow_motora is None
        ):
            return None
        return self.glasgow_ocular + self.glasgow_verbal + self.glasgow_motora