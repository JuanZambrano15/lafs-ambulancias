from fastapi.testclient import TestClient
 
 
def test_preflight_desde_el_frontend_es_aceptado(client: TestClient) -> None:
    """Sin esto, el navegador bloquea las peticiones del frontend
    (localhost:5173) hacia la API: son orígenes distintos y el
    navegador exige que el servidor lo autorice explícitamente
    (issue #6 — se detectó probando el login real contra la app).
    """
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
 
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
 
 
def test_preflight_desde_el_panel_admin_es_aceptado(client: TestClient) -> None:
    """El panel web del administrador (issue #49) corre en
    `npm run dev` en el puerto 5174 -- distinto al 5173 de la app
    Android en modo web, para poder tener los dos `vite` corriendo a
    la vez.
    """
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5174",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5174"


def test_preflight_desde_un_origen_no_permitido_no_trae_el_header(
    client: TestClient,
) -> None:
    response = client.options(
        "/auth/login",
        headers={
            "Origin": "http://sitio-no-autorizado.com",
            "Access-Control-Request-Method": "POST",
        },
    )
 
    assert "access-control-allow-origin" not in response.headers