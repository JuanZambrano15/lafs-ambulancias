"""Configuración de la aplicación, leída de variables de entorno.
 
Nunca se ponen valores reales (contraseñas, claves) directamente en este
archivo: todos vienen de `.env` (desarrollo) o de los secretos del
entorno de despliegue (producción). Ver `.env.example` para la lista
completa de variables esperadas.
"""
 
from functools import lru_cache
from typing import Literal
 
from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict
 
 
class Settings(BaseSettings):
    """Configuración tipada y validada al arrancar la aplicación.
 
    Si falta una variable requerida o tiene un tipo inválido, la app no
    arranca — es mejor fallar rápido al iniciar que descubrirlo en medio
    de una petición en producción.
    """
 
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
 
    environment: Literal["development", "production", "test"] = "development"
 
    database_url: PostgresDsn
 
    secret_key: str = Field(..., min_length=32)
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
 
    api_docs_enabled: bool = True
 
    # Usuario administrador con el que arranca el sistema (issue #4):
    # la migración que siembra los roles lo crea con este documento y
    # esta contraseña, igual que cualquier otro usuario nuevo —
    # obligado a cambiarla en su primer login.
    admin_seed_documento: str
    admin_seed_password: str = Field(..., min_length=8)
 
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
 
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
 
 
@lru_cache
def get_settings() -> Settings:
    """Se cachea con lru_cache para no releer/validar el entorno en cada
    petición; en pruebas se puede sobreescribir con
    `app.dependency_overrides` sobre esta función.
    """
    return Settings()  # type: ignore[call-arg]  # los valores vienen del entorno