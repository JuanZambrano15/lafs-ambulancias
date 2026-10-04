from app.core.security import hash_secret
from app.models.usuario import Usuario
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
 
 
def _crear_usuario(
    db: Session, documento: str = "123456789", password: str = "clave-segura"
) -> Usuario:
    usuario = Usuario(documento=documento, password_hash=hash_secret(password))
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario
 
 
def test_login_correcto_devuelve_tokens(client: TestClient, db: Session) -> None:
    _crear_usuario(db)
 
    response = client.post(
        "/auth/login", json={"documento": "123456789", "password": "clave-segura"}
    )
 
    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["pin_configurado"] is False
 
 
def test_login_password_incorrecta_da_401(client: TestClient, db: Session) -> None:
    _crear_usuario(db)
 
    response = client.post("/auth/login", json={"documento": "123456789", "password": "mala"})
 
    assert response.status_code == 401
 
 
def test_login_usuario_inexistente_da_401(client: TestClient) -> None:
    response = client.post("/auth/login", json={"documento": "000000000", "password": "lo-que-sea"})
 
    assert response.status_code == 401
 
 
def test_login_usuario_inactivo_da_401(client: TestClient, db: Session) -> None:
    usuario = _crear_usuario(db)
    usuario.activo = False
    db.commit()
 
    response = client.post(
        "/auth/login", json={"documento": "123456789", "password": "clave-segura"}
    )
 
    assert response.status_code == 401
 
 
def test_refresh_devuelve_access_token_nuevo(client: TestClient, db: Session) -> None:
    _crear_usuario(db)
    login = client.post("/auth/login", json={"documento": "123456789", "password": "clave-segura"})
 
    response = client.post("/auth/refresh", json={"refresh_token": login.json()["refresh_token"]})
 
    assert response.status_code == 200
    assert response.json()["access_token"]
 
 
def test_refresh_con_access_token_falla(client: TestClient, db: Session) -> None:
    """Un access token no sirve como refresh token: son propósitos distintos."""
    _crear_usuario(db)
    login = client.post("/auth/login", json={"documento": "123456789", "password": "clave-segura"})
 
    response = client.post("/auth/refresh", json={"refresh_token": login.json()["access_token"]})
 
    assert response.status_code == 401
 
 
def test_establecer_pin_primera_vez(client: TestClient, db: Session) -> None:
    _crear_usuario(db)
    login = client.post("/auth/login", json={"documento": "123456789", "password": "clave-segura"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
 
    response = client.put("/auth/pin", json={"pin": "1234"}, headers=headers)
 
    assert response.status_code == 204
 
    login_de_nuevo = client.post(
        "/auth/login", json={"documento": "123456789", "password": "clave-segura"}
    )
    assert login_de_nuevo.json()["pin_configurado"] is True
 
 
def test_cambiar_pin_ya_configurado(client: TestClient, db: Session) -> None:
    """El PIN se puede cambiar en cualquier momento, no solo la primera vez."""
    usuario = _crear_usuario(db)
    usuario.pin_hash = hash_secret("1111")
    db.commit()
    login = client.post("/auth/login", json={"documento": "123456789", "password": "clave-segura"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
 
    response = client.put("/auth/pin", json={"pin": "2222"}, headers=headers)
 
    assert response.status_code == 204
 
 
def test_pin_no_numerico_es_rechazado(client: TestClient, db: Session) -> None:
    _crear_usuario(db)
    login = client.post("/auth/login", json={"documento": "123456789", "password": "clave-segura"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
 
    response = client.put("/auth/pin", json={"pin": "12ab"}, headers=headers)
 
    assert response.status_code == 422
 
 
def test_establecer_pin_sin_token_da_401(client: TestClient) -> None:
    response = client.put("/auth/pin", json={"pin": "1234"})
 
    assert response.status_code == 401
 
 
def test_cambiar_password_correcto(client: TestClient, db: Session) -> None:
    _crear_usuario(db)
    login = client.post("/auth/login", json={"documento": "123456789", "password": "clave-segura"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
 
    response = client.put(
        "/auth/password",
        json={"password_actual": "clave-segura", "password_nueva": "otra-clave-larga"},
        headers=headers,
    )
 
    assert response.status_code == 204
 
    login_con_clave_vieja = client.post(
        "/auth/login", json={"documento": "123456789", "password": "clave-segura"}
    )
    assert login_con_clave_vieja.status_code == 401
 
    login_con_clave_nueva = client.post(
        "/auth/login", json={"documento": "123456789", "password": "otra-clave-larga"}
    )
    assert login_con_clave_nueva.status_code == 200
    assert login_con_clave_nueva.json()["debe_cambiar_password"] is False
 
 
def test_cambiar_password_actual_incorrecta_da_401(client: TestClient, db: Session) -> None:
    _crear_usuario(db)
    login = client.post("/auth/login", json={"documento": "123456789", "password": "clave-segura"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
 
    response = client.put(
        "/auth/password",
        json={"password_actual": "clave-mala", "password_nueva": "otra-clave-larga"},
        headers=headers,
    )
 
    assert response.status_code == 401
 
 
def test_me_devuelve_perfil_y_roles(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.get("/auth/me", headers=admin_headers)
 
    assert response.status_code == 200
    body = response.json()
    assert body["documento"] == "999999999"
    assert body["activo"] is True
    assert body["debe_cambiar_password"] is True
    assert body["pin_configurado"] is False
    assert [rol["nombre"] for rol in body["roles"]] == ["administrador"]
 
 
def test_me_sin_token_da_401(client: TestClient) -> None:
    response = client.get("/auth/me")
 
    assert response.status_code == 401