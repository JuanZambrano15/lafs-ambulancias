"""Punto de entrada de la API de LAFS Ambulancias."""

from fastapi import FastAPI

from app.api.routes import auth, health
from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging()

app = FastAPI(
    title="LAFS Ambulancias API",
    description=(
        "API para los formatos de traslado, atención de accidentes SOAT, "
        "chequeos de ambulancia e insumos, e inventario de medicamentos."
    ),
    version="0.1.0",
    # Nunca exponer la documentación interactiva en producción sin control de acceso.
    docs_url="/docs" if settings.api_docs_enabled and not settings.is_production else None,
    redoc_url="/redoc" if settings.api_docs_enabled and not settings.is_production else None,
)

app.include_router(health.router)
app.include_router(auth.router)

# Los routers de atenciones, formatos, chequeos y reportes se agregan
# aquí a medida que se implementan (ver el backlog en GitHub Issues).
# Los routers de auth, atenciones, formatos, chequeos y reportes se agregan
# aquí a medida que se implementan (ver el backlog en GitHub Issues).
