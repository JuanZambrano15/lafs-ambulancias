"""Login, renovación de token y PIN de firma.
 
El PIN de firma se define en el primer login del usuario (decisión del
28/09/2026) y se puede cambiar en cualquier momento desde `/auth/pin` —
no hay un flujo separado de "primera vez" en el backend, el frontend
decide cuándo mostrar esa pantalla mirando `pin_configurado` en la
respuesta de `/auth/login`.
 
El refresh token es sin estado (no se guarda en la base de datos):
alcanza con que la firma sea válida y no haya expirado. Esto significa
que no se puede revocar un refresh token antes de que expire por su
cuenta — se acepta esa limitación por ahora (ver ADR si más adelante el
cliente pide poder cerrar sesión de un dispositivo remotamente, eso
obligaría a una tabla de tokens revocados).
"""
 
from __future__ import annotations
 
import jwt
from fastapi import APIRouter, HTTPException, status
 
from app.api.deps import CurrentUser, DbSession
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_secret,
    verify_secret,
)
from app.models.usuario import Usuario
from app.schemas.auth import (
    AccessTokenResponse,
    CambiarPasswordRequest,
    LoginRequest,
    PinRequest,
    RefreshRequest,
    TokenResponse,
)
 
router = APIRouter(prefix="/auth", tags=["autenticación"])
 
_credenciales_invalidas = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Documento o contraseña incorrectos",
)
 
 
@router.post("/login", response_model=TokenResponse)
def login(datos: LoginRequest, db: DbSession) -> TokenResponse:
    usuario = db.query(Usuario).filter(Usuario.documento == datos.documento).first()
 
    # Mismo mensaje de error exista o no el usuario: no darle a quien
    # intenta adivinar credenciales una forma de confirmar qué
    # documentos están registrados en el sistema.
    if (
        usuario is None
        or not usuario.activo
        or not verify_secret(datos.password, usuario.password_hash)
    ):
        raise _credenciales_invalidas
 
    subject = str(usuario.id)
    return TokenResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
        pin_configurado=usuario.pin_hash is not None,
        debe_cambiar_password=usuario.debe_cambiar_password,
    )
 
 
@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(datos: RefreshRequest) -> AccessTokenResponse:
    error_refresh = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido o expirado",
    )
    try:
        payload = decode_token(datos.refresh_token)
    except jwt.PyJWTError:
        raise error_refresh from None
 
    if payload.get("type") != "refresh":
        raise error_refresh
 
    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise error_refresh
 
    return AccessTokenResponse(access_token=create_access_token(subject))
 
 
@router.put("/pin", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def establecer_pin(datos: PinRequest, usuario: CurrentUser, db: DbSession) -> None:
    """Define o cambia el PIN de firma del usuario autenticado.
 
    Sin restricción de "solo la primera vez": el usuario lo puede
    cambiar cuando quiera, con solo tener una sesión válida (no se pide
    la contraseña de nuevo, a diferencia de una recuperación de cuenta —
    es una decisión consciente para no fraccionar el flujo, se puede
    endurecer más adelante si el cliente lo pide).
    """
    usuario.pin_hash = hash_secret(datos.pin)
    db.commit()
 
 
@router.put("/password", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def cambiar_password(datos: CambiarPasswordRequest, usuario: CurrentUser, db: DbSession) -> None:
    """Cambia la contraseña del usuario autenticado.
 
    Pide la contraseña actual (a diferencia del PIN) porque esta sí es
    la credencial de acceso completa a la cuenta — incluye el caso del
    primer login, donde la "actual" es el documento (ver issue #4).
    """
    if not verify_secret(datos.password_actual, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña actual incorrecta",
        )
 
    usuario.password_hash = hash_secret(datos.password_nueva)
    usuario.debe_cambiar_password = False
    db.commit()