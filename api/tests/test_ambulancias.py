from fastapi.testclient import TestClient
 
 
def _datos_ambulancia(movil: str = "M-01", placa: str = "ABC123") -> dict[str, str]:
    return {
        "movil": movil,
        "placa": placa,
        "tipo": "basica",
        "vencimiento_soat": "2027-01-01",
        "vencimiento_tecnomecanica": "2027-01-01",
    }
 
 
def test_listar_ambulancias_sin_token_da_401(client: TestClient) -> None:
    response = client.get("/ambulancias")
 
    assert response.status_code == 401
 
 
def test_crear_ambulancia_solo_admin(
    client: TestClient, admin_headers: dict[str, str], contador_headers: dict[str, str]
) -> None:
    response = client.post("/ambulancias", json=_datos_ambulancia(), headers=contador_headers)
    assert response.status_code == 403
 
    response = client.post("/ambulancias", json=_datos_ambulancia(), headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "basica"
    assert body["activa"] is True
 
 
def test_contador_puede_listar_y_consultar(
    client: TestClient, admin_headers: dict[str, str], contador_headers: dict[str, str]
) -> None:
    creada = client.post("/ambulancias", json=_datos_ambulancia(), headers=admin_headers)
    ambulancia_id = creada.json()["id"]
 
    listado = client.get("/ambulancias", headers=contador_headers)
    assert listado.status_code == 200
    assert len(listado.json()) == 1
 
    detalle = client.get(f"/ambulancias/{ambulancia_id}", headers=contador_headers)
    assert detalle.status_code == 200
 
 
def test_crear_ambulancia_movil_duplicado_da_409(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    client.post("/ambulancias", json=_datos_ambulancia(), headers=admin_headers)
 
    response = client.post(
        "/ambulancias",
        json=_datos_ambulancia(placa="XYZ789"),
        headers=admin_headers,
    )
 
    assert response.status_code == 409
 
 
def test_actualizar_ambulancia_solo_admin(
    client: TestClient, admin_headers: dict[str, str], contador_headers: dict[str, str]
) -> None:
    creada = client.post("/ambulancias", json=_datos_ambulancia(), headers=admin_headers)
    ambulancia_id = creada.json()["id"]
 
    rechazado = client.patch(
        f"/ambulancias/{ambulancia_id}",
        json={"placa": "NEW999"},
        headers=contador_headers,
    )
    assert rechazado.status_code == 403
 
    permitido = client.patch(
        f"/ambulancias/{ambulancia_id}",
        json={"placa": "NEW999"},
        headers=admin_headers,
    )
    assert permitido.status_code == 200
    assert permitido.json()["placa"] == "NEW999"
 
 
def test_listar_ambulancias_filtra_solo_activas(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    creada = client.post("/ambulancias", json=_datos_ambulancia(), headers=admin_headers)
    ambulancia_id = creada.json()["id"]
    client.delete(f"/ambulancias/{ambulancia_id}", headers=admin_headers)
 
    todas = client.get("/ambulancias", headers=admin_headers)
    solo_activas = client.get("/ambulancias?solo_activas=true", headers=admin_headers)
 
    assert len(todas.json()) == 1
    assert len(solo_activas.json()) == 0
 
 
def test_desactivar_ambulancia_solo_admin(
    client: TestClient, admin_headers: dict[str, str], contador_headers: dict[str, str]
) -> None:
    creada = client.post("/ambulancias", json=_datos_ambulancia(), headers=admin_headers)
    ambulancia_id = creada.json()["id"]
 
    rechazado = client.delete(f"/ambulancias/{ambulancia_id}", headers=contador_headers)
    assert rechazado.status_code == 403
 
    permitido = client.delete(f"/ambulancias/{ambulancia_id}", headers=admin_headers)
    assert permitido.status_code == 204
 
    consulta = client.get(f"/ambulancias/{ambulancia_id}", headers=admin_headers)
    assert consulta.json()["activa"] is False
 
 
def test_obtener_ambulancia_inexistente_da_404(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.get("/ambulancias/9999", headers=admin_headers)
 
    assert response.status_code == 404