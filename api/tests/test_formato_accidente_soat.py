"""Formato de atención de accidentes SOAT: encabezado y parte clínica
(issue #17) -- mismas pruebas que `test_formato_traslado.py` +
`test_formato_traslado_clinico.py`, adaptadas a este formato (el
paciente puede ser NN, no hay PDF todavía).
"""
 
from __future__ import annotations
 
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
    "fecha_atencion": "2027-01-01",
    "hora_atencion": "08:00:00",
    "hora_entrega": None,
    "identificado": True,
    "paciente_tipo_documento": "cc",
    "paciente_numero_documento": "123456789",
    "paciente_aseguradora": "SOAT Seguros XYZ",
    "paciente_nombres": "Pepito",
    "paciente_apellidos": "Pérez",
    "paciente_edad": 45,
    "paciente_sexo": "m",
    "lugar_ocurrencia": "Av. Gran Colombia con calle 10",
    "ciudad": "Cúcuta",
    "telefono_contacto": "3001234567",
    "rol_victima": "conductor",
    "poliza_vigente_desde": "2026-01-01",
    "poliza_vigente_hasta": "2027-01-01",
    "numero_poliza": "SOAT-0001",
}
 
ENCABEZADO_NN = {
    **ENCABEZADO_VALIDO,
    "identificado": False,
    "paciente_tipo_documento": None,
    "paciente_numero_documento": None,
    "paciente_aseguradora": None,
    "paciente_nombres": None,
    "paciente_apellidos": None,
    "paciente_edad": None,
    "paciente_sexo": None,
}
 
CLINICO_VALIDO = {
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
    "triage": "ii",
    "descripcion": "Paciente víctima de accidente de tránsito, trasladado estable.",
    "atendido_por": "Ana Ruiz",
    "firma_atendido_por": "data:image/png;base64,AAAA",
    "evolucionado_por": "Laura Gómez",
    "firma_evolucionado_por": "data:image/png;base64,BBBB",
    "profesional_recibe_nombre": "Dra. Carolina Pinto",
    "profesional_recibe_cedula": "1098765432",
    "firma_profesional_recibe": "data:image/png;base64,CCCC",
}
 
 
def _crear_ambulancia(db: Session, movil: str = "M-soat") -> Ambulancia:
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
 
 
def _crear_conductor(db: Session, cedula: str = "800000501") -> Empleado:
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
    client: TestClient, db: Session, headers: dict[str, str], tipo: str = "atencion_soat"
) -> int:
    ambulancia = _crear_ambulancia(db, movil=f"M-{tipo}-soat")
    conductor = _crear_conductor(db, cedula=f"80000050{len(tipo)}")
    response = client.post(
        "/atenciones",
        json={"tipo": tipo, "ambulancia_id": ambulancia.id, "conductor_id": conductor.id},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]
 
 
def _crear_atencion_con_encabezado(
    client: TestClient,
    db: Session,
    headers: dict[str, str],
    encabezado: dict[str, object] | None = None,
) -> int:
    atencion_id = _crear_atencion(client, db, headers)
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=encabezado or ENCABEZADO_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
    return atencion_id
 
 
# --- Encabezado --------------------------------------------------------
 
 
def test_guardar_encabezado_sin_token_da_401(client: TestClient) -> None:
    response = client.put("/atenciones/1/formato-accidente-soat", json=ENCABEZADO_VALIDO)
 
    assert response.status_code == 401
 
 
def test_conductor_no_puede_guardar_encabezado(
    client: TestClient, conductor_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/1/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=conductor_headers,
    )
 
    assert response.status_code == 403
 
 
def test_admin_no_puede_guardar_encabezado_mientras_abierta(
    client: TestClient,
    db: Session,
    auxiliar_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=admin_headers,
    )
 
    assert response.status_code == 403
 
 
def test_guardar_encabezado_atencion_inexistente_da_404(
    client: TestClient, auxiliar_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/9999/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 404
 
 
def test_guardar_encabezado_en_atencion_de_traslado_da_409(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers, tipo="traslado")
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_auxiliar_crea_y_lee_el_encabezado(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    creado = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert creado.status_code == 200
    body = creado.json()
    assert body["atencion_id"] == atencion_id
    assert body["paciente_nombres"] == "Pepito"
    assert body["rol_victima"] == "conductor"
    assert body["numero_poliza"] == "SOAT-0001"
 
    leido = client.get(
        f"/atenciones/{atencion_id}/formato-accidente-soat", headers=auxiliar_headers
    )
    assert leido.status_code == 200
    assert leido.json()["paciente_apellidos"] == "Pérez"
 
 
def test_medico_tambien_puede_guardar_el_encabezado(
    client: TestClient,
    db: Session,
    auxiliar_headers: dict[str, str],
    medico_headers: dict[str, str],
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=medico_headers,
    )
 
    assert response.status_code == 200
 
 
def test_paciente_nn_se_guarda_con_datos_de_identidad_en_blanco(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_NN,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 200
    body = response.json()
    assert body["identificado"] is False
    assert body["paciente_nombres"] is None
    assert body["paciente_numero_documento"] is None
    # Los datos del accidente no dependen de si se identificó.
    assert body["lugar_ocurrencia"] == ENCABEZADO_NN["lugar_ocurrencia"]
 
 
def test_reescribir_el_encabezado_mientras_esta_abierta(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    corregido = {**ENCABEZADO_VALIDO, "paciente_nombres": "Pepita"}
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=corregido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 200
    assert response.json()["paciente_nombres"] == "Pepita"
 
 
def test_no_se_puede_editar_el_encabezado_de_una_atencion_cerrada(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    atencion = db.get(Atencion, atencion_id)
    assert atencion is not None
    atencion.estado = EstadoAtencion.cerrado
    db.commit()
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_leer_encabezado_antes_de_crearlo_da_404(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    response = client.get(
        f"/atenciones/{atencion_id}/formato-accidente-soat", headers=auxiliar_headers
    )
 
    assert response.status_code == 404
 
 
def test_guardar_encabezado_con_campo_obligatorio_faltante_da_422(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
    incompleto = {k: v for k, v in ENCABEZADO_VALIDO.items() if k != "lugar_ocurrencia"}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=incompleto,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 422
 
 
def test_numero_poliza_es_opcional(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    """Fix sobre #17: el número de póliza puede no conocerse todavía
    al recibir al paciente -- a diferencia de `lugar_ocurrencia` (ver
    la prueba de arriba), omitirlo no da 422."""
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
    sin_poliza = {**ENCABEZADO_VALIDO, "numero_poliza": None}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=sin_poliza,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 200
    assert response.json()["numero_poliza"] is None
 
 
# --- Parte clínica -------------------------------------------------------
 
 
def test_guardar_clinico_sin_token_da_401(client: TestClient) -> None:
    response = client.put("/atenciones/1/formato-accidente-soat/clinico", json=CLINICO_VALIDO)
 
    assert response.status_code == 401
 
 
def test_conductor_no_puede_guardar_clinico(
    client: TestClient, conductor_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/1/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=conductor_headers,
    )
 
    assert response.status_code == 403
 
 
def test_guardar_clinico_atencion_inexistente_da_404(
    client: TestClient, auxiliar_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/9999/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 404
 
 
def test_guardar_clinico_sin_encabezado_da_404(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 404
    assert "encabezado" in response.json()["detail"].lower()
 
 
def test_guardar_clinico_en_atencion_de_traslado_da_409(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers, tipo="traslado")
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_auxiliar_guarda_y_lee_lo_clinico(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    guardado = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert guardado.status_code == 200
    body = guardado.json()
    assert body["tratamiento"] == ["collar_cervical", "oxigeno", "otros"]
    assert body["pupila_derecha"] == "isocorica"
    assert len(body["signos_vitales"]) == 2
    assert body["lesiones"] == ["tce", "contusion"]
    assert body["glasgow_total"] == 15
    assert body["triage"] == "ii"
    assert body["firma_atendido_por"] == "data:image/png;base64,AAAA"
    assert body["firma_evolucionado_por"] == "data:image/png;base64,BBBB"
    assert body["profesional_recibe_nombre"] == "Dra. Carolina Pinto"
    assert body["firma_profesional_recibe"] == "data:image/png;base64,CCCC"
 
    leido = client.get(
        f"/atenciones/{atencion_id}/formato-accidente-soat", headers=auxiliar_headers
    )
    assert leido.status_code == 200
    assert leido.json()["descripcion"] == CLINICO_VALIDO["descripcion"]
 
 
def test_medico_tambien_puede_guardar_lo_clinico(
    client: TestClient,
    db: Session,
    auxiliar_headers: dict[str, str],
    medico_headers: dict[str, str],
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=medico_headers,
    )
 
    assert response.status_code == 200
 
 
def test_leer_formato_antes_de_lo_clinico_trae_listas_vacias(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    response = client.get(
        f"/atenciones/{atencion_id}/formato-accidente-soat", headers=auxiliar_headers
    )
 
    assert response.status_code == 200
    body = response.json()
    assert body["tratamiento"] == []
    assert body["signos_vitales"] == []
    assert body["lesiones"] == []
    assert body["triage"] is None
    assert body["descripcion"] is None
    assert body["glasgow_total"] is None
    assert body["firma_atendido_por"] is None
    assert body["firma_evolucionado_por"] is None
    assert body["firma_profesional_recibe"] is None
 
 
def test_guardar_clinico_parcial_deja_el_resto_en_su_valor_por_defecto(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json={"descripcion": "Solo esto por ahora"},
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 200
    body = response.json()
    assert body["descripcion"] == "Solo esto por ahora"
    assert body["tratamiento"] == []
    assert body["glasgow_ocular"] is None
 
 
def test_reescribir_lo_clinico_mientras_esta_abierta(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
    client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=CLINICO_VALIDO,
        headers=auxiliar_headers,
    )
 
    corregido = {**CLINICO_VALIDO, "glasgow_motora": 5}
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
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
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
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
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=invalido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 422
 
 
def test_descripcion_demasiado_larga_da_422(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
    invalido = {**CLINICO_VALIDO, "descripcion": "x" * 2001}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=invalido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 422
 
 
def test_firma_demasiado_larga_da_422(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    """Mismo limite que en traslado (issue #11): la firma es una data
    URL en base64 -- se acepta hasta 300_000 caracteres."""
    atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
    invalido = {**CLINICO_VALIDO, "firma_profesional_recibe": "x" * 300_001}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=invalido,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 422