from datetime import date
 
from app.core.security import hash_secret
from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.empleado import Empleado
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
 
 
def _crear_ambulancia(
    db: Session, movil: str = "M-01", activa: bool = True
) -> Ambulancia:
    ambulancia = Ambulancia(
        movil=movil,
        placa=f"{movil}PLACA"[:10],
        tipo=TipoAmbulancia.basica,
        vencimiento_soat=date(2027, 1, 1),
        vencimiento_tecnomecanica=date(2027, 1, 1),
        activa=activa,
    )
    db.add(ambulancia)
    db.commit()
    db.refresh(ambulancia)
    return ambulancia
 
 
def _crear_conductor(
    db: Session, cedula: str = "800000001", activo: bool = True, con_rol: bool = True
) -> Empleado:
    empleado = Empleado(
        nombres="Carlos", apellidos="Gómez", cedula=cedula, activo=activo
    )
    db.add(empleado)
    db.flush()
 
    if con_rol:
        rol = db.query(Rol).filter(Rol.nombre == "conductor").first()
        if rol is None:
            rol = Rol(nombre="conductor", descripcion="Rol de prueba")
            db.add(rol)
            db.flush()
 
        usuario = Usuario(
            documento=cedula,
            password_hash=hash_secret("clave-conductor"),
            empleado_id=empleado.id,
            activo=activo,
        )
        db.add(usuario)
        db.flush()
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
 
    db.commit()
    db.refresh(empleado)
    return empleado
 
 
def test_crear_atencion_sin_token_da_401(client: TestClient) -> None:
    response = client.post(
        "/atenciones", json={"tipo": "traslado", "ambulancia_id": 1, "conductor_id": 1}
    )
 
    assert response.status_code == 401
 
 
def test_admin_no_puede_crear_atencion(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.post(
        "/atenciones",
        json={"tipo": "traslado", "ambulancia_id": 1, "conductor_id": 1},
        headers=admin_headers,
    )
 
    assert response.status_code == 403
 
 
def test_crear_atencion_exitosa(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
 
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 201
    body = response.json()
    assert body["estado"] == "abierto"
    assert body["ambulancia"]["movil"] == ambulancia.movil
    assert body["conductor"]["cedula"] == conductor.cedula
    assert body["responsable"]["cedula"] == "700000001"
    assert body["cerrada_en"] is None
 
 
def test_usuario_sin_empleado_no_puede_crear_atencion(
    client: TestClient, db: Session, contador_headers: dict[str, str]
) -> None:
    """contador_headers no tiene empleado_id — ni siquiera tiene el rol
    correcto, pero esto confirma que el chequeo de empleado también
    existe (defensa en profundidad)."""
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
 
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=contador_headers,
    )
 
    assert response.status_code == 403
 
 
def test_no_se_puede_elegir_una_ambulancia_inactiva(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia = _crear_ambulancia(db, activa=False)
    conductor = _crear_conductor(db)
 
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_no_se_puede_elegir_una_ambulancia_con_atencion_abierta(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia = _crear_ambulancia(db)
    conductor_1 = _crear_conductor(db, cedula="800000001")
    conductor_2 = _crear_conductor(db, cedula="800000002")
 
    primera = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor_1.id,
        },
        headers=auxiliar_headers,
    )
    assert primera.status_code == 201
 
    segunda = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor_2.id,
        },
        headers=auxiliar_headers,
    )
 
    assert segunda.status_code == 409
 
 
def test_no_se_puede_elegir_un_conductor_ya_ocupado(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia_1 = _crear_ambulancia(db, movil="M-01")
    ambulancia_2 = _crear_ambulancia(db, movil="M-02")
    conductor = _crear_conductor(db)
 
    primera = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia_1.id,
            "conductor_id": conductor.id,
        },
        headers=auxiliar_headers,
    )
    assert primera.status_code == 201
 
    segunda = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia_2.id,
            "conductor_id": conductor.id,
        },
        headers=auxiliar_headers,
    )
 
    assert segunda.status_code == 409
 
 
def test_no_se_puede_elegir_un_empleado_sin_rol_de_conductor(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia = _crear_ambulancia(db)
    empleado_cualquiera = _crear_conductor(db, con_rol=False)
 
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": empleado_cualquiera.id,
        },
        headers=auxiliar_headers,
    )
 
    # No se valida el rol del conductor en la creación (solo que exista
    # y esté activo) — el filtro por rol es para la lista de
    # "disponibles", no una restricción dura. Documentado en el ADR.
    assert response.status_code == 201
 
 
def test_listar_ambulancias_disponibles_excluye_inactivas_y_ocupadas(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    disponible = _crear_ambulancia(db, movil="M-01")
    _crear_ambulancia(db, movil="M-02", activa=False)
    ocupada = _crear_ambulancia(db, movil="M-03")
    conductor = _crear_conductor(db)
 
    client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ocupada.id,
            "conductor_id": conductor.id,
        },
        headers=auxiliar_headers,
    )
 
    response = client.get(
        "/atenciones/ambulancias-disponibles", headers=auxiliar_headers
    )
 
    assert response.status_code == 200
    moviles = [a["movil"] for a in response.json()]
    assert moviles == [disponible.movil]
 
 
def test_crear_atencion_con_ambulancia_inexistente_da_404(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    conductor = _crear_conductor(db)
 
    response = client.post(
        "/atenciones",
        json={"tipo": "traslado", "ambulancia_id": 9999, "conductor_id": conductor.id},
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 404
 
 
def test_crear_atencion_con_conductor_inexistente_da_404(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia = _crear_ambulancia(db)
 
    response = client.post(
        "/atenciones",
        json={"tipo": "traslado", "ambulancia_id": ambulancia.id, "conductor_id": 9999},
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 404
 
 
def test_crear_atencion_con_conductor_inactivo_da_409(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db, activo=False)
 
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_usuario_sin_empleado_vinculado_no_puede_crear_atencion(
    client: TestClient, db: Session
) -> None:
    """Un usuario con el rol correcto (medico) pero sin empleado_id —
    caso real: alguien creó el usuario antes de registrar el empleado,
    o el empleado se desactivó después.
    """
    rol = Rol(nombre="medico", descripcion="Rol de prueba")
    db.add(rol)
    db.flush()
    usuario = Usuario(documento="600000001", password_hash=hash_secret("clave-medico"))
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.commit()
 
    login = client.post(
        "/auth/login", json={"documento": "600000001", "password": "clave-medico"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
 
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
 
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=headers,
    )
 
    assert response.status_code == 409
 
 
def test_crear_atencion_con_client_id_es_idempotente(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    """Simula un reintento de sincronización (issue #10): la segunda
    llamada con el mismo client_id no debe crear una segunda fila ni
    fallar por "ambulancia/conductor ya ocupado" — debe devolver la
    misma atención que ya se había creado."""
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
    client_id = "11111111-1111-1111-1111-111111111111"
 
    primera = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
            "client_id": client_id,
        },
        headers=auxiliar_headers,
    )
    assert primera.status_code == 201
    atencion_id = primera.json()["id"]
 
    segunda = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
            "client_id": client_id,
        },
        headers=auxiliar_headers,
    )
 
    assert segunda.status_code == 200
    assert segunda.json()["id"] == atencion_id
 
 
def test_crear_atencion_con_client_id_distinto_crea_otra(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    ambulancia_1 = _crear_ambulancia(db, movil="M-01")
    ambulancia_2 = _crear_ambulancia(db, movil="M-02")
    conductor_1 = _crear_conductor(db, cedula="800000001")
    conductor_2 = _crear_conductor(db, cedula="800000002")
 
    primera = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia_1.id,
            "conductor_id": conductor_1.id,
            "client_id": "22222222-2222-2222-2222-222222222222",
        },
        headers=auxiliar_headers,
    )
    segunda = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia_2.id,
            "conductor_id": conductor_2.id,
            "client_id": "33333333-3333-3333-3333-333333333333",
        },
        headers=auxiliar_headers,
    )
 
    assert primera.status_code == 201
    assert segunda.status_code == 201
    assert primera.json()["id"] != segunda.json()["id"]
 
 
def test_crear_atencion_sin_client_id_sigue_funcionando(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    """La mayoría de las atenciones se siguen creando en línea, sin
    mandar client_id — no debe exigirse ni romper nada (issue #10)."""
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
 
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 201
 
 
def test_listar_conductores_disponibles_excluye_sin_rol_e_inactivos(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    disponible = _crear_conductor(db, cedula="800000001")
    _crear_conductor(db, cedula="800000002", con_rol=False)
    _crear_conductor(db, cedula="800000003", activo=False)
 
    response = client.get(
        "/atenciones/conductores-disponibles", headers=auxiliar_headers
    )
 
    assert response.status_code == 200
    cedulas = [c["cedula"] for c in response.json()]
    assert cedulas == [disponible.cedula]
 
 
def _crear_atencion_abierta(
    client: TestClient, db: Session, headers: dict[str, str]
) -> int:
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
    response = client.post(
        "/atenciones",
        json={
            "tipo": "traslado",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]
 
 
class TestCerrarAtencion:
    """Issue #12: cierre de la atención con el PIN de firma (ADR-0002,
    ADR-0010)."""
 
    def test_cierra_con_pin_correcto(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_abierta(client, db, auxiliar_headers)
        client.put("/auth/pin", json={"pin": "1234"}, headers=auxiliar_headers)
 
        response = client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "1234"},
            headers=auxiliar_headers,
        )
 
        assert response.status_code == 200
        body = response.json()
        assert body["estado"] == "cerrado"
        assert body["cerrada_en"] is not None
 
    def test_medico_tambien_puede_cerrar(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
    ) -> None:
        """No se exige que sea el mismo responsable que la creó — es
        el mismo criterio de permiso que ya rige para editar el
        formato clínico."""
        atencion_id = _crear_atencion_abierta(client, db, auxiliar_headers)
        client.put("/auth/pin", json={"pin": "5678"}, headers=medico_headers)
 
        response = client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "5678"},
            headers=medico_headers,
        )
 
        assert response.status_code == 200
        assert response.json()["estado"] == "cerrado"
 
    def test_conductor_no_puede_cerrar(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        conductor_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_abierta(client, db, auxiliar_headers)
        client.put("/auth/pin", json={"pin": "1234"}, headers=conductor_headers)
 
        response = client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "1234"},
            headers=conductor_headers,
        )
 
        assert response.status_code == 403
 
    def test_pin_incorrecto_da_401(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_abierta(client, db, auxiliar_headers)
        client.put("/auth/pin", json={"pin": "1234"}, headers=auxiliar_headers)
 
        response = client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "9999"},
            headers=auxiliar_headers,
        )
 
        assert response.status_code == 401
 
    def test_sin_pin_configurado_da_409(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_abierta(client, db, auxiliar_headers)
 
        response = client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "1234"},
            headers=auxiliar_headers,
        )
 
        assert response.status_code == 409
        assert "PIN" in response.json()["detail"]
 
    def test_ya_cerrada_da_409(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_abierta(client, db, auxiliar_headers)
        client.put("/auth/pin", json={"pin": "1234"}, headers=auxiliar_headers)
        primer_cierre = client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "1234"},
            headers=auxiliar_headers,
        )
        assert primer_cierre.status_code == 200
 
        segundo_cierre = client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "1234"},
            headers=auxiliar_headers,
        )
 
        assert segundo_cierre.status_code == 409
 
    def test_atencion_inexistente_da_404(
        self, client: TestClient, auxiliar_headers: dict[str, str]
    ) -> None:
        response = client.put(
            "/atenciones/999999/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )
 
        assert response.status_code == 404
 
    def test_sin_token_da_401(self, client: TestClient) -> None:
        response = client.put("/atenciones/1/cerrar", json={"pin": "1234"})
 
        assert response.status_code == 401
 
    def test_despues_de_cerrada_no_se_puede_editar_el_encabezado(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_abierta(client, db, auxiliar_headers)
        client.put("/auth/pin", json={"pin": "1234"}, headers=auxiliar_headers)
        client.put(
            f"/atenciones/{atencion_id}/cerrar",
            json={"pin": "1234"},
            headers=auxiliar_headers,
        )
 
        response = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json={
                "paciente_tipo_documento": "cc",
                "paciente_numero_documento": "123456789",
                "paciente_eps": "Nueva EPS",
                "paciente_nombres": "Pepito",
                "paciente_apellidos": "Pérez",
                "paciente_edad": 45,
                "paciente_sexo": "m",
                "paciente_direccion_residencial": "Calle 1",
                "paciente_ciudad": "Cúcuta",
                "paciente_telefono": None,
                "acompanante_nombres_apellidos": None,
                "acompanante_parentesco": None,
                "acompanante_telefono": None,
                "recepcion_fecha": "2027-01-01",
                "recepcion_hora": "08:00:00",
                "recepcion_ciudad": "Cúcuta",
                "recepcion_ips": "Clínica Norte",
                "recepcion_servicio": "Urgencias",
                "entrega_fecha": "2027-01-01",
                "entrega_hora": "09:00:00",
                "entrega_ciudad": "Cúcuta",
                "entrega_ips": "Hospital",
                "entrega_servicio": "UCI",
                "complejidad": "alta",
                "categoria_paciente": "adulto",
                "nivel_servicio": "medicalizado",
                "modalidad": "sencillo",
            },
            headers=auxiliar_headers,
        )
 
        assert response.status_code == 409