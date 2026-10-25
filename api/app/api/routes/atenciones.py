"""Iniciar una atención: elegir móvil, tipo y conductor (issue #7).
 
Solo el personal operativo (auxiliar de enfermería, médico, conductor)
puede iniciar una atención — ver `require_personal_operativo` en
`app/api/deps.py` y ADR-0005 para el porqué de cada decisión.
 
El responsable (quien llena el formato) es siempre quien está logueado,
nunca un dato que mande el cliente: sale de `usuario.empleado_id`.
"""
 
from __future__ import annotations
 
import io
from datetime import UTC, datetime
 
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
 
from app.api.deps import (
    CurrentUser,
    DbSession,
    require_admin,
    require_personal_clinico,
    require_personal_clinico_o_admin,
    require_personal_operativo,
)
from app.core.security import verify_secret
from app.models.ambulancia import Ambulancia
from app.models.atencion import Atencion, EstadoAtencion, TipoAtencion
from app.models.empleado import Empleado
from app.models.formato_accidente_soat import FormatoAccidenteSoat
from app.models.formato_accidente_soat_foto import FormatoAccidenteSoatFoto
from app.models.formato_accidente_soat_version import FormatoAccidenteSoatVersion
from app.models.formato_traslado import FormatoTraslado, NivelServicioTraslado
from app.models.formato_version import FormatoVersion
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.pdf.formato_accidente_soat import generar_pdf_formato_accidente_soat
from app.pdf.formato_traslado import generar_pdf_formato_traslado
from app.schemas.ambulancia import AmbulanciaOut
from app.schemas.atencion import AtencionCerradaOut, AtencionCreate, AtencionOut
from app.schemas.auth import PinRequest
from app.schemas.empleado import EmpleadoOut
from app.schemas.formato_accidente_soat import (
    FormatoAccidenteSoatClinico,
    FormatoAccidenteSoatEncabezado,
    FormatoAccidenteSoatOut,
)
from app.schemas.formato_accidente_soat_foto import FormatoAccidenteSoatFotoOut
from app.schemas.formato_accidente_soat_version import FormatoAccidenteSoatVersionOut
from app.schemas.formato_traslado import (
    FormatoTrasladoClinico,
    FormatoTrasladoEncabezado,
    FormatoTrasladoOut,
)
from app.schemas.formato_version import FormatoVersionOut
 
router = APIRouter(
    prefix="/atenciones",
    tags=["atenciones"],
)
 
 
def _empleado_del_usuario(usuario: Usuario, db: DbSession) -> Empleado:
    """El responsable de la atención es el empleado ligado al usuario
    logueado — no todo usuario tiene uno (ver ADR-0003), así que hay
    que validarlo explícitamente en vez de asumirlo.
    """
    if usuario.empleado_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu usuario no está vinculado a un empleado, no puedes iniciar una atención",
        )
    empleado = db.get(Empleado, usuario.empleado_id)
    if empleado is None or not empleado.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El empleado ligado a tu usuario no está activo",
        )
    return empleado
 
 
def _ambulancias_con_atencion_abierta(db: DbSession) -> set[int]:
    filas = db.execute(
        select(Atencion.ambulancia_id).where(Atencion.estado == EstadoAtencion.abierto)
    )
    return {fila[0] for fila in filas}
 
 
def _conductores_con_atencion_abierta(db: DbSession) -> set[int]:
    filas = db.execute(
        select(Atencion.conductor_id).where(Atencion.estado == EstadoAtencion.abierto)
    )
    return {fila[0] for fila in filas}
 
 
@router.get(
    "/ambulancias-disponibles",
    response_model=list[AmbulanciaOut],
    dependencies=[Depends(require_personal_operativo)],
)
def listar_ambulancias_disponibles(db: DbSession) -> list[Ambulancia]:
    """Activas y sin una atención abierta — la flota es rotativa, así
    que un móvil que ya salió no se puede volver a elegir hasta que se
    cierre su atención.
    """
    ocupadas = _ambulancias_con_atencion_abierta(db)
    query = db.query(Ambulancia).filter(Ambulancia.activa.is_(True))
    if ocupadas:
        query = query.filter(Ambulancia.id.notin_(ocupadas))
    return list(query.order_by(Ambulancia.movil).all())
 
 
@router.get(
    "/conductores-disponibles",
    response_model=list[EmpleadoOut],
    dependencies=[Depends(require_personal_operativo)],
)
def listar_conductores_disponibles(usuario: CurrentUser, db: DbSession) -> list[Empleado]:
    """Empleados activos cuyo usuario tiene el rol "conductor", y que
    no están ya manejando otra atención abierta.
 
    Issue #62: tampoco se ofrece a quien está logueado, aunque tenga
    el rol de conductor además del suyo (roles mixtos) — quien inicia
    la atención es el responsable, y el responsable no puede ser
    también el conductor de su propia atención. Ver la validación
    equivalente en `crear_atencion`, que es la que de verdad lo
    impide; este filtro es solo para que la lista no lo ofrezca.
    """
    ocupados = _conductores_con_atencion_abierta(db)
    query = (
        db.query(Empleado)
        .join(Usuario, Usuario.empleado_id == Empleado.id)
        .join(UsuarioRol, UsuarioRol.usuario_id == Usuario.id)
        .join(Rol, Rol.id == UsuarioRol.rol_id)
        .filter(
            Empleado.activo.is_(True),
            Usuario.activo.is_(True),
            Rol.nombre == "conductor",
        )
    )
    if ocupados:
        query = query.filter(Empleado.id.notin_(ocupados))
    if usuario.empleado_id is not None:
        query = query.filter(Empleado.id != usuario.empleado_id)
    return list(query.order_by(Empleado.apellidos, Empleado.nombres).all())
 
 
@router.get(
    "/medicos-disponibles",
    response_model=list[EmpleadoOut],
    dependencies=[Depends(require_personal_clinico)],
)
def listar_medicos_disponibles(db: DbSession) -> list[Empleado]:
    """Empleados activos cuyo usuario tiene el rol "medico" -- para que
    quien diligencia lo clínico de un traslado medicalizado (issue
    #63) pueda elegir, de una lista, al médico que va en la ambulancia
    cuando quien está logueado es el auxiliar y no el médico.
 
    A diferencia de `listar_conductores_disponibles`, aquí no aplica
    el concepto de "ocupado" (eso es propio de un conductor por
    ambulancia) ni el de autoexclusión del usuario logueado (issue
    #62 es una regla de responsable/conductor en la misma atención;
    un médico sí puede, perfectamente, elegirse a sí mismo en esta
    lista si está de planta -- aunque en la práctica, si el médico es
    quien está logueado, el formulario ya le autocompleta su propio
    nombre y no necesita usar este selector).
    """
    query = (
        db.query(Empleado)
        .join(Usuario, Usuario.empleado_id == Empleado.id)
        .join(UsuarioRol, UsuarioRol.usuario_id == Usuario.id)
        .join(Rol, Rol.id == UsuarioRol.rol_id)
        .filter(
            Empleado.activo.is_(True),
            Usuario.activo.is_(True),
            Rol.nombre == "medico",
        )
    )
    return list(query.order_by(Empleado.apellidos, Empleado.nombres).all())
 
 
@router.get(
    "/en-curso",
    response_model=list[AtencionOut],
    dependencies=[Depends(require_personal_clinico)],
)
def listar_atenciones_en_curso(usuario: CurrentUser, db: DbSession) -> list[Atencion]:
    """Atenciones abiertas donde el usuario logueado es el responsable
    (issue #51).
 
    Sin esto, salir de la pantalla del formato clínico sin cerrar la
    atención (se va la señal, se cierra el navegador, se le olvida)
    la deja sin ninguna forma de retomarla desde la navegación normal
    — ni de liberar la ambulancia/conductor que quedaron "ocupados"
    (ver `_ambulancias_con_atencion_abierta` arriba). Home usa este
    endpoint para ofrecer "continuar" en vez de obligar a escribir la
    URL de la atención a mano.
    """
    if usuario.empleado_id is None:
        return []
    atenciones = (
        db.execute(
            select(Atencion)
            .options(
                joinedload(Atencion.ambulancia),
                joinedload(Atencion.conductor),
                joinedload(Atencion.responsable),
            )
            .where(
                Atencion.estado == EstadoAtencion.abierto,
                Atencion.responsable_id == usuario.empleado_id,
            )
            .order_by(Atencion.abierta_en)
        )
        .unique()
        .scalars()
        .all()
    )
    return list(atenciones)
 
 
@router.get(
    "/mis-cerradas",
    response_model=list[AtencionOut],
    dependencies=[Depends(require_personal_clinico)],
)
def listar_mis_atenciones_cerradas(usuario: CurrentUser, db: DbSession) -> list[Atencion]:
    """Atenciones ya cerradas donde el usuario logueado es el
    responsable, las más recientes primero (issue #18).
 
    Sin esto, el auxiliar/médico no tiene desde dónde llegar a la
    pantalla de fotos (issue #18 solo se puede subir fotos a una
    atención ya cerrada, ver `_puede_gestionar_fotos_soat`) -- a
    diferencia de `GET /atenciones/cerradas` (issue #15), que es solo
    para el administrador y no filtra por responsable. `limit` fijo
    en 20: es solo para navegar a "la que acabo de cerrar" o alguna
    de los últimos días, no un historial completo (para eso está el
    panel web).
    """
    if usuario.empleado_id is None:
        return []
    atenciones = (
        db.execute(
            select(Atencion)
            .options(
                joinedload(Atencion.ambulancia),
                joinedload(Atencion.conductor),
                joinedload(Atencion.responsable),
            )
            .where(
                Atencion.estado == EstadoAtencion.cerrado,
                Atencion.responsable_id == usuario.empleado_id,
            )
            .order_by(Atencion.cerrada_en.desc())
            .limit(20)
        )
        .unique()
        .scalars()
        .all()
    )
    return list(atenciones)
 
 
@router.get(
    "/pendientes",
    response_model=list[AtencionOut],
    dependencies=[Depends(require_admin)],
)
def listar_atenciones_pendientes(db: DbSession) -> list[Atencion]:
    """Atenciones todavía abiertas (de traslado o de accidente SOAT),
    para el panel del administrador (issue #15, ampliado en el #79
    para el dashboard de inicio) -- a diferencia de `/en-curso`, aquí
    no se filtra por responsable: el administrador necesita ver TODAS
    las que estén abiertas, no solo las suyas (de hecho nunca tiene
    `empleado_id`, así que `/en-curso` siempre le daría una lista
    vacía). Ordenadas de más antigua a más reciente -- la alerta
    básica del issue ("lleva mucho tiempo abierta") se calcula en el
    panel a partir de `abierta_en`, no acá, así que conviene que las
    más urgentes queden primero.
 
    Issue #79: antes esto solo traía traslados -- el panel todavía no
    se había extendido para mostrar accidentes SOAT. El dashboard
    nuevo también usa esta lista para saber qué ambulancias están "en
    uso ahorita" (cualquier tipo de atención abierta cuenta), así que
    dejar afuera los SOAT las mostraba como libres por error.
    """
    atenciones = (
        db.execute(
            select(Atencion)
            .options(
                joinedload(Atencion.ambulancia),
                joinedload(Atencion.conductor),
                joinedload(Atencion.responsable),
            )
            .where(Atencion.estado == EstadoAtencion.abierto)
            .order_by(Atencion.abierta_en)
        )
        .unique()
        .scalars()
        .all()
    )
    return list(atenciones)
 
 
@router.get(
    "/cerradas",
    response_model=list[AtencionCerradaOut],
    dependencies=[Depends(require_admin)],
)
def listar_atenciones_cerradas(
    db: DbSession,
    q: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
) -> list[AtencionCerradaOut]:
    """Atenciones ya cerradas (de traslado o de accidente SOAT), para
    que el administrador encuentre un formato puntual y descargue su
    PDF (issue #15; issue #80 adelanto: antes solo traía traslados,
    dejando los accidentes SOAT invisibles en el panel) -- no hay otra
    forma de listarlas: `GET /atenciones/{id}/formato-traslado` (o el
    equivalente de SOAT) sirve para consultar una ya sabiendo su id,
    no para buscarla.
 
    `q` busca coincidencia parcial, sin distinguir mayúsculas, en
    nombres, apellidos o número de documento del paciente. Sin `q`,
    simplemente trae las más recientes. `limit` (30 por defecto, tope
    100) evita traer de una vez un historial que solo va a crecer --
    no hay paginación todavía, solo "las más recientes que
    coincidan".
 
    Son dos tablas de formato distintas (`FormatoTraslado` y
    `FormatoAccidenteSoat`), sin una columna en común para unirlas en
    una sola consulta SQL, así que se traen por separado (cada una ya
    acotada a `limit`), se juntan y se ordenan en Python antes de
    cortar al `limit` final -- aceptable mientras no haya paginación
    real (issue #80).
 
    Solo trae atenciones que ya tienen su formato (join, no left
    join): sin encabezado no hay datos de paciente que mostrar ni PDF
    que descargar, así que no hay nada útil que listar ahí.
    """
    consulta_traslado = (
        select(Atencion, FormatoTraslado)
        .join(FormatoTraslado, FormatoTraslado.atencion_id == Atencion.id)
        .options(
            joinedload(Atencion.ambulancia),
            joinedload(Atencion.conductor),
            joinedload(Atencion.responsable),
        )
        .where(
            Atencion.estado == EstadoAtencion.cerrado,
            Atencion.tipo == TipoAtencion.traslado,
        )
    )
    consulta_soat = (
        select(Atencion, FormatoAccidenteSoat)
        .join(FormatoAccidenteSoat, FormatoAccidenteSoat.atencion_id == Atencion.id)
        .options(
            joinedload(Atencion.ambulancia),
            joinedload(Atencion.conductor),
            joinedload(Atencion.responsable),
        )
        .where(
            Atencion.estado == EstadoAtencion.cerrado,
            Atencion.tipo == TipoAtencion.atencion_soat,
        )
    )
    if q:
        patron = f"%{q.strip().lower()}%"
        consulta_traslado = consulta_traslado.where(
            func.lower(FormatoTraslado.paciente_nombres).like(patron)
            | func.lower(FormatoTraslado.paciente_apellidos).like(patron)
            | func.lower(FormatoTraslado.paciente_numero_documento).like(patron)
        )
        consulta_soat = consulta_soat.where(
            func.lower(FormatoAccidenteSoat.paciente_nombres).like(patron)
            | func.lower(FormatoAccidenteSoat.paciente_apellidos).like(patron)
            | func.lower(FormatoAccidenteSoat.paciente_numero_documento).like(patron)
        )
    filas_traslado = (
        db.execute(consulta_traslado.order_by(Atencion.cerrada_en.desc()).limit(limit))
        .unique()
        .all()
    )
    filas_soat = (
        db.execute(consulta_soat.order_by(Atencion.cerrada_en.desc()).limit(limit))
        .unique()
        .all()
    )
    resultado = [
        _construir_atencion_cerrada_out(atencion, formato) for atencion, formato in filas_traslado
    ] + [
        _construir_atencion_cerrada_out(atencion, formato) for atencion, formato in filas_soat
    ]
    resultado.sort(key=lambda fila: fila.cerrada_en or fila.abierta_en, reverse=True)
    return resultado[:limit]


def _construir_atencion_cerrada_out(
    atencion: Atencion, formato: FormatoTraslado | FormatoAccidenteSoat
) -> AtencionCerradaOut:
    """Arma `AtencionCerradaOut` a partir de la atención y su formato
    (traslado o SOAT) -- compartido por `/cerradas` (issue #15) y
    `/{atencion_id}` (issue #80, pantalla de detalle). Un accidente
    SOAT no tiene la noción de básico/medicalizado, de ahí el
    `getattr` con default `None` en vez de un `if` por tipo.
    """
    return AtencionCerradaOut(
        id=atencion.id,
        tipo=atencion.tipo,
        nivel_servicio=getattr(formato, "nivel_servicio", None),
        estado=atencion.estado,
        abierta_en=atencion.abierta_en,
        cerrada_en=atencion.cerrada_en,
        ambulancia=AmbulanciaOut.model_validate(atencion.ambulancia),
        conductor=EmpleadoOut.model_validate(atencion.conductor),
        responsable=EmpleadoOut.model_validate(atencion.responsable),
        paciente_nombres=formato.paciente_nombres,
        paciente_apellidos=formato.paciente_apellidos,
        paciente_numero_documento=formato.paciente_numero_documento,
        tiene_pdf=formato.pdf_generado is not None,
    )


@router.get(
    "/{atencion_id}",
    response_model=AtencionCerradaOut,
    dependencies=[Depends(require_admin)],
)
def obtener_atencion_cerrada(atencion_id: int, db: DbSession) -> AtencionCerradaOut:
    """Resumen de una atención cerrada puntual -- issue #80: la
    pantalla de detalle del panel web necesita los datos del
    encabezado (paciente, documento, móvil, tripulación) de una sola
    vez, sin tener que traer la lista completa de `/cerradas` y
    buscar el id ahí.

    404 si la atención no existe, no está cerrada, o nunca llegó a
    tener encabezado -- mismo criterio de "no hay nada útil que
    mostrar" que ya usa `/cerradas` (ahí simplemente no aparece en la
    lista; acá, al pedir una puntual, sí hace falta decir por qué).
    """
    atencion = db.execute(
        select(Atencion)
        .options(
            joinedload(Atencion.ambulancia),
            joinedload(Atencion.conductor),
            joinedload(Atencion.responsable),
        )
        .where(Atencion.id == atencion_id)
    ).scalar_one_or_none()
    if atencion is None or atencion.estado != EstadoAtencion.cerrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Atención no encontrada, o no está cerrada",
        )
    if atencion.tipo == TipoAtencion.traslado:
        formato: FormatoTraslado | FormatoAccidenteSoat | None = db.get(
            FormatoTraslado, atencion_id
        )
    else:
        formato = db.get(FormatoAccidenteSoat, atencion_id)
    if formato is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta atención nunca llegó a tener encabezado",
        )
    return _construir_atencion_cerrada_out(atencion, formato)


def _atencion_por_client_id(client_id: str, db: DbSession) -> Atencion | None:
    return db.execute(
        select(Atencion).where(Atencion.client_id == client_id)
    ).scalar_one_or_none()
 
 
@router.post(
    "",
    response_model=AtencionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_personal_operativo)],
)
def crear_atencion(
    datos: AtencionCreate, usuario: CurrentUser, db: DbSession, response: Response
) -> Atencion:
    # Idempotencia por `client_id` (issue #10, ADR-0008): si ya existe
    # una atención con este client_id, es un reintento de sincronización
    # — se devuelve la fila ya creada (200), sin repetir las
    # validaciones de disponibilidad de ambulancia/conductor (que
    # fallarían igual, porque esa misma atención ya las dejó ocupadas).
    if datos.client_id is not None:
        existente = _atencion_por_client_id(datos.client_id, db)
        if existente is not None:
            response.status_code = status.HTTP_200_OK
            return existente
 
    responsable = _empleado_del_usuario(usuario, db)
 
    ambulancia = db.get(Ambulancia, datos.ambulancia_id)
    if ambulancia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ambulancia no encontrada"
        )
    if not ambulancia.activa:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Esa ambulancia no está activa"
        )
    if ambulancia.id in _ambulancias_con_atencion_abierta(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esa ambulancia ya tiene una atención abierta",
        )
 
    conductor = db.get(Empleado, datos.conductor_id)
    if conductor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Conductor no encontrado"
        )
    if not conductor.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ese conductor no está activo"
        )
    if conductor.id in _conductores_con_atencion_abierta(db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese conductor ya tiene una atención abierta",
        )
    # Issue #62: quien inicia la atención (el responsable) no puede
    # ser también su propio conductor, aunque tenga ambos roles — los
    # roles mixtos existen (ver ADR-0005), pero en una misma atención
    # cada uno desempeña un solo papel. El filtro de
    # `listar_conductores_disponibles` ya lo oculta de la lista; esta
    # es la validación real, por si el cliente manda el id de todos
    # modos.
    if conductor.id == responsable.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No puedes ser el conductor de tu propia atención",
        )
 
    atencion = Atencion(
        tipo=datos.tipo,
        ambulancia_id=ambulancia.id,
        conductor_id=conductor.id,
        responsable_id=responsable.id,
        estado=EstadoAtencion.abierto,
        abierta_en=datetime.now(UTC),
        client_id=datos.client_id,
    )
    db.add(atencion)
    db.commit()
 
    # Recargar con las relaciones ya cargadas: AtencionOut las necesita
    # anidadas (ambulancia, conductor, responsable) y por defecto
    # SQLAlchemy las traería perezosamente, una consulta por cada una.
    atencion_id = atencion.id
    atencion = db.execute(
        select(Atencion)
        .options(
            joinedload(Atencion.ambulancia),
            joinedload(Atencion.conductor),
            joinedload(Atencion.responsable),
        )
        .where(Atencion.id == atencion_id)
    ).scalar_one()
    return atencion
 
 
def _atencion_de_accidente_soat(atencion_id: int, db: DbSession) -> Atencion:
    """Igual que `_atencion_de_traslado`, pero para el formato de
    accidente SOAT (issue #17) -- el encabezado de este formato no
    aplica a una atencion de traslado.
    """
    atencion = db.get(Atencion, atencion_id)
    if atencion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Atencion no encontrada"
        )
    if atencion.tipo != TipoAtencion.atencion_soat:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta atencion no es de accidente SOAT, no tiene este formato",
        )
    return atencion
 
 
def _atencion_de_traslado(atencion_id: int, db: DbSession) -> Atencion:
    """Valida que la atención exista y sea de tipo `traslado` — el
    encabezado de este formato no aplica a una atención SOAT (issue #17
    tiene su propio formato, con sus propios campos).
    """
    atencion = db.get(Atencion, atencion_id)
    if atencion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Atención no encontrada"
        )
    if atencion.tipo != TipoAtencion.traslado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta atención no es de traslado, no tiene encabezado de traslado",
        )
    return atencion
 
 
def _regenerar_pdf(atencion: Atencion, formato: FormatoTraslado, db: DbSession) -> None:
    """Regenera el PDF del formato completo y lo guarda (issue #13,
    ADR-0011) — se llama después de cada guardado de encabezado o
    clínico, y al cerrar la atención, para que el PDF en la base de
    datos siempre refleje el último estado guardado en el servidor
    (en línea o por sincronización offline, mismos endpoints de
    siempre — ver ADR-0008).
    """
    formato.pdf_generado = generar_pdf_formato_traslado(atencion, formato)
    formato.pdf_generado_en = datetime.now(UTC)
    db.commit()
 
 
def _regenerar_pdf_soat(
    atencion: Atencion, formato: FormatoAccidenteSoat, db: DbSession
) -> None:
    """Igual que `_regenerar_pdf`, pero para el formato de accidente
    SOAT (issue #71) -- mismo motivo (ADR-0011): se llama después de
    cada guardado de encabezado o clínico, y al cerrar la atención.
 
    Issue #18: también se llama después de subir o borrar una foto,
    para que el PDF guardado siempre incluya las fotos que haya en
    ese momento (van al final, ver `generar_pdf_formato_accidente_soat`)
    -- por eso acá mismo se consultan, en vez de que cada llamador
    tenga que acordarse de pasarlas.
    """
    fotos = list(
        db.execute(
            select(FormatoAccidenteSoatFoto)
            .options(joinedload(FormatoAccidenteSoatFoto.subida_por))
            .where(FormatoAccidenteSoatFoto.atencion_id == atencion.id)
            .order_by(FormatoAccidenteSoatFoto.subida_en)
        )
        .scalars()
        .all()
    )
    formato.pdf_generado = generar_pdf_formato_accidente_soat(atencion, formato, fotos)
    formato.pdf_generado_en = datetime.now(UTC)
    db.commit()
 
 
# Campos que se copian a FormatoVersion antes de aplicar una corrección
# (issue #14, ADR-0012)
_CAMPOS_VERSIONADOS = (
    "paciente_tipo_documento",
    "paciente_numero_documento",
    "paciente_eps",
    "paciente_nombres",
    "paciente_apellidos",
    "paciente_edad",
    "paciente_sexo",
    "paciente_direccion_residencial",
    "paciente_ciudad",
    "paciente_telefono",
    "acompanante_nombres_apellidos",
    "acompanante_parentesco",
    "acompanante_telefono",
    "recepcion_fecha",
    "recepcion_hora",
    "recepcion_ciudad",
    "recepcion_ips",
    "recepcion_servicio",
    "entrega_fecha",
    "entrega_hora",
    "entrega_ciudad",
    "entrega_ips",
    "entrega_servicio",
    "complejidad",
    "categoria_paciente",
    "nivel_servicio",
    "modalidad",
    "tratamiento",
    "tratamiento_otro",
    "pupila_derecha",
    "pupila_izquierda",
    "signos_vitales",
    "lesiones_localizadas",
    "glasgow_ocular",
    "glasgow_verbal",
    "glasgow_motora",
    "insumos_entregados",
    "atendido_por",
    "firma_atendido_por",
    "evolucionado_por",
    "firma_evolucionado_por",
    "profesional_recibe_nombre",
    "profesional_recibe_cedula",
    "firma_profesional_recibe",
)
 
 
def _guardar_version(
    formato: FormatoTraslado, usuario: Usuario, motivo: str, db: DbSession
) -> None:
    """Copia el estado actual de `formato` a `formato_version` antes de
    que una corrección de administrador lo sobreescriba (issue #14,
    ADR-0012) — se llama siempre ANTES de aplicar los campos nuevos.
    No hace `commit`: queda en la misma transacción que la corrección,
    para que ambas cosas se guarden juntas o ninguna lo haga.

    `motivo` (issue #80) lo exige el llamador (`_motivo_requerido`),
    no esta función -- acá solo se guarda.
    """
    version = FormatoVersion(
        atencion_id=formato.atencion_id,
        corregido_por_id=usuario.id,
        corregido_en=datetime.now(UTC),
        motivo=motivo,
        **{campo: getattr(formato, campo) for campo in _CAMPOS_VERSIONADOS},
    )
    db.add(version)
 
 
def _es_admin(usuario: Usuario) -> bool:
    return any(asignacion.rol.nombre == "administrador" for asignacion in usuario.roles)


def _motivo_requerido(motivo: str | None) -> str:
    """Issue #80: corregir un formato ya cerrado exige decir por qué
    -- a diferencia del resto del cuerpo de la petición (que sigue
    siendo el mismo `FormatoTrasladoEncabezado`/`...Clinico` de
    siempre, para no tocar el contrato que ya usa la app móvil al
    llenar en caliente), `motivo` viaja como query param separado:
    solo esta rama (atención cerrada, corrección de administrador) lo
    exige, así que no tenía sentido meterlo en el schema del cuerpo
    que también usa el llenado normal, donde no aplica.
    """
    if motivo is None or not motivo.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corregir un formato ya cerrado exige indicar el motivo",
        )
    return motivo.strip()
 
 
def _es_personal_clinico(usuario: Usuario) -> bool:
    nombres_roles = {asignacion.rol.nombre for asignacion in usuario.roles}
    return bool(nombres_roles & {"auxiliar_enfermeria", "medico"})
 
 
# Issue #18 (corregido tras QA -- ver abajo): formatos aceptados para
# una foto del accidente. HEIC/HEIF, el formato nativo de la cámara de
# muchos iPhone, se queda afuera a propósito: no lo sabe mostrar
# ningún navegador (salvo Safari) ni WeasyPrint sin una conversión
# aparte -- si el cliente la necesita, es un issue propio, no algo que
# valga la pena resolver "de paso" acá.
#
# El primer intento de esto confiaba en el `content_type` que manda el
# navegador/app (`UploadFile.content_type`) para decidir qué aceptar
# -- resultó ser poco confiable en la práctica: un JPG real, bajado de
# Facebook o reenviado por WhatsApp, puede llegar con un
# `Content-Type` que el cliente HTTP mandó mal, genérico
# ("application/octet-stream") o con una variante no estándar
# ("image/jpg" en vez de "image/jpeg") -- y esta ruta lo rechazaba
# igual, aunque la foto en sí fuera perfectamente válida. Ahora se
# decodifica el archivo de verdad con Pillow (`_detectar_formato_foto`
# más abajo) y se decide por lo que el archivo *es*, no por lo que el
# cliente dice que es -- lo mismo que ya hace WeasyPrint/Pillow para
# embeber logo y firma en el PDF.
_FORMATOS_PILLOW_A_CONTENT_TYPE = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
    "GIF": "image/gif",
    "BMP": "image/bmp",
}
 
 
def _detectar_formato_foto(contenido: bytes) -> str | None:
    """Content-type real de una foto, a partir de sus bytes (no de lo
    que mande el cliente) -- `None` si Pillow no puede abrirla, o si
    es un formato que no está en `_FORMATOS_PILLOW_A_CONTENT_TYPE`
    (p. ej. HEIC, que Pillow sin un plugin aparte ni siquiera logra
    identificar, así que ya cae solo en el primer caso)."""
    try:
        with Image.open(io.BytesIO(contenido)) as imagen:
            formato = imagen.format
            imagen.verify()
    except Exception:
        # Pillow puede fallar con excepciones bastante distintas según
        # qué tan roto/qué tan poco una imagen sea un archivo de
        # imagen -- cualquiera de ellas significa lo mismo acá: "esto
        # no es una foto válida", 422, no un 500.
        return None
    return _FORMATOS_PILLOW_A_CONTENT_TYPE.get(formato or "")
# 8 MB -- de sobra para una foto ya comprimida por la cámara de un
# celular (unos pocos MB en JPEG), pero sin dejar subir cualquier cosa
# sin límite (quedan como blobs en la base de datos).
_TAMANIO_MAXIMO_FOTO_BYTES = 8 * 1024 * 1024
 
 
def _puede_gestionar_fotos_soat(atencion: Atencion, usuario: Usuario) -> bool:
    """Issue #18: a diferencia del resto del formato -- donde
    cualquier auxiliar/médico puede editar cualquier atención, ver el
    comentario en `cerrar_atencion` sobre por qué -- el cliente pidió
    explícitamente que las fotos solo las pueda subir o borrar el
    auxiliar/médico que atendió *esa* atención en particular, o
    cualquier administrador.
    """
    if _es_admin(usuario):
        return True
    return _es_personal_clinico(usuario) and atencion.responsable_id == usuario.empleado_id
 
 
@router.get(
    "/{atencion_id}/formato-traslado",
    response_model=FormatoTrasladoOut,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def obtener_encabezado_traslado(atencion_id: int, db: DbSession) -> FormatoTraslado:
    _atencion_de_traslado(atencion_id, db)
    formato = db.get(FormatoTraslado, atencion_id)
    if formato is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta atención todavía no tiene encabezado de traslado",
        )
    return formato
 
 
@router.put(
    "/{atencion_id}/formato-traslado",
    response_model=FormatoTrasladoOut,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def guardar_encabezado_traslado(
    atencion_id: int,
    datos: FormatoTrasladoEncabezado,
    usuario: CurrentUser,
    db: DbSession,
    motivo: str | None = Query(default=None),
) -> FormatoTraslado:
    """Crea o actualiza el encabezado.

    Mientras la atención sigue `abierta`, el auxiliar o médico la
    reescribe libremente, las veces que haga falta (ADR-0002): no hay
    un endpoint de creación separado de uno de edición, es el mismo
    formulario completo cada vez. El administrador NO edita acá
    mientras está abierta — ese sigue siendo trabajo del auxiliar/
    médico de turno (ADR-0006).

    Una vez `cerrada`, solo el administrador puede seguir editando —
    es una corrección (issue #14, ADR-0012; `motivo` obligatorio desde
    el #80, ver `_motivo_requerido`) — y el estado anterior del
    formato se guarda en `formato_version` antes de sobreescribirlo.
    """
    atencion = _atencion_de_traslado(atencion_id, db)

    if atencion.estado == EstadoAtencion.abierto:
        if _es_admin(usuario) and not _es_personal_clinico(usuario):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "El administrador no edita atenciones abiertas, "
                    "eso lo hace el auxiliar o médico de turno"
                ),
            )
        formato = db.get(FormatoTraslado, atencion_id)
        if formato is None:
            formato = FormatoTraslado(atencion_id=atencion_id)
            db.add(formato)
    else:
        if not _es_admin(usuario):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La atención ya está cerrada, solo un administrador puede corregirla",
            )
        motivo_validado = _motivo_requerido(motivo)
        formato = db.get(FormatoTraslado, atencion_id)
        if formato is None:
            formato = FormatoTraslado(atencion_id=atencion_id)
            db.add(formato)
        else:
            _guardar_version(formato, usuario, motivo_validado, db)
 
    for campo, valor in datos.model_dump().items():
        setattr(formato, campo, valor)
 
    db.commit()
    db.refresh(formato)
    _regenerar_pdf(atencion, formato, db)
    return formato
 
 
@router.put(
    "/{atencion_id}/formato-traslado/clinico",
    response_model=FormatoTrasladoOut,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def guardar_clinico_traslado(
    atencion_id: int,
    datos: FormatoTrasladoClinico,
    usuario: CurrentUser,
    db: DbSession,
    motivo: str | None = Query(default=None),
) -> FormatoTraslado:
    """Guarda la parte clínica del formato (issue #9).

    A diferencia del encabezado, esta parte se llena progresivamente
    durante el traslado (signos vitales en el tiempo, notas de
    evolución) — por eso `FormatoTrasladoClinico` tiene todo opcional.
    Pero sigue sin haber un PATCH parcial: cada PUT manda el estado
    completo de la parte clínica tal como esté hasta ese momento (ver
    ADR-0007).

    Requiere que el encabezado ya exista — mismo registro (ADR-0006),
    no tiene sentido diligenciar lo clínico de un traslado que ni
    siquiera se ha recibido.

    Igual que el encabezado: una vez `cerrada` la atención, solo el
    administrador puede seguir corrigiendo (issue #14, ADR-0012;
    `motivo` obligatorio desde el #80), y el estado anterior se guarda
    en `formato_version` antes de aplicar la corrección.
    """
    atencion = _atencion_de_traslado(atencion_id, db)

    if atencion.estado == EstadoAtencion.abierto:
        if _es_admin(usuario) and not _es_personal_clinico(usuario):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "El administrador no edita atenciones abiertas, "
                    "eso lo hace el auxiliar o médico de turno"
                ),
            )
        formato = db.get(FormatoTraslado, atencion_id)
        if formato is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esta atención todavía no tiene encabezado — guárdalo primero",
            )
    else:
        if not _es_admin(usuario):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La atención ya está cerrada, solo un administrador puede corregirla",
            )
        formato = db.get(FormatoTraslado, atencion_id)
        if formato is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esta atención no tiene encabezado, no hay nada que corregir",
            )
        # El 404 de arriba va primero: no tiene sentido pedir un
        # motivo para corregir algo que ni siquiera existe.
        motivo_validado = _motivo_requerido(motivo)
        _guardar_version(formato, usuario, motivo_validado, db)
 
    for campo, valor in datos.model_dump().items():
        setattr(formato, campo, valor)
 
    db.commit()
    db.refresh(formato)
    _regenerar_pdf(atencion, formato, db)
    return formato
 
 
def _campos_faltantes_para_cerrar(formato: FormatoTraslado) -> list[str]:
    """Issue #57 -- qué le falta al formato clínico de un traslado
    para poder cerrarlo. `nota_medica` solo es obligatoria si el
    nivel de servicio es `medicalizado` (siempre va un médico); en
    `basico` sigue siendo opcional, igual que antes -- el campo no se
    oculta, solo no se exige.
 
    Issue #55 (ADR-0014) -- "entrega del paciente" se agrega acá
    también: desde que esas 5 columnas pasaron a nullable (se piden
    recién al cerrar, no en el encabezado inicial), hace falta esta
    validación para que no se pueda cerrar sin haberlas llenado --
    antes esto lo garantizaba Pydantic solo con que el campo fuera
    obligatorio en el schema del encabezado.
 
    No se llama si la atención nunca llegó a tener encabezado (ver el
    único `if formato is not None` en `cerrar_atencion`) -- cerrar sin
    haber empezado a llenar nada sigue permitido, para un servicio que
    se cancela antes de atender a nadie.
    """
    faltantes: list[str] = []
    if not formato.signos_vitales:
        faltantes.append("signos vitales")
    if (
        formato.glasgow_ocular is None
        or formato.glasgow_verbal is None
        or formato.glasgow_motora is None
    ):
        faltantes.append("escala de Glasgow")
    if not formato.diagnostico:
        faltantes.append("diagnóstico")
    if not formato.nota_auxiliar:
        faltantes.append("nota de enfermería")
    if formato.nivel_servicio == NivelServicioTraslado.medicalizado and not formato.nota_medica:
        faltantes.append("nota médica (obligatoria en traslado medicalizado)")
    if formato.entrega_fecha is None or formato.entrega_hora is None:
        faltantes.append("fecha y hora de entrega")
    if not formato.entrega_ciudad:
        faltantes.append("ciudad de entrega")
    if not formato.entrega_ips:
        faltantes.append("IPS de entrega")
    if not formato.entrega_servicio:
        faltantes.append("servicio de entrega")
    return faltantes
 
 
@router.put(
    "/{atencion_id}/cerrar",
    response_model=AtencionOut,
    dependencies=[Depends(require_personal_clinico)],
)
def cerrar_atencion(
    atencion_id: int, datos: PinRequest, usuario: CurrentUser, db: DbSession
) -> Atencion:
    """Cierra la atención con el PIN de firma (issue #12, ADR-0002,
    ADR-0010).
 
    A partir de este momento, ni el encabezado ni la parte clínica se
    pueden seguir editando "libremente" (ya lo exigen `estado ==
    abierto` las rutas de arriba) — una edición posterior necesita
    permiso del administrador y queda en el historial de versiones
    (issue #14, ADR-0012).
 
    Cualquier auxiliar/médico puede cerrar cualquier atención abierta
    (no se exige que sea el mismo `responsable_id` que la creó) — es
    el mismo criterio de permiso que ya rige para editar el formato
    clínico, no uno más estricto.
 
    El PIN se revalida siempre contra el hash real en la base de
    datos, así el dispositivo haya "pre-validado" con un hash local
    más liviano (ver ADR-0010) — ese hash local es solo para dar
    feedback rápido sin conexión, nunca la autorización real.
 
    Issue #57 — un traslado con encabezado guardado no se puede cerrar
    si le faltan campos clínicos obligatorios (ver
    `_campos_faltantes_para_cerrar`). Un traslado que nunca llegó a
    tener encabezado se puede cerrar igual (servicio cancelado antes
    de atender a nadie, ver ADR-0002).
 
    Issue #17 — una atención SOAT tiene la misma validación, con su
    propia lista de campos obligatorios (ver
    `_campos_faltantes_para_cerrar_soat`): un paciente NN sin
    identificar sigue sin poder cerrarse así de por vida, pero un NN
    *todavía sin identificar en el momento del cierre* no bloquea el
    cierre -- completar su identidad después es una corrección como
    cualquier otra (ver `FormatoAccidenteSoatVersion`).
    """
    atencion = db.get(Atencion, atencion_id)
    if atencion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Atención no encontrada"
        )
    if atencion.estado != EstadoAtencion.abierto:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Esta atención ya está cerrada"
        )
    if atencion.tipo == TipoAtencion.traslado:
        formato_actual = db.get(FormatoTraslado, atencion_id)
        if formato_actual is not None:
            faltantes = _campos_faltantes_para_cerrar(formato_actual)
            if faltantes:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Faltan campos obligatorios para cerrar: {', '.join(faltantes)}",
                )
    elif atencion.tipo == TipoAtencion.atencion_soat:
        formato_soat_actual = db.get(FormatoAccidenteSoat, atencion_id)
        if formato_soat_actual is not None:
            faltantes_soat = _campos_faltantes_para_cerrar_soat(formato_soat_actual)
            if faltantes_soat:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Faltan campos obligatorios para cerrar: {', '.join(faltantes_soat)}",
                )
    if usuario.pin_hash is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Todavía no has configurado tu PIN de firma",
        )
    if not verify_secret(datos.pin, usuario.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="PIN incorrecto"
        )
 
    atencion.estado = EstadoAtencion.cerrado
    atencion.cerrada_en = datetime.now(UTC)
    db.commit()
 
    atencion = db.execute(
        select(Atencion)
        .options(
            joinedload(Atencion.ambulancia),
            joinedload(Atencion.conductor),
            joinedload(Atencion.responsable),
        )
        .where(Atencion.id == atencion_id)
    ).scalar_one()
 
    # Si nunca llegó a tener encabezado, no hay nada que renderizar —
    # se puede cerrar igual (ver ADR-0002), simplemente sin PDF.
    formato = db.get(FormatoTraslado, atencion_id)
    if formato is not None:
        _regenerar_pdf(atencion, formato, db)
    formato_soat = db.get(FormatoAccidenteSoat, atencion_id)
    if formato_soat is not None:
        _regenerar_pdf_soat(atencion, formato_soat, db)
 
    return atencion
 
 
@router.get(
    "/{atencion_id}/formato-traslado/pdf",
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def descargar_pdf_formato_traslado(atencion_id: int, db: DbSession) -> Response:
    """Descarga el último PDF generado del formato (issue #13,
    ADR-0011) — no lo genera al vuelo: siempre es el que quedó
    guardado en el último `PUT` de encabezado/clínico, o al cerrar.
 
    404 si la atención ni siquiera tiene encabezado todavía (nunca se
    generó nada) — no debería pasar que *tenga* encabezado y no tenga
    PDF, porque ambos endpoints de guardado siempre regeneran uno
    (ver `_regenerar_pdf`), pero se valida igual en vez de asumirlo.
    """
    _atencion_de_traslado(atencion_id, db)
    formato = db.get(FormatoTraslado, atencion_id)
    if formato is None or formato.pdf_generado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta atención todavía no tiene un PDF generado",
        )
    return Response(content=formato.pdf_generado, media_type="application/pdf")
 
 
@router.get(
    "/{atencion_id}/formato-traslado/historial",
    response_model=list[FormatoVersionOut],
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def historial_formato_traslado(atencion_id: int, db: DbSession) -> list[FormatoVersion]:
    """Lista las correcciones hechas por un administrador sobre este
    formato (issue #14, ADR-0012), más reciente primero — cada una es
    el estado del formato justo *antes* de esa corrección.
 
    Vacío (no 404) si nunca hubo una corrección — es un estado normal,
    no un error: la mayoría de atenciones nunca van a tener nada acá.
    """
    _atencion_de_traslado(atencion_id, db)
    versiones = db.execute(
        select(FormatoVersion)
        .options(joinedload(FormatoVersion.corregido_por))
        .where(FormatoVersion.atencion_id == atencion_id)
        .order_by(FormatoVersion.corregido_en.desc())
    ).scalars().all()
    return list(versiones)
 
 
# --- Formato de accidente SOAT (issue #17) ---------------------------------
#
# Mismo patrón que el formato de traslado de arriba (encabezado + clínico,
# ambos PUT con el formulario completo cada vez, misma lógica de permisos
# abierto/cerrado, mismo mecanismo de versionado) -- ver cada función para
# las diferencias puntuales (el paciente puede ser NN, no hay PDF todavía).
 
# Campos que se copian a FormatoAccidenteSoatVersion antes de aplicar una
# corrección (mismo mecanismo que _CAMPOS_VERSIONADOS para traslado).
_CAMPOS_VERSIONADOS_SOAT = (
    "fecha_atencion",
    "hora_atencion",
    "hora_entrega",
    "identificado",
    "paciente_tipo_documento",
    "paciente_numero_documento",
    "paciente_aseguradora",
    "paciente_nombres",
    "paciente_apellidos",
    "paciente_edad",
    "paciente_sexo",
    "lugar_ocurrencia",
    "ciudad",
    "telefono_contacto",
    "rol_victima",
    "poliza_vigente_desde",
    "poliza_vigente_hasta",
    "numero_poliza",
    "vehiculo_placa",
    "vehiculo_tipo",
    "vehiculo_marca",
    "tratamiento",
    "tratamiento_otro",
    "pupila_derecha",
    "pupila_izquierda",
    "signos_vitales",
    "lesiones_localizadas",
    "glasgow_ocular",
    "glasgow_verbal",
    "glasgow_motora",
    "triage",
    "descripcion",
    "nota_auxiliar",
    "atendido_por",
    "firma_atendido_por",
    "nota_medica",
    "evolucionado_por",
    "firma_evolucionado_por",
    "profesional_recibe_nombre",
    "profesional_recibe_cedula",
    "firma_profesional_recibe",
)
 
 
def _guardar_version_soat(
    formato: FormatoAccidenteSoat, usuario: Usuario, motivo: str, db: DbSession
) -> None:
    """Igual que `_guardar_version`, pero para el formato de accidente
    SOAT -- no hace `commit`, queda en la misma transacción que la
    corrección.
    """
    version = FormatoAccidenteSoatVersion(
        atencion_id=formato.atencion_id,
        corregido_por_id=usuario.id,
        corregido_en=datetime.now(UTC),
        motivo=motivo,
        **{campo: getattr(formato, campo) for campo in _CAMPOS_VERSIONADOS_SOAT},
    )
    db.add(version)
 
 
def _campos_faltantes_para_cerrar_soat(formato: FormatoAccidenteSoat) -> list[str]:
    """Qué le falta al formato de accidente SOAT para poder cerrarlo --
    mismo criterio que `_campos_faltantes_para_cerrar` para traslado,
    con sus propios campos obligatorios.
 
    Si el paciente sigue siendo NN (`identificado=False`) al momento
    del cierre, los campos de identidad NO se exigen -- completarlos
    después es una corrección como cualquier otra (ADR-0002, ver
    `FormatoAccidenteSoatVersion`). Si en cambio `identificado=True`,
    sí se exige al menos el nombre y el número de documento: ya no hay
    razón para dejarlos en blanco.
    """
    faltantes: list[str] = []
    if not formato.signos_vitales:
        faltantes.append("signos vitales")
    if (
        formato.glasgow_ocular is None
        or formato.glasgow_verbal is None
        or formato.glasgow_motora is None
    ):
        faltantes.append("escala de Glasgow")
    if formato.triage is None:
        faltantes.append("triage")
    if not formato.descripcion:
        faltantes.append("descripción de la atención")
    if formato.identificado and not (
        formato.paciente_nombres
        and formato.paciente_apellidos
        and formato.paciente_numero_documento
    ):
        faltantes.append("identidad del paciente (marcado como identificado)")
    return faltantes
 
 
@router.get(
    "/{atencion_id}/formato-accidente-soat",
    response_model=FormatoAccidenteSoatOut,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def obtener_encabezado_accidente_soat(
    atencion_id: int, db: DbSession
) -> FormatoAccidenteSoat:
    _atencion_de_accidente_soat(atencion_id, db)
    formato = db.get(FormatoAccidenteSoat, atencion_id)
    if formato is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta atención todavía no tiene formato de accidente SOAT",
        )
    return formato
 
 
@router.put(
    "/{atencion_id}/formato-accidente-soat",
    response_model=FormatoAccidenteSoatOut,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def guardar_encabezado_accidente_soat(
    atencion_id: int,
    datos: FormatoAccidenteSoatEncabezado,
    usuario: CurrentUser,
    db: DbSession,
    motivo: str | None = Query(default=None),
) -> FormatoAccidenteSoat:
    """Crea o actualiza el encabezado del formato de accidente SOAT --
    misma lógica de permisos abierto/cerrado (y `motivo` obligatorio
    al corregir, issue #80) que `guardar_encabezado_traslado` (ver esa
    función para el porqué de cada decisión).
    """
    atencion = _atencion_de_accidente_soat(atencion_id, db)

    if atencion.estado == EstadoAtencion.abierto:
        if _es_admin(usuario) and not _es_personal_clinico(usuario):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "El administrador no edita atenciones abiertas, "
                    "eso lo hace el auxiliar o médico de turno"
                ),
            )
        formato = db.get(FormatoAccidenteSoat, atencion_id)
        if formato is None:
            formato = FormatoAccidenteSoat(atencion_id=atencion_id)
            db.add(formato)
    else:
        if not _es_admin(usuario):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La atención ya está cerrada, solo un administrador puede corregirla",
            )
        motivo_validado = _motivo_requerido(motivo)
        formato = db.get(FormatoAccidenteSoat, atencion_id)
        if formato is None:
            formato = FormatoAccidenteSoat(atencion_id=atencion_id)
            db.add(formato)
        else:
            _guardar_version_soat(formato, usuario, motivo_validado, db)
 
    for campo, valor in datos.model_dump().items():
        setattr(formato, campo, valor)
 
    db.commit()
    db.refresh(formato)
    _regenerar_pdf_soat(atencion, formato, db)
    return formato
 
 
@router.put(
    "/{atencion_id}/formato-accidente-soat/clinico",
    response_model=FormatoAccidenteSoatOut,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def guardar_clinico_accidente_soat(
    atencion_id: int,
    datos: FormatoAccidenteSoatClinico,
    usuario: CurrentUser,
    db: DbSession,
    motivo: str | None = Query(default=None),
) -> FormatoAccidenteSoat:
    """Guarda la parte clínica del formato de accidente SOAT -- misma
    lógica que `guardar_clinico_traslado` (ver esa función), incluido
    requerir que el encabezado ya exista y, al corregir, el `motivo`
    (issue #80).
    """
    atencion = _atencion_de_accidente_soat(atencion_id, db)

    if atencion.estado == EstadoAtencion.abierto:
        if _es_admin(usuario) and not _es_personal_clinico(usuario):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "El administrador no edita atenciones abiertas, "
                    "eso lo hace el auxiliar o médico de turno"
                ),
            )
        formato = db.get(FormatoAccidenteSoat, atencion_id)
        if formato is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esta atención todavía no tiene encabezado — guárdalo primero",
            )
    else:
        if not _es_admin(usuario):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La atención ya está cerrada, solo un administrador puede corregirla",
            )
        formato = db.get(FormatoAccidenteSoat, atencion_id)
        if formato is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Esta atención no tiene encabezado, no hay nada que corregir",
            )
        # Mismo criterio que en `guardar_clinico_traslado`: el 404 va
        # primero.
        motivo_validado = _motivo_requerido(motivo)
        _guardar_version_soat(formato, usuario, motivo_validado, db)
 
    for campo, valor in datos.model_dump().items():
        setattr(formato, campo, valor)
 
    db.commit()
    db.refresh(formato)
    _regenerar_pdf_soat(atencion, formato, db)
    return formato
 
 
@router.get(
    "/{atencion_id}/formato-accidente-soat/pdf",
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def descargar_pdf_formato_accidente_soat(atencion_id: int, db: DbSession) -> Response:
    """Descarga el último PDF generado del formato de accidente SOAT
    (issue #71) -- mismo criterio que `descargar_pdf_formato_traslado`:
    nunca lo genera al vuelo, siempre el que quedó guardado en el
    último `PUT` de encabezado/clínico, o al cerrar.
    """
    _atencion_de_accidente_soat(atencion_id, db)
    formato = db.get(FormatoAccidenteSoat, atencion_id)
    if formato is None or formato.pdf_generado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta atención todavía no tiene un PDF generado",
        )
    return Response(content=formato.pdf_generado, media_type="application/pdf")
 
 
@router.get(
    "/{atencion_id}/formato-accidente-soat/historial",
    response_model=list[FormatoAccidenteSoatVersionOut],
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def historial_formato_accidente_soat(
    atencion_id: int, db: DbSession
) -> list[FormatoAccidenteSoatVersion]:
    """Igual que `historial_formato_traslado`, pero para el formato de
    accidente SOAT.
    """
    _atencion_de_accidente_soat(atencion_id, db)
    versiones = db.execute(
        select(FormatoAccidenteSoatVersion)
        .options(joinedload(FormatoAccidenteSoatVersion.corregido_por))
        .where(FormatoAccidenteSoatVersion.atencion_id == atencion_id)
        .order_by(FormatoAccidenteSoatVersion.corregido_en.desc())
    ).scalars().all()
    return list(versiones)
 
 
# --- Fotos del accidente SOAT, adjuntadas después del cierre (issue #18) ---
 
 
@router.get(
    "/{atencion_id}/formato-accidente-soat/fotos",
    response_model=list[FormatoAccidenteSoatFotoOut],
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def listar_fotos_accidente_soat(
    atencion_id: int, db: DbSession
) -> list[FormatoAccidenteSoatFoto]:
    """Metadatos de las fotos adjuntas (sin el contenido binario, ver
    `FormatoAccidenteSoatFotoOut`) -- cualquiera que pueda ver el
    formato puede ver qué fotos tiene, aunque solo el que atendió (o
    un admin) pueda subir/borrar (`_puede_gestionar_fotos_soat`).
    """
    _atencion_de_accidente_soat(atencion_id, db)
    fotos = db.execute(
        select(FormatoAccidenteSoatFoto)
        .options(joinedload(FormatoAccidenteSoatFoto.subida_por))
        .where(FormatoAccidenteSoatFoto.atencion_id == atencion_id)
        .order_by(FormatoAccidenteSoatFoto.subida_en)
    ).scalars().all()
    return list(fotos)
 
 
@router.post(
    "/{atencion_id}/formato-accidente-soat/fotos",
    response_model=FormatoAccidenteSoatFotoOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
async def subir_foto_accidente_soat(
    atencion_id: int,
    usuario: CurrentUser,
    db: DbSession,
    archivo: UploadFile = File(...),
) -> FormatoAccidenteSoatFoto:
    """Adjunta una foto del accidente (issue #18): "El auxiliar, el
    medico o el administrador pueden adjuntar fotos mas adelante, no
    en el momento del accidente."
 
    Solo se puede subir una vez la atención ya está cerrada (ver nota
    de módulo en `app/models/formato_accidente_soat_foto.py`) -- y
    solo el auxiliar/médico que la atendió, o un administrador
    (`_puede_gestionar_fotos_soat`). El PDF guardado se regenera al
    final para que ya incluya esta foto (ADR-0011).
    """
    atencion = _atencion_de_accidente_soat(atencion_id, db)
    if atencion.estado != EstadoAtencion.cerrado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se pueden adjuntar fotos a una atención ya cerrada",
        )
    if not _puede_gestionar_fotos_soat(atencion, usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Solo el auxiliar o médico que atendió esta atención, o un "
                "administrador, puede adjuntar fotos"
            ),
        )
    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El archivo está vacío"
        )
    if len(contenido) > _TAMANIO_MAXIMO_FOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La foto no puede superar los 8 MB",
        )
    # No se confía en `archivo.content_type` (lo que mande el
    # navegador/app) -- ver el comentario de módulo sobre por qué eso
    # rechazaba JPG reales. Se decide por los bytes de verdad.
    content_type_real = _detectar_formato_foto(contenido)
    if content_type_real is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "El archivo no parece ser una foto válida, o es un formato no "
                "soportado (p. ej. HEIC, el de muchos iPhone -- hay que "
                "exportarla como JPEG o PNG antes de subirla). Se aceptan "
                "JPEG, PNG, WEBP, GIF y BMP."
            ),
        )
 
    foto = FormatoAccidenteSoatFoto(
        atencion_id=atencion_id,
        contenido=contenido,
        content_type=content_type_real,
        tamanio_bytes=len(contenido),
        subida_por_id=usuario.id,
        subida_en=datetime.now(UTC),
    )
    db.add(foto)
    db.commit()
 
    formato = db.get(FormatoAccidenteSoat, atencion_id)
    if formato is not None:
        _regenerar_pdf_soat(atencion, formato, db)
 
    # `_regenerar_pdf_soat` hace su propio commit, que deja `foto`
    # "expirada" (SQLAlchemy recarga sus atributos en el próximo
    # acceso) -- se refresca una sola vez acá, después de todo lo
    # demás, para no hacerlo dos veces.
    db.refresh(foto)
    return foto
 
 
@router.get(
    "/{atencion_id}/formato-accidente-soat/fotos/{foto_id}",
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def descargar_foto_accidente_soat(atencion_id: int, foto_id: int, db: DbSession) -> Response:
    """Devuelve el contenido binario de una foto puntual -- aparte de
    `listar_fotos_accidente_soat`, que solo trae metadatos (mismo
    criterio que el PDF ya guardado,
    `descargar_pdf_formato_accidente_soat`)."""
    _atencion_de_accidente_soat(atencion_id, db)
    foto = db.get(FormatoAccidenteSoatFoto, foto_id)
    if foto is None or foto.atencion_id != atencion_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")
    return Response(content=foto.contenido, media_type=foto.content_type)
 
 
@router.delete(
    "/{atencion_id}/formato-accidente-soat/fotos/{foto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    # FastAPI infiere `response_model=NoneType` a partir de `-> None`
    # (no es lo mismo que `response_model=None`), y eso le basta para
    # creer que la ruta devuelve cuerpo -- 204 no admite cuerpo, así
    # que hay que decirle explícitamente que no hay response_model.
    response_model=None,
    dependencies=[Depends(require_personal_clinico_o_admin)],
)
def eliminar_foto_accidente_soat(
    atencion_id: int, foto_id: int, usuario: CurrentUser, db: DbSession
) -> None:
    """Borra una foto adjunta -- mismo permiso que subirla
    (`_puede_gestionar_fotos_soat`): el auxiliar/médico que atendió,
    o un administrador. El PDF guardado se regenera para que deje de
    incluirla.
    """
    atencion = _atencion_de_accidente_soat(atencion_id, db)
    foto = db.get(FormatoAccidenteSoatFoto, foto_id)
    if foto is None or foto.atencion_id != atencion_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")
    if not _puede_gestionar_fotos_soat(atencion, usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Solo el auxiliar o médico que atendió esta atención, o un "
                "administrador, puede borrar fotos"
            ),
        )
 
    db.delete(foto)
    db.commit()
 
    formato = db.get(FormatoAccidenteSoat, atencion_id)
    if formato is not None:
        _regenerar_pdf_soat(atencion, formato, db)