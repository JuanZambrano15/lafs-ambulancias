"""Iniciar una atención: elegir móvil, tipo y conductor (issue #7).
 
Solo el personal operativo (auxiliar de enfermería, médico, conductor)
puede iniciar una atención — ver `require_personal_operativo` en
`app/api/deps.py` y ADR-0005 para el porqué de cada decisión.
 
El responsable (quien llena el formato) es siempre quien está logueado,
nunca un dato que mande el cliente: sale de `usuario.empleado_id`.
"""
 
from __future__ import annotations
 
from datetime import UTC, datetime
 
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload
 
from app.api.deps import (
    CurrentUser,
    DbSession,
    require_personal_clinico,
    require_personal_clinico_o_admin,
    require_personal_operativo,
)
from app.core.security import verify_secret
from app.models.ambulancia import Ambulancia
from app.models.atencion import Atencion, EstadoAtencion, TipoAtencion
from app.models.empleado import Empleado
from app.models.formato_traslado import FormatoTraslado
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.pdf.formato_traslado import generar_pdf_formato_traslado
from app.schemas.ambulancia import AmbulanciaOut
from app.schemas.atencion import AtencionCreate, AtencionOut
from app.schemas.auth import PinRequest
from app.schemas.empleado import EmpleadoOut
from app.schemas.formato_traslado import (
    FormatoTrasladoClinico,
    FormatoTrasladoEncabezado,
    FormatoTrasladoOut,
)
 
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
def listar_conductores_disponibles(db: DbSession) -> list[Empleado]:
    """Empleados activos cuyo usuario tiene el rol "conductor", y que
    no están ya manejando otra atención abierta.
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
    return list(query.order_by(Empleado.apellidos, Empleado.nombres).all())
 
 
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
 
 
@router.get(
    "/{atencion_id}/formato-traslado",
    response_model=FormatoTrasladoOut,
    dependencies=[Depends(require_personal_clinico)],
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
    dependencies=[Depends(require_personal_clinico)],
)
def guardar_encabezado_traslado(
    atencion_id: int, datos: FormatoTrasladoEncabezado, db: DbSession
) -> FormatoTraslado:
    """Crea o actualiza el encabezado — mientras la atención sigue
    `abierta` se puede reescribir libremente, las veces que haga falta
    (ADR-0002): no hay un endpoint de creación separado de uno de
    edición, es el mismo formulario completo cada vez.
    """
    atencion = _atencion_de_traslado(atencion_id, db)
    if atencion.estado != EstadoAtencion.abierto:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La atención ya está cerrada, el encabezado no se puede editar así",
        )
 
    formato = db.get(FormatoTraslado, atencion_id)
    if formato is None:
        formato = FormatoTraslado(atencion_id=atencion_id)
        db.add(formato)
 
    for campo, valor in datos.model_dump().items():
        setattr(formato, campo, valor)
 
    db.commit()
    db.refresh(formato)
    _regenerar_pdf(atencion, formato, db)
    return formato
 
 
@router.put(
    "/{atencion_id}/formato-traslado/clinico",
    response_model=FormatoTrasladoOut,
    dependencies=[Depends(require_personal_clinico)],
)
def guardar_clinico_traslado(
    atencion_id: int, datos: FormatoTrasladoClinico, db: DbSession
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
    """
    atencion = _atencion_de_traslado(atencion_id, db)
    if atencion.estado != EstadoAtencion.abierto:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La atención ya está cerrada, la parte clínica no se puede editar así",
        )
 
    formato = db.get(FormatoTraslado, atencion_id)
    if formato is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta atención todavía no tiene encabezado — guárdalo primero",
        )
 
    for campo, valor in datos.model_dump().items():
        setattr(formato, campo, valor)
 
    db.commit()
    db.refresh(formato)
    _regenerar_pdf(atencion, formato, db)
    return formato
 
 
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
    abierto` las rutas de arriba) — una edición posterior necesitaría
    permiso del administrador y quedar en el historial de versiones
    (issue #14, todavía no existe).
 
    Cualquier auxiliar/médico puede cerrar cualquier atención abierta
    (no se exige que sea el mismo `responsable_id` que la creó) — es
    el mismo criterio de permiso que ya rige para editar el formato
    clínico, no uno más estricto.
 
    El PIN se revalida siempre contra el hash real en la base de
    datos, así el dispositivo haya "pre-validado" con un hash local
    más liviano (ver ADR-0010) — ese hash local es solo para dar
    feedback rápido sin conexión, nunca la autorización real.
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