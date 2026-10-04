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
os.environ.setdefault("ADMIN_SEED_DOCUMENTO", "1000000000")
os.environ.setdefault("ADMIN_SEED_PASSWORD", "clave-admin-de-pruebas")
 
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
 
 
@pytest.fixture
def admin_headers(client: TestClient, db: Session) -> dict[str, str]:
    """Crea un usuario con rol "administrador" y devuelve el header
    `Authorization` listo para usar — lo necesitan todos los endpoints
    de /roles, /empleados y /usuarios (issue #4).
    """
    from app.core.security import hash_secret
    from app.models.rol import Rol
    from app.models.usuario import Usuario
    from app.models.usuario_rol import UsuarioRol
 
    rol = Rol(nombre="administrador", descripcion="Rol de prueba")
    db.add(rol)
    db.flush()
 
    usuario = Usuario(documento="999999999", password_hash=hash_secret("clave-admin"))
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.commit()
 
    login = client.post("/auth/login", json={"documento": "999999999", "password": "clave-admin"})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
 
 
@pytest.fixture
def contador_headers(client: TestClient, db: Session) -> dict[str, str]:
    """Usuario con rol "contador" — solo lectura en /ambulancias
    (issue #5), a diferencia de `admin_headers`.
    """
    from app.core.security import hash_secret
    from app.models.rol import Rol
    from app.models.usuario import Usuario
    from app.models.usuario_rol import UsuarioRol
 
    rol = Rol(nombre="contador", descripcion="Rol de prueba")
    db.add(rol)
    db.flush()
 
    usuario = Usuario(documento="888888880", password_hash=hash_secret("clave-contador"))
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.commit()
 
    login = client.post(
        "/auth/login", json={"documento": "888888880", "password": "clave-contador"}
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
 
 
@pytest.fixture
def auxiliar_headers(client: TestClient, db: Session) -> dict[str, str]:
    """Usuario con rol "auxiliar_enfermeria", ligado a un `Empleado` —
    a diferencia de `admin_headers`/`contador_headers`, este sí
    necesita `empleado_id` (issue #7: el responsable de una atención es
    el empleado ligado a quien está logueado).
    """
    from app.core.security import hash_secret
    from app.models.empleado import Empleado
    from app.models.rol import Rol
    from app.models.usuario import Usuario
    from app.models.usuario_rol import UsuarioRol
 
    empleado = Empleado(nombres="Ana", apellidos="Ruiz", cedula="700000001")
    db.add(empleado)
    db.flush()
 
    rol = Rol(nombre="auxiliar_enfermeria", descripcion="Rol de prueba")
    db.add(rol)
    db.flush()
 
    usuario = Usuario(
        documento="700000001",
        password_hash=hash_secret("clave-auxiliar"),
        empleado_id=empleado.id,
    )
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.commit()
 
    login = client.post(
        "/auth/login", json={"documento": "700000001", "password": "clave-auxiliar"}
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}