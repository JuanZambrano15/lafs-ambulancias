"""Dependencias comunes de FastAPI: sesión de base de datos, usuario
autenticado a partir del JWT, y permisos por rol.
"""
 
from collections.abc import Callable
from typing import Annotated
 
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
 
from app.core.security import decode_token
from app.db.session import get_db
from app.models.usuario import Usuario
 
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
 
DbSession = Annotated[Session, Depends(get_db)]
 
 
def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la sesión",
        headers={"WWW-Authenticate": "Bearer"},
    )
 
 
def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DbSession) -> Usuario:
    """Valida el JWT de la petición y devuelve el `Usuario` real de la
    base de datos (no solo su id), ya con el modelo de Usuario disponible
    desde el issue #2.
    """
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise _credentials_error() from None
 
    if payload.get("type") != "access":
        raise _credentials_error()
 
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.isdigit():
        raise _credentials_error()
 
    usuario = db.get(Usuario, int(subject))
    if usuario is None or not usuario.activo:
        raise _credentials_error()
 
    return usuario
 
 
CurrentUser = Annotated[Usuario, Depends(get_current_user)]
 
 
def require_roles(*nombres_permitidos: str) -> Callable[[Usuario], Usuario]:
    """Fábrica de dependencias de permiso: construye un chequeo de rol
    para el conjunto de nombres que se le pasen, en vez de un solo rol
    fijo. Se apoya en `get_current_user`, así que un token inválido o
    expirado da 401 antes de llegar a revisar el rol — un 403 solo
    puede pasar con una sesión ya válida.
 
    Hace falta porque no todos los endpoints son "solo administrador"
    (issue #4): por ejemplo, el contador también necesita poder
    consultar ambulancias, aunque no pueda crearlas ni editarlas
    (issue #5).
    """
    permitidos = set(nombres_permitidos)
 
    def _verificar(usuario: CurrentUser) -> Usuario:
        nombres_roles = {asignacion.rol.nombre for asignacion in usuario.roles}
        if not nombres_roles & permitidos:
            lista_roles = ", ".join(sorted(permitidos))
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Esta acción requiere alguno de estos roles: {lista_roles}",
            )
        return usuario
 
    return _verificar
 
 
require_admin = require_roles("administrador")
require_admin_o_contador = require_roles("administrador", "contador")
# Personal que sale a la calle en la ambulancia (issue #7): quienes
# pueden iniciar una atención. El administrador queda afuera a
# propósito — programar atenciones por adelantado es otra discusión
# (ver docs/adr/0005-crear-atencion-y-elegir-movil.md).
require_personal_operativo = require_roles("auxiliar_enfermeria", "medico", "conductor")
# Quienes diligencian el contenido clínico de un formato (issue #8 en
# adelante): a diferencia de `require_personal_operativo`, el
# conductor queda afuera — él elige el móvil y conduce, pero no llena
# el formato (ver docs/adr/0006-encabezado-formato-traslado.md).
require_personal_clinico = require_roles("auxiliar_enfermeria", "medico")
 
AdminUser = Annotated[Usuario, Depends(require_admin)]