"""Fixtures compartidas de pytest.

Sobreescribe la configuración para pruebas (SECRET_KEY de prueba, base de
datos SQLite en memoria) en vez de depender de que exista un .env real,
para que `pytest` funcione igual en CI que en cualquier máquina.
"""

import os

os.environ.setdefault("SECRET_KEY", "clave-de-pruebas-no-usar-en-produccion-0000000000")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")

import pytest
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
