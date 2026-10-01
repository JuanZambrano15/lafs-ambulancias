from fastapi.testclient import TestClient
 
 
def _datos_empleado(cedula: str = "123456789") -> dict[str, str]:
    return {
        "nombres": "Ana",
        "apellidos": "Pérez",
        "cedula": cedula,
        "telefono": "3001234567",
        "tipo_vinculacion": "ocasional",
    }
 
 
def test_crear_empleado(client: TestClient, admin_headers: dict[str, str]) -> None:
    response = client.post("/empleados", json=_datos_empleado(), headers=admin_headers)
 
    assert response.status_code == 201
    body = response.json()
    assert body["tipo_vinculacion"] == "ocasional"
    assert body["activo"] is True
 
 
def test_crear_empleado_cedula_duplicada_da_409(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    client.post("/empleados", json=_datos_empleado(), headers=admin_headers)
 
    response = client.post("/empleados", json=_datos_empleado(), headers=admin_headers)
 
    assert response.status_code == 409
 
 
def test_listar_empleados_filtra_solo_activos(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    creado = client.post("/empleados", json=_datos_empleado(), headers=admin_headers)
    empleado_id = creado.json()["id"]
    client.delete(f"/empleados/{empleado_id}", headers=admin_headers)
 
    todos = client.get("/empleados", headers=admin_headers)
    solo_activos = client.get("/empleados?solo_activos=true", headers=admin_headers)
 
    assert len(todos.json()) == 1
    assert len(solo_activos.json()) == 0
 
 
def test_actualizar_empleado(client: TestClient, admin_headers: dict[str, str]) -> None:
    creado = client.post("/empleados", json=_datos_empleado(), headers=admin_headers)
    empleado_id = creado.json()["id"]
 
    response = client.patch(
        f"/empleados/{empleado_id}",
        json={"tipo_vinculacion": "planta", "telefono": "3009999999"},
        headers=admin_headers,
    )
 
    assert response.status_code == 200
    assert response.json()["tipo_vinculacion"] == "planta"
    assert response.json()["telefono"] == "3009999999"
 
 
def test_desactivar_empleado_es_soft_delete(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    creado = client.post("/empleados", json=_datos_empleado(), headers=admin_headers)
    empleado_id = creado.json()["id"]
 
    response = client.delete(f"/empleados/{empleado_id}", headers=admin_headers)
    assert response.status_code == 204
 
    consulta = client.get(f"/empleados/{empleado_id}", headers=admin_headers)
    assert consulta.status_code == 200
    assert consulta.json()["activo"] is False
 
 
def test_obtener_empleado_inexistente_da_404(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.get("/empleados/9999", headers=admin_headers)
 
    assert response.status_code == 404