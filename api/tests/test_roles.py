from app.core.security import hash_secret
from app.models.rol import Rol
from app.models.usuario import Usuario
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
 
 
def test_listar_roles_sin_token_da_401(client: TestClient) -> None:
    response = client.get("/roles")
 
    assert response.status_code == 401
 
 
def test_listar_roles_sin_rol_admin_da_403(client: TestClient, db: Session) -> None:
    usuario = Usuario(documento="111111111", password_hash=hash_secret("clave"))
    db.add(usuario)
    db.commit()
    login = client.post("/auth/login", json={"documento": "111111111", "password": "clave"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
 
    response = client.get("/roles", headers=headers)
 
    assert response.status_code == 403
 
 
def test_crear_y_listar_rol(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.post(
        "/roles",
        json={"nombre": "auditor", "descripcion": "Solo lectura de reportes"},
        headers=admin_headers,
    )
 
    assert response.status_code == 201
    assert response.json()["nombre"] == "auditor"
 
    listado = client.get("/roles", headers=admin_headers)
    nombres = {rol["nombre"] for rol in listado.json()}
    assert "auditor" in nombres
    assert "administrador" in nombres
 
 
def test_crear_rol_duplicado_da_409(client: TestClient, admin_headers: dict[str, str]) -> None:
    client.post("/roles", json={"nombre": "auditor"}, headers=admin_headers)
 
    response = client.post("/roles", json={"nombre": "auditor"}, headers=admin_headers)
 
    assert response.status_code == 409
 
 
def test_actualizar_rol(client: TestClient, admin_headers: dict[str, str]) -> None:
    creado = client.post("/roles", json={"nombre": "auditor"}, headers=admin_headers)
    rol_id = creado.json()["id"]
 
    response = client.patch(
        f"/roles/{rol_id}", json={"descripcion": "Actualizado"}, headers=admin_headers
    )
 
    assert response.status_code == 200
    assert response.json()["descripcion"] == "Actualizado"
 
 
def test_eliminar_rol_sin_usuarios(client: TestClient, admin_headers: dict[str, str]) -> None:
    creado = client.post("/roles", json={"nombre": "auditor"}, headers=admin_headers)
    rol_id = creado.json()["id"]
 
    response = client.delete(f"/roles/{rol_id}", headers=admin_headers)
 
    assert response.status_code == 204
 
 
def test_eliminar_rol_con_usuarios_da_409(
    client: TestClient, admin_headers: dict[str, str], db: Session
) -> None:
    rol_admin = db.query(Rol).filter(Rol.nombre == "administrador").one()
 
    response = client.delete(f"/roles/{rol_admin.id}", headers=admin_headers)
 
    assert response.status_code == 409
 
 
def test_obtener_rol_inexistente_da_404(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.get("/roles/9999", headers=admin_headers)
 
    assert response.status_code == 404