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


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PinRequest(BaseModel):
    # PIN numérico de 4 dígitos, igual que un PIN de tarjeta: fácil de
    # teclear rápido en una tablet, en medio de una atención.
    pin: str = Field(pattern=r"^\d{4}$")
