"""Dependencias comunes de FastAPI: sesión de base de datos y usuario
autenticado a partir del JWT.

Los permisos por rol (administrador, auxiliar, conductor, contador) se
construyen sobre `get_current_user`, añadiendo dependencias específicas
por endpoint a medida que se implementen los módulos de usuarios y
roles (issues #3 y #4 del backlog).
"""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user_id(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> str:
    """Valida el JWT de la petición y devuelve el id del usuario (`sub`).

    No consulta la base de datos todavía: eso se agrega junto con el
    modelo de Usuario (issue #2), para no acoplar esta dependencia a un
    modelo que aún no existe.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar la sesión",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise credentials_error from None

    if payload.get("type") != "access":
        raise credentials_error

    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise credentials_error

    return subject
