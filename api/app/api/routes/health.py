"""Endpoint de verificación de salud.

Usado por el healthcheck de Docker Compose (ver docker-compose.yml) y por
el paso "Verificación de salud de la API" del pipeline de publicación
descrito en el documento de diseño.
"""

from fastapi import APIRouter, status
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import DbSession

router = APIRouter(tags=["salud"])


class HealthResponse(BaseModel):
    status: str
    database: str


@router.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def health_check(db: DbSession) -> HealthResponse:
    try:
        db.execute(text("SELECT 1"))
        database_status = "ok"
    except Exception:  # noqa: BLE001 — cualquier fallo de DB se reporta igual, sin filtrar detalles
        database_status = "error"

    return HealthResponse(status="ok", database=database_status)
