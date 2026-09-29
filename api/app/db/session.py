"""Motor y sesiones de SQLAlchemy.

`get_db` es la dependencia de FastAPI que entrega una sesión por
petición y la cierra siempre al terminar (éxito o excepción), para no
dejar conexiones abiertas colgadas bajo carga.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_settings = get_settings()

engine = create_engine(
    str(_settings.database_url),
    pool_pre_ping=True,  # evita usar conexiones muertas tras un reinicio de Postgres
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
