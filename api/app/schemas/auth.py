"""Esquemas de entrada/salida del módulo de autenticación."""
 
from __future__ import annotations
 
from pydantic import BaseModel, Field
 
 
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