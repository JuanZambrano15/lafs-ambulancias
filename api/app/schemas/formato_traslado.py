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

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.models.formato_traslado import (
    CategoriaPaciente,
    ComplejidadTraslado,
    LesionLado,
    LesionTipo,
    LesionVista,
    LesionZona,
    ModalidadTraslado,
    NivelServicioTraslado,
    ReflejoPupilar,
    SexoPaciente,
    TipoDocumentoPaciente,
    TratamientoAplicado,
)

# Issue #54: zonas sin lado (las del eje central del cuerpo) -- en estas
# el lado siempre debe ser "central", nunca izquierdo/derecho.
_ZONAS_CENTRALES = frozenset(
    {LesionZona.cabeza, LesionZona.cuello, LesionZona.torax, LesionZona.abdomen}
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


class LesionLocalizadaItem(BaseModel):
    """Una lesión marcada en el diagrama corporal (issue #54): el QUÉ
    (`tipo`) y el DÓNDE (`zona` + `lado` + `vista`). Pueden registrarse
    varias por formato -- un mismo accidente puede dejar más de una
    lesión, y hasta repetir tipo y zona en lados distintos.

    `lado` es el lado REAL del paciente, no el de la pantalla: en la
    vista `frontal` el paciente da la cara a quien mira, así que su
    lado derecho queda a la izquierda de la pantalla; en `posterior`
    es al revés. Esa conversión la hace el frontend antes de mandar
    el dato -- acá solo se valida que sea consistente con la zona.
    """

    tipo: LesionTipo
    tipo_otro: str | None = Field(default=None, max_length=255)
    zona: LesionZona
    lado: LesionLado
    vista: LesionVista

    @model_validator(mode="after")
    def _validar_tipo_otro_y_lado(self) -> LesionLocalizadaItem:
        if self.tipo == LesionTipo.otro and not self.tipo_otro:
            raise ValueError("tipo_otro es obligatorio cuando tipo es 'otro'")
        if self.tipo != LesionTipo.otro and self.tipo_otro:
            raise ValueError("tipo_otro solo aplica cuando tipo es 'otro'")

        es_central = self.zona in _ZONAS_CENTRALES
        if es_central and self.lado != LesionLado.central:
            raise ValueError(f"la zona '{self.zona}' no tiene lados: lado debe ser 'central'")
        if not es_central and self.lado == LesionLado.central:
            raise ValueError(f"la zona '{self.zona}' requiere lado 'izquierdo' o 'derecho'")
        return self


class FormatoTrasladoClinico(BaseModel):
    diagnostico: str | None = None

    tratamiento: list[TratamientoAplicado] = Field(default_factory=list)
    tratamiento_otro: str | None = None

    pupila_derecha: ReflejoPupilar | None = None
    pupila_izquierda: ReflejoPupilar | None = None

    signos_vitales: list[SignoVitalItem] = Field(default_factory=list)

    lesiones_localizadas: list[LesionLocalizadaItem] = Field(default_factory=list)

    glasgow_ocular: int | None = Field(default=None, ge=1, le=4)
    glasgow_verbal: int | None = Field(default=None, ge=1, le=5)
    glasgow_motora: int | None = Field(default=None, ge=1, le=6)

    # Máximo 8: el formato en papel trae exactamente 8 líneas numeradas.
    insumos_entregados: list[str] = Field(default_factory=list, max_length=8)

    nota_auxiliar: str | None = Field(default=None, max_length=2000)
    atendido_por: str | None = None
    # Data URL en base64 de la firma dibujada en pantalla (issue #11) —
    # 300_000 caracteres alcanzan de sobra para un PNG pequeño de una
    # firma; es solo para no aceptar un payload arbitrariamente grande.
    firma_atendido_por: str | None = Field(default=None, max_length=300_000)

    nota_medica: str | None = Field(default=None, max_length=2000)
    evolucionado_por: str | None = None
    firma_evolucionado_por: str | None = Field(default=None, max_length=300_000)

    # Profesional que recibe al paciente en la IPS/ESE de destino
    # (issue #75): personal de la institución, no de LAFS. La firma
    # siempre se dibuja a mano en pantalla, nunca se autocompleta de
    # ningún perfil -- mismo límite de tamaño que el resto de firmas.
    profesional_recibe_nombre: str | None = None
    profesional_recibe_cedula: str | None = None
    firma_profesional_recibe: str | None = Field(default=None, max_length=300_000)

    # Issue #66: campo "OBSERVACIONES" del papel (TAP-LAFS-002, página
    # 2) -- no se versiona en `formato_version` (ver ADR-0012: el
    # diagnóstico y las notas quedan fuera del historial).
    observaciones: str | None = Field(default=None, max_length=2000)


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