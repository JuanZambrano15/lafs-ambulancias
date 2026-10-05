from datetime import date
 
from app.core.security import hash_secret
from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.atencion import Atencion, EstadoAtencion
from app.models.empleado import Empleado
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
 
ENCABEZADO_VALIDO = {
    "paciente_tipo_documento": "cc",
    "paciente_numero_documento": "123456789",
    "paciente_eps": "Nueva EPS",
    "paciente_nombres": "Pepito",
    "paciente_apellidos": "Pérez",
    "paciente_edad": 45,
    "paciente_sexo": "m",
    "paciente_direccion_residencial": "Calle 1 # 2-3",
    "paciente_ciudad": "Cúcuta",
    "paciente_telefono": "3001234567",
    "acompanante_nombres_apellidos": "María Pérez",
    "acompanante_parentesco": "Hermana",
    "acompanante_telefono": "3007654321",
    "recepcion_fecha": "2027-01-01",
    "recepcion_hora": "08:00:00",
    "recepcion_ciudad": "Cúcuta",
    "recepcion_ips": "Clínica Norte",
    "recepcion_servicio": "Urgencias",
    "entrega_fecha": "2027-01-01",
    "entrega_hora": "09:30:00",
    "entrega_ciudad": "Cúcuta",
    "entrega_ips": "Hospital Universitario",
    "entrega_servicio": "UCI",
    "complejidad": "alta",
    "categoria_paciente": "adulto",
    "nivel_servicio": "medicalizado",
    "modalidad": "sencillo",
}
 
CLINICO_VALIDO = {
    "diagnostico": "Trauma craneoencefálico leve por caída de altura",
    "tratamiento": ["collar_cervical", "oxigeno", "otros"],
    "tratamiento_otro": "Férula en brazo izquierdo",
    "pupila_derecha": "isocorica",
    "pupila_izquierda": "isocorica",
    "signos_vitales": [
        {"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97},
        {"hora": "08:20", "ta": "118/78", "fc": 90, "fr": 19, "spo2": 96},
    ],
    "lesiones": ["tce", "contusion"],
    "lesion_otro": None,
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "insumos_entregados": ["Collar cervical talla M", "Cánula nasal"],
    "nota_auxiliar": "Paciente estable durante el traslado, sin complicaciones.",
    "atendido_por": "Ana Ruiz",
    "nota_medica": "Se recomienda TAC de cráneo al ingreso.",
    "evolucionado_por": "Laura Gómez",
}
 
 
def _crear_ambulancia(db: Session, movil: str = "M-01") -> Ambulancia:
    ambulancia = Ambulancia(
        movil=movil,
        placa=f"{movil}PLACA"[:10],
        tipo=TipoAmbulancia.basica,
        vencimiento_soat=date(2027, 1, 1),
        vencimiento_tecnomecanica=date(2027, 1, 1),
        activa=True,
    )
    db.add(ambulancia)
    db.commit()
    db.refresh(ambulancia)
    return ambulancia
 
 
def _crear_conductor(db: Session, cedula: str = "800000001") -> Empleado:
    empleado = Empleado(nombres="Carlos", apellidos="Gómez", cedula=cedula)
    db.add(empleado)
    db.flush()
 
    rol = db.query(Rol).filter(Rol.nombre == "conductor").first()
    if rol is None:
        rol = Rol(nombre="conductor", descripcion="Rol de prueba")
        db.add(rol)
        db.flush()
 
    usuario = Usuario(
        documento=cedula, password_hash=hash_secret("clave-conductor"), empleado_id=empleado.id
    )
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
 
    db.commit()
    db.refresh(empleado)
    return empleado
 
 
def _crear_atencion(
    client: TestClient, db: Session, headers: dict[str, str], tipo: str = "traslado"
) -> int:
    ambulancia = _crear_ambulancia(db, movil=f"M-{tipo}-clin")
    conductor = _crear_conductor(db, cedula=f"80000001{len(tipo)}")
    response = client.post(
        "/atenciones",
        json={"tipo": tipo, "ambulancia_id": ambulancia.id, "conductor_id": conductor.id},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]
 
 
def _crear_atencion_con_encabezado(client: TestClient, db: Session, headers: dict[str, str]) -> int:
    atencion_id = _crear_atencion(client, db, headers)
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-traslado", json=ENCABEZADO_VALIDO, headers=headers
    )
    assert respuesta.status_code == 200
    return atencion_id
 
 
def test_guardar_clinico_sin_token_da_401(client: TestClient) -> None:
    response = client.put("/atenciones/1/formato-traslado/clinico", json=CLINICO_VALIDO)
 
    assert response.status_code == 401
 
 
def test_conductor_no_puede_guardar_clinico(
    client: TestClient, conductor_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/1/formato-traslado/clinico", json=CLINICO_VALIDO, headers=conductor_headers
    )
 
    assert response.status_code == 403
 
 
def test_guardar_clinico_atencion_inexistente_da_404(
    client: TestClient, auxiliar_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/9999/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 404
 
 
def test_guardar_clinico_sin_encabezado_da_404(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 404
    assert "encabezado" in response.json()["detail"].lower()
 
 
def test_auxiliar_guarda_y_lee_lo_clinico(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    guardado = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert guardado.status_code == 200
    body = guardado.json()
    assert body["diagnostico"] == CLINICO_VALIDO["diagnostico"]
    assert body["tratamiento"] == ["collar_cervical", "oxigeno", "otros"]
    assert body["pupila_derecha"] == "isocorica"
    assert len(body["signos_vitales"]) == 2
    assert body["signos_vitales"][0]["ta"] == "120/80"
    assert body["lesiones"] == ["tce", "contusion"]
    assert body["glasgow_total"] == 15
 
    leido = client.get(f"/atenciones/{atencion_id}/formato-traslado", headers=auxiliar_headers)
    assert leido.status_code == 200
    # El encabezado sigue intacto después de guardar lo clínico.
    assert leido.json()["paciente_nombres"] == "Pepito"
    assert leido.json()["nota_medica"] == CLINICO_VALIDO["nota_medica"]
 
 
def test_medico_tambien_puede_guardar_lo_clinico(
    client: TestClient,
    db: Session,
    auxiliar_headers: dict[str, str],
    medico_headers: dict[str, str],
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=medico_headers,
    )
 
    assert response.status_code == 200
 
 
def test_leer_formato_antes_de_lo_clinico_trae_listas_vacias(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    """Justo después de guardar el encabezado, lo clínico todavía no
    existe — las listas deben verse vacías, no nulas, y el Glasgow
    total debe ser `None` (no se puede sumar lo que no está).
    """
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    response = client.get(f"/atenciones/{atencion_id}/formato-traslado", headers=auxiliar_headers)
 
    assert response.status_code == 200
    body = response.json()
    assert body["tratamiento"] == []
    assert body["signos_vitales"] == []
    assert body["lesiones"] == []
    assert body["insumos_entregados"] == []
    assert body["diagnostico"] is None
    assert body["glasgow_total"] is None
 
 
def test_guardar_clinico_parcial_deja_el_resto_en_su_valor_por_defecto(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    """No hay PATCH: cada PUT manda el estado completo de lo clínico
    tal como esté en ese momento, igual que el encabezado.
    """
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json={"diagnostico": "Solo esto por ahora"},
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 200
    body = response.json()
    assert body["diagnostico"] == "Solo esto por ahora"
    assert body["tratamiento"] == []
    assert body["glasgow_ocular"] is None
 
 
def test_reescribir_lo_clinico_mientras_esta_abierta(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    corregido = {**CLINICO_VALIDO, "glasgow_motora": 5}
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=corregido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 200
    assert response.json()["glasgow_total"] == 14
 
 
def test_no_se_puede_editar_lo_clinico_de_una_atencion_cerrada(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    atencion = db.get(Atencion, atencion_id)
    assert atencion is not None
    atencion.estado = EstadoAtencion.cerrado
    db.commit()
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_guardar_clinico_en_atencion_soat_da_409(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers, tipo="atencion_soat")
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_glasgow_fuera_de_rango_da_422(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
    invalido = {**CLINICO_VALIDO, "glasgow_ocular": 9}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=invalido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 422
 
 
def test_mas_de_ocho_insumos_da_422(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
    invalido = {**CLINICO_VALIDO, "insumos_entregados": [f"Insumo {i}" for i in range(9)]}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=invalido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 422
 
 
def test_nota_medica_demasiado_larga_da_422(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
    invalido = {**CLINICO_VALIDO, "nota_medica": "x" * 2001}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=invalido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 422
