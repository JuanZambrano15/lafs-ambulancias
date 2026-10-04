"""Esquemas de entrada/salida del módulo de autenticación."""
 
from __future__ import annotations
 
from pydantic import BaseModel, Field
 
from app.schemas.rol import RolOut
 
 
class LoginRequest(BaseModel):
    documento: str
    password: str
 
 
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    # Le dice al frontend si debe llevar al usuario al flujo de "definí tu
    # PIN de firma" antes de dejarlo cerrar formatos (issue #12).
    pin_configurado: bool
    # Le dice al frontend si debe forzar el cambio de contraseña antes de
    # dejar seguir: todo usuario nuevo arranca con la contraseña igual a
    # su documento (issue #4).
    debe_cambiar_password: bool
 
 
class RefreshRequest(BaseModel):
    refresh_token: str
 
 
class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
 
 
class PinRequest(BaseModel):
    # PIN numérico de 4 dígitos, igual que un PIN de tarjeta: fácil de
    # teclear rápido en una tablet, en medio de una atención.
    pin: str = Field(pattern=r"^\d{4}$")
 
 
class CambiarPasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str = Field(min_length=8, max_length=255)
 
 
class MeResponse(BaseModel):
    """Perfil del usuario autenticado, con sus roles.
 
    Hace falta porque `TokenResponse` (la respuesta de `/auth/login`)
    no trae los roles del usuario, y el único endpoint que sí los
    devuelve (`GET /usuarios/{id}`) está restringido a administrador —
    un auxiliar o conductor no puede usarlo para consultar su propio
    perfil. Este endpoint solo exige una sesión válida (`CurrentUser`),
    sin chequeo de rol, porque cada usuario únicamente puede consultar
    su propia información (issue #6: lo necesita el frontend para
    decidir qué navegación mostrarle a cada rol).
    """
 
    documento: str
    activo: bool
    empleado_id: int | None
    debe_cambiar_password: bool
    pin_configurado: bool
    roles: list[RolOut]