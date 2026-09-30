"""Dependencias comunes de FastAPI: sesión de base de datos y usuario
autenticado a partir del JWT.

Los permisos por rol (administrador, auxiliar, conductor, contador) se
construyen sobre `get_current_user`, añadiendo dependencias específicas
por endpoint a medida que se implementen los módulos de usuarios y
roles (issue #4 del backlog).
"""

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