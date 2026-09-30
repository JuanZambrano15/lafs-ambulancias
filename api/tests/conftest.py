"""Fixtures compartidas de pytest.

Sobreescribe la configuración para pruebas (SECRET_KEY de prueba) y la
base de datos (SQLite en memoria, en vez de la Postgres real de
`.env`) para que `pytest` funcione igual en CI que en cualquier
máquina, sin depender de un servicio de base de datos levantado aparte.
"""

import os
from collections.abc import Generator

os.environ.setdefault("SECRET_KEY", "clave-de-pruebas-no-usar-en-produccion-0000000000")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

import app.models  # noqa: F401  (registra los modelos en Base.metadata)
import pytest
from app.db.base import Base
from app.db.session import get_db
from app.main import app as fastapi_app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


@pytest.fixture
def db(monkeypatch: pytest.MonkeyPatch) -> Generator[Session, None, None]:
    """Base de datos limpia por test: crea todas las tablas, las borra
    al terminar, para que un test no vea datos que dejó otro.
    """
    Base.metadata.create_all(_engine)
    session = _TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(_engine)


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def _override_get_db() -> Generator[Session, None, None]:
        yield db

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(fastapi_app)
    finally:
        fastapi_app.dependency_overrides.clear()