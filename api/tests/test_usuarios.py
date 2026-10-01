from fastapi.testclient import TestClient
 
 
def test_crear_usuario_contrasena_inicial_es_el_documento(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/usuarios", json={"documento": "222222222", "roles": []}, headers=admin_headers
    )
 
    assert response.status_code == 201
    body = response.json()
    assert body["debe_cambiar_password"] is True
    assert body["roles"] == []
 
    login = client.post("/auth/login", json={"documento": "222222222", "password": "222222222"})
    assert login.status_code == 200
    assert login.json()["debe_cambiar_password"] is True
 
 
def test_crear_usuario_con_roles(client: TestClient, admin_headers: dict[str, str]) -> None:
    rol = client.post("/roles", json={"nombre": "conductor"}, headers=admin_headers).json()
 
    response = client.post(
        "/usuarios",
        json={"documento": "333333333", "roles": [rol["id"]]},
        headers=admin_headers,
    )
 
    assert response.status_code == 201
    nombres_roles = {r["nombre"] for r in response.json()["roles"]}
    assert nombres_roles == {"conductor"}
 
 
def test_crear_usuario_con_rol_inexistente_da_422(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/usuarios", json={"documento": "444444444", "roles": [9999]}, headers=admin_headers
    )
 
    assert response.status_code == 422
 
 
def test_crear_usuario_con_empleado_inexistente_da_422(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/usuarios",
        json={"documento": "555555555", "empleado_id": 9999, "roles": []},
        headers=admin_headers,
    )
 
    assert response.status_code == 422
 
 
def test_crear_usuario_documento_duplicado_da_409(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    client.post("/usuarios", json={"documento": "666666666", "roles": []}, headers=admin_headers)
 
    response = client.post(
        "/usuarios", json={"documento": "666666666", "roles": []}, headers=admin_headers
    )
 
    assert response.status_code == 409
 
 
def test_asignar_roles_reemplaza_los_anteriores(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    rol_a = client.post("/roles", json={"nombre": "conductor"}, headers=admin_headers).json()
    rol_b = client.post("/roles", json={"nombre": "contador"}, headers=admin_headers).json()
    usuario = client.post(
        "/usuarios",
        json={"documento": "777777777", "roles": [rol_a["id"]]},
        headers=admin_headers,
    ).json()
 
    response = client.put(
        f"/usuarios/{usuario['id']}/roles",
        json={"roles": [rol_b["id"]]},
        headers=admin_headers,
    )
 
    assert response.status_code == 200
    nombres_roles = {r["nombre"] for r in response.json()["roles"]}
    assert nombres_roles == {"contador"}
 
 
def test_resetear_password_vuelve_al_documento(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    usuario = client.post(
        "/usuarios", json={"documento": "888888888", "roles": []}, headers=admin_headers
    ).json()
    client.put(
        "/auth/password",
        json={"password_actual": "888888888", "password_nueva": "una-clave-nueva"},
        headers={
            "Authorization": "Bearer "
            + client.post(
                "/auth/login", json={"documento": "888888888", "password": "888888888"}
            ).json()["access_token"]
        },
    )
 
    response = client.post(f"/usuarios/{usuario['id']}/resetear-password", headers=admin_headers)
    assert response.status_code == 204
 
    login = client.post("/auth/login", json={"documento": "888888888", "password": "888888888"})
    assert login.status_code == 200
    assert login.json()["debe_cambiar_password"] is True
 
 
def test_desactivar_usuario_impide_login(client: TestClient, admin_headers: dict[str, str]) -> None:
    usuario = client.post(
        "/usuarios", json={"documento": "101010101", "roles": []}, headers=admin_headers
    ).json()
 
    response = client.delete(f"/usuarios/{usuario['id']}", headers=admin_headers)
    assert response.status_code == 204
 
    login = client.post("/auth/login", json={"documento": "101010101", "password": "101010101"})
    assert login.status_code == 401
 
 
def test_obtener_usuario_inexistente_da_404(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.get("/usuarios/9999", headers=admin_headers)
 
    assert response.status_code == 404