"""CRUD de usuarios y asignación de roles — solo administrador (issue #4).
 
La contraseña inicial de un usuario nuevo no la define el admin: se
genera igual al documento (decisión del 30/09/2026) y queda marcada
con `debe_cambiar_password=True`; el propio usuario la cambia desde
`PUT /auth/password` en su primer login. El mismo mecanismo
(`/resetear-password`) sirve para resetear la contraseña de alguien
que la olvidó, sin necesitar un flujo aparte de recuperación por ahora.
 
El borrado también es "soft" (`activo=False`), igual que empleados:
preserva el historial y es justo lo que ya revisa `get_current_user`
para negar el login a un usuario desactivado.
"""
 
from __future__ import annotations
 
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
 
from app.api.deps import DbSession, require_admin
from app.core.security import hash_secret
from app.models.empleado import Empleado
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from app.schemas.rol import RolOut
from app.schemas.usuario import AsignarRolesRequest, UsuarioCreate, UsuarioOut, UsuarioUpdate
 
router = APIRouter(prefix="/usuarios", tags=["usuarios"], dependencies=[Depends(require_admin)])
 
_usuario_duplicado = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Ya existe un usuario con ese documento",
)
_empleado_inexistente = HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail="El empleado indicado no existe",
)
 
 
def _a_usuario_out(usuario: Usuario) -> UsuarioOut:
    return UsuarioOut(
        id=usuario.id,
        documento=usuario.documento,
        activo=usuario.activo,
        empleado_id=usuario.empleado_id,
        debe_cambiar_password=usuario.debe_cambiar_password,
        roles=[RolOut.model_validate(asignacion.rol) for asignacion in usuario.roles],
    )
 
 
def _obtener_usuario(usuario_id: int, db: DbSession) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return usuario
 
 
def _validar_empleado_id(empleado_id: int | None, db: DbSession) -> None:
    if empleado_id is not None and db.get(Empleado, empleado_id) is None:
        raise _empleado_inexistente
 
 
def _asignar_roles(usuario: Usuario, rol_ids: list[int], db: DbSession) -> None:
    ids_unicos = list(dict.fromkeys(rol_ids))
    if ids_unicos:
        encontrados = db.query(Rol.id).filter(Rol.id.in_(ids_unicos)).count()
        if encontrados != len(ids_unicos):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Uno o más roles no existen",
            )
    usuario.roles = [UsuarioRol(rol_id=rol_id) for rol_id in ids_unicos]
 
 
@router.get("", response_model=list[UsuarioOut])
def listar_usuarios(db: DbSession) -> list[UsuarioOut]:
    usuarios = (
        db.query(Usuario)
        .options(selectinload(Usuario.roles).selectinload(UsuarioRol.rol))
        .order_by(Usuario.documento)
        .all()
    )
    return [_a_usuario_out(usuario) for usuario in usuarios]
 
 
@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(datos: UsuarioCreate, db: DbSession) -> UsuarioOut:
    _validar_empleado_id(datos.empleado_id, db)
 
    usuario = Usuario(
        documento=datos.documento,
        password_hash=hash_secret(datos.documento),
        empleado_id=datos.empleado_id,
        debe_cambiar_password=True,
    )
    db.add(usuario)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise _usuario_duplicado from None
 
    _asignar_roles(usuario, datos.roles, db)
    db.commit()
    db.refresh(usuario)
    return _a_usuario_out(usuario)
 
 
@router.get("/{usuario_id}", response_model=UsuarioOut)
def obtener_usuario(usuario_id: int, db: DbSession) -> UsuarioOut:
    return _a_usuario_out(_obtener_usuario(usuario_id, db))
 
 
@router.patch("/{usuario_id}", response_model=UsuarioOut)
def actualizar_usuario(usuario_id: int, datos: UsuarioUpdate, db: DbSession) -> UsuarioOut:
    usuario = _obtener_usuario(usuario_id, db)
    cambios = datos.model_dump(exclude_unset=True)
    if "empleado_id" in cambios:
        _validar_empleado_id(cambios["empleado_id"], db)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    db.commit()
    db.refresh(usuario)
    return _a_usuario_out(usuario)
 
 
@router.put("/{usuario_id}/roles", response_model=UsuarioOut)
def asignar_roles(usuario_id: int, datos: AsignarRolesRequest, db: DbSession) -> UsuarioOut:
    usuario = _obtener_usuario(usuario_id, db)
    _asignar_roles(usuario, datos.roles, db)
    db.commit()
    db.refresh(usuario)
    return _a_usuario_out(usuario)
 
 
@router.post(
    "/{usuario_id}/resetear-password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
def resetear_password(usuario_id: int, db: DbSession) -> None:
    """Vuelve la contraseña del usuario a su documento y lo obliga a
    cambiarla de nuevo — el mismo mecanismo que la creación inicial,
    reutilizado para cuando alguien la olvida.
    """
    usuario = _obtener_usuario(usuario_id, db)
    usuario.password_hash = hash_secret(usuario.documento)
    usuario.debe_cambiar_password = True
    db.commit()
 
 
@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def desactivar_usuario(usuario_id: int, db: DbSession) -> None:
    usuario = _obtener_usuario(usuario_id, db)
    usuario.activo = False
    db.commit()