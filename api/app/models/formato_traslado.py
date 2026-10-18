"""Formato de traslado asistencial de pacientes (TAP-LAFS-002):
encabezado (issue #8) y parte clínica (issue #9), en la misma tabla —
es un solo documento en papel, llenado en dos momentos (ver ADR-0002
sobre el ciclo de vida del servicio, ADR-0006 sobre el encabezado y
ADR-0007 sobre la parte clínica).

A diferencia del encabezado (se llena una sola vez, al recibir al
paciente), la parte clínica se llena progresivamente durante el
traslado — por eso todas sus columnas son nullable.
"""

from __future__ import annotations

import enum
from datetime import date, datetime, time
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.atencion import Atencion


class TipoDocumentoPaciente(enum.StrEnum):
    rc = "rc"
    ti = "ti"
    cc = "cc"
    ce = "ce"
    ppt = "ppt"


class SexoPaciente(enum.StrEnum):
    m = "m"
    f = "f"


class ComplejidadTraslado(enum.StrEnum):
    alta = "alta"
    baja = "baja"


class CategoriaPaciente(enum.StrEnum):
    neonato = "neonato"
    pediatrico = "pediatrico"
    adulto = "adulto"


class NivelServicioTraslado(enum.StrEnum):
    """La complejidad del servicio prestado en este traslado — no
    confundir con `Ambulancia.tipo`: el móvil puede ser medicalizado
    pero el nivel que se reporta en el formato de este traslado en
    particular es un campo independiente (así está en el papel).
    """

    basico = "basico"
    medicalizado = "medicalizado"


class ModalidadTraslado(enum.StrEnum):
    sencillo = "sencillo"
    redondo = "redondo"


class TratamientoAplicado(enum.StrEnum):
    """Casillas de la sección TRATAMIENTO (issue #9). "otros" va
    acompañado del texto libre en `tratamiento_otro`.
    """

    collar_cervical = "collar_cervical"
    inmovilizacion = "inmovilizacion"
    succion_secrecion = "succion_secrecion"
    oxigeno = "oxigeno"
    hemostasia = "hemostasia"
    linea_iv = "linea_iv"
    canula_orofaringea = "canula_orofaringea"
    rcp = "rcp"
    canula_nasal = "canula_nasal"
    monitoreo = "monitoreo"
    parto = "parto"
    vendaje = "vendaje"
    asepsia = "asepsia"
    otros = "otros"


class ReflejoPupilar(enum.StrEnum):
    """Una de estas por ojo (`pupila_derecha`, `pupila_izquierda`)."""

    midriatica = "midriatica"
    miotica = "miotica"
    isocorica = "isocorica"
    anisocorica = "anisocorica"
    no_reactiva = "no_reactiva"


class LesionTipo(enum.StrEnum):
    """Casillas de la cuadrícula LOCALIZACIÓN DE LESIONES -- el QUÉ de
    cada lesión. El diagrama corporal (adelante/atrás) del papel, que
    marca el DÓNDE, se digitaliza en el issue #54 como `LesionZona` +
    `LesionLado` + `LesionVista` (ver `LesionLocalizadaItem` en
    `app/schemas/formato_traslado.py`). `otro` reemplaza el espacio en
    blanco que tenía la cuadrícula del papel -- antes se guardaba
    aparte, en `lesion_otro`; ahora cada lesión localizada lleva su
    propio texto libre cuando `tipo == "otro"`.
    """

    tce = "tce"
    amputacion = "amputacion"
    escalpe = "escalpe"
    eritema = "eritema"
    fractura_abierta = "fractura_abierta"
    puncion = "puncion"
    laceracion = "laceracion"
    edema = "edema"
    luxacion = "luxacion"
    mordedura = "mordedura"
    abrasion = "abrasion"
    hematoma = "hematoma"
    esguince = "esguince"
    picadura = "picadura"
    trauma = "trauma"
    torax_inestable = "torax_inestable"
    contusion = "contusion"
    cuerpo_extrano = "cuerpo_extrano"
    hemotorax_masivo = "hemotorax_masivo"
    abdomen_cerrado = "abdomen_cerrado"
    hemorragia = "hemorragia"
    quemadura = "quemadura"
    aplastamiento = "aplastamiento"
    avulsion = "avulsion"
    dolor = "dolor"
    otro = "otro"


class LesionZona(enum.StrEnum):
    """Zona general del cuerpo donde está la lesión (issue #54) --
    nivel de detalle a propósito: "brazo", no "tercio medio del
    húmero". No distingue lado -- eso lo hace `LesionLado`, aparte,
    porque la misma zona se repite en los dos lados del cuerpo.
    """

    cabeza = "cabeza"
    cuello = "cuello"
    torax = "torax"
    abdomen = "abdomen"
    hombro = "hombro"
    brazo = "brazo"
    antebrazo = "antebrazo"
    mano = "mano"
    muslo = "muslo"
    pierna = "pierna"
    pie = "pie"


class LesionLado(enum.StrEnum):
    """Lado del cuerpo DEL PACIENTE, no de la pantalla (issue #54): en
    la vista frontal el paciente está de frente a quien mira, así que
    su lado derecho queda a la izquierda de la pantalla; en la vista
    posterior (de espaldas) es al revés. Esa conversión la hace el
    frontend antes de mandar el dato -- acá solo se guarda el lado
    real. `central` es para las zonas sin lado (cabeza, cuello, tórax,
    abdomen).
    """

    izquierdo = "izquierdo"
    derecho = "derecho"
    central = "central"


class LesionVista(enum.StrEnum):
    """Cuál de las dos siluetas del diagrama (adelante/atrás) estaba
    activa cuando se marcó la lesión (issue #54)."""

    frontal = "frontal"
    posterior = "posterior"


class FormatoTraslado(Base):
    __tablename__ = "formato_traslado"

    atencion_id: Mapped[int] = mapped_column(ForeignKey("atencion.id"), primary_key=True)
    atencion: Mapped[Atencion] = relationship()

    # Datos del paciente. El campo "DE:" (lugar de expedición del
    # documento) que trae el formato en papel se queda por fuera a
    # pedido explícito del cliente.
    paciente_tipo_documento: Mapped[TipoDocumentoPaciente] = mapped_column(
        Enum(TipoDocumentoPaciente, name="tipo_documento_paciente")
    )
    paciente_numero_documento: Mapped[str] = mapped_column(String(20))
    paciente_eps: Mapped[str] = mapped_column(String(100))
    paciente_nombres: Mapped[str] = mapped_column(String(100))
    paciente_apellidos: Mapped[str] = mapped_column(String(100))
    paciente_edad: Mapped[int] = mapped_column(Integer)
    paciente_sexo: Mapped[SexoPaciente] = mapped_column(Enum(SexoPaciente, name="sexo_paciente"))
    paciente_direccion_residencial: Mapped[str] = mapped_column(String(255))
    paciente_ciudad: Mapped[str] = mapped_column(String(100))
    paciente_telefono: Mapped[str | None] = mapped_column(String(20), default=None)

    # Datos del acompañante — puede no haber (paciente solo).
    acompanante_nombres_apellidos: Mapped[str | None] = mapped_column(String(150), default=None)
    acompanante_parentesco: Mapped[str | None] = mapped_column(String(50), default=None)
    acompanante_telefono: Mapped[str | None] = mapped_column(String(20), default=None)

    # Recepción del paciente: dónde y cuándo lo recibe la tripulación (origen).
    recepcion_fecha: Mapped[date] = mapped_column(Date)
    recepcion_hora: Mapped[time] = mapped_column(Time)
    recepcion_ciudad: Mapped[str] = mapped_column(String(100))
    recepcion_ips: Mapped[str] = mapped_column(String(150))
    recepcion_servicio: Mapped[str] = mapped_column(String(100))

    # Entrega del paciente: dónde y cuándo lo entrega la tripulación (destino).
    entrega_fecha: Mapped[date] = mapped_column(Date)
    entrega_hora: Mapped[time] = mapped_column(Time)
    entrega_ciudad: Mapped[str] = mapped_column(String(100))
    entrega_ips: Mapped[str] = mapped_column(String(150))
    entrega_servicio: Mapped[str] = mapped_column(String(100))

    complejidad: Mapped[ComplejidadTraslado] = mapped_column(
        Enum(ComplejidadTraslado, name="complejidad_traslado")
    )
    categoria_paciente: Mapped[CategoriaPaciente] = mapped_column(
        Enum(CategoriaPaciente, name="categoria_paciente")
    )
    nivel_servicio: Mapped[NivelServicioTraslado] = mapped_column(
        Enum(NivelServicioTraslado, name="nivel_servicio_traslado")
    )
    modalidad: Mapped[ModalidadTraslado] = mapped_column(
        Enum(ModalidadTraslado, name="modalidad_traslado")
    )

    # --- Parte clínica (issue #9). Se llena durante el traslado, no
    # de una sola vez como el encabezado — todo nullable (ADR-0007).
    # Las listas (`tratamiento`, `signos_vitales`, `lesiones`,
    # `insumos_entregados`) quedan en JSON en vez de tablas propias:
    # son datos de este formato nada más, no hace falta consultarlos
    # por su cuenta todavía. El valor por defecto en Python es `[]`
    # (no `None`) para que una fila recién creada por el encabezado ya
    # tenga listas vacías, no nulas (ver `FormatoTrasladoClinico` en
    # `app/schemas/formato_traslado.py`).
    diagnostico: Mapped[str | None] = mapped_column(Text, default=None)

    tratamiento: Mapped[list[str]] = mapped_column(JSON, default=list)
    tratamiento_otro: Mapped[str | None] = mapped_column(String(255), default=None)

    pupila_derecha: Mapped[ReflejoPupilar | None] = mapped_column(
        Enum(ReflejoPupilar, name="reflejo_pupilar"), default=None
    )
    pupila_izquierda: Mapped[ReflejoPupilar | None] = mapped_column(
        Enum(ReflejoPupilar, name="reflejo_pupilar"), default=None
    )

    signos_vitales: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    # Issue #54: cada entrada es {tipo, tipo_otro, zona, lado, vista} --
    # ver LesionLocalizadaItem en app/schemas/formato_traslado.py.
    lesiones_localizadas: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    glasgow_ocular: Mapped[int | None] = mapped_column(Integer, default=None)
    glasgow_verbal: Mapped[int | None] = mapped_column(Integer, default=None)
    glasgow_motora: Mapped[int | None] = mapped_column(Integer, default=None)

    insumos_entregados: Mapped[list[str]] = mapped_column(JSON, default=list)

    # Las firmas (issue #11) no son columnas en esta tabla todavía —
    # aquí solo se guarda el nombre de quien atendió/evolucionó.
    nota_auxiliar: Mapped[str | None] = mapped_column(Text, default=None)
    atendido_por: Mapped[str | None] = mapped_column(String(150), default=None)
    nota_medica: Mapped[str | None] = mapped_column(Text, default=None)
    evolucionado_por: Mapped[str | None] = mapped_column(String(150), default=None)

    # Firma de quien atendió/evolucionó (issue #11, ADR-0009): data URL
    # en base64 de lo dibujado en pantalla — la del auxiliar de planta
    # con firma guardada llega ya resuelta desde el frontend (copiada
    # de `Empleado.firma_guardada`), así que este endpoint no necesita
    # saber si viene de ahí o de un dibujo nuevo en pantalla.
    firma_atendido_por: Mapped[str | None] = mapped_column(Text, default=None)
    firma_evolucionado_por: Mapped[str | None] = mapped_column(Text, default=None)

    # Profesional que recibe al paciente en la IPS/ESE de destino
    # (issue #75): personal de la institución, no de LAFS -- quedó
    # fuera del issue #11 original (ver el comentario que había acá
    # arriba antes de esta corrección). Mismo patrón ya usado en el
    # formato de accidente SOAT: la firma siempre se dibuja a mano,
    # nunca se autocompleta de ningún perfil. El sello físico que la
    # acompaña en el papel no se captura en la app.
    profesional_recibe_nombre: Mapped[str | None] = mapped_column(String(150), default=None)
    profesional_recibe_cedula: Mapped[str | None] = mapped_column(String(20), default=None)
    firma_profesional_recibe: Mapped[str | None] = mapped_column(Text, default=None)

    # El total de Glasgow (suma de las tres escalas) no es una columna
    # — se calcula en `FormatoTrasladoOut.glasgow_total`
    # (app/schemas/formato_traslado.py), no aquí. Un `@property` del
    # modelo leído a través de `from_attributes=True` de Pydantic
    # depende de cómo cada versión de Pydantic/SQLAlchemy resuelve el
    # acceso a atributos que no son columnas mapeadas — no es
    # confiable entre entornos, así que el cálculo se mueve al
    # esquema, sobre campos que Pydantic ya validó.

    # PDF del formato completo (issue #13, ADR-0011): bytes, no una
    # ruta a archivo en disco — mismo criterio que la firma (ADR-0009,
    # sin S3 ni almacenamiento externo para este volumen). Se
    # regenera en cada `PUT` de encabezado/clínico y al cerrar la
    # atención (ver `app/pdf/formato_traslado.py` y las rutas en
    # `app/api/routes/atenciones.py`), así que siempre refleja el
    # último guardado — `None` solo antes de que exista encabezado.
    pdf_generado: Mapped[bytes | None] = mapped_column(LargeBinary, default=None)
    pdf_generado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
