"""Hashing de contraseñas/PIN y emisión-validación de JWT.

Decisiones de seguridad (ver también SECURITY.md):
- Argon2id para hashear contraseñas y PIN de firma (no MD5/SHA/bcrypt
  antiguo). Argon2id es el ganador de la Password Hashing Competition y
  el recomendado actualmente por OWASP.
- Tokens de acceso de vida corta (15 min por defecto) más un refresh
  token de vida más larga, en vez de un único token de larga duración.
- La contraseña de cuenta y el PIN de firma se hashean por separado y
  nunca se comparan entre sí: comprometer uno no compromete el otro.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings

_settings = get_settings()
_password_hasher = PasswordHasher()

ALGORITHM = "HS256"


def hash_secret(plain: str) -> str:
    """Hashea una contraseña o un PIN. Usar siempre esta función, nunca
    guardar el valor plano ni implementar un hash "casero".
    """
    return _password_hasher.hash(plain)


def verify_secret(plain: str, hashed: str) -> bool:
    """Verifica una contraseña o PIN contra su hash guardado.

    Devuelve False ante cualquier fallo de verificación en vez de dejar
    propagar la excepción: el llamador no necesita distinguir "no
    coincide" de "hash corrupto", solo saber si el acceso se concede.
    """
    try:
        return _password_hasher.verify(hashed, plain)
    except VerifyMismatchError:
        return False


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """Crea un JWT de acceso de vida corta para el usuario `subject`
    (normalmente su id de usuario).
    """
    expire = datetime.now(UTC) + timedelta(minutes=_settings.access_token_expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "access"}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, _settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(UTC) + timedelta(days=_settings.refresh_token_expire_days)
    payload = {"sub": subject, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, _settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un JWT (firma y expiración).

    Lanza jwt.PyJWTError si el token es inválido o expiró; el llamador
    (la dependencia de FastAPI en app/api/deps.py) es responsable de
    convertir eso en un 401.
    """
    payload: dict[str, Any] = jwt.decode(token, _settings.secret_key, algorithms=[ALGORITHM])
    return payload
