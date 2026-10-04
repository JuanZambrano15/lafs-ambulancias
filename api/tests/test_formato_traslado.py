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
    ambulancia = _crear_ambulancia(db, movil=f"M-{tipo}")
    conductor = _crear_conductor(db, cedula=f"80000000{len(tipo)}9")
    response = client.post(
        "/atenciones",
        json={"tipo": tipo, "ambulancia_id": ambulancia.id, "conductor_id": conductor.id},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]
 
 
def test_guardar_encabezado_sin_token_da_401(client: TestClient) -> None:
    response = client.put("/atenciones/1/formato-traslado", json=ENCABEZADO_VALIDO)
 
    assert response.status_code == 401
 
 
def test_conductor_no_puede_guardar_encabezado(
    client: TestClient, conductor_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/1/formato-traslado", json=ENCABEZADO_VALIDO, headers=conductor_headers
    )
 
    assert response.status_code == 403
 
 
def test_admin_no_puede_guardar_encabezado(
    client: TestClient, admin_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/1/formato-traslado", json=ENCABEZADO_VALIDO, headers=admin_headers
    )
 
    assert response.status_code == 403
 
 
def test_guardar_encabezado_atencion_inexistente_da_404(
    client: TestClient, auxiliar_headers: dict[str, str]
) -> None:
    response = client.put(
        "/atenciones/9999/formato-traslado", json=ENCABEZADO_VALIDO, headers=auxiliar_headers
    )
 
    assert response.status_code == 404
 
 
def test_guardar_encabezado_en_atencion_soat_da_409(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers, tipo="atencion_soat")
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_auxiliar_crea_y_lee_el_encabezado(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    creado = client.put(
        f"/atenciones/{atencion_id}/formato-traslado",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert creado.status_code == 200
    body = creado.json()
    assert body["atencion_id"] == atencion_id
    assert body["paciente_nombres"] == "Pepito"
    assert body["complejidad"] == "alta"
    assert body["modalidad"] == "sencillo"
 
    leido = client.get(f"/atenciones/{atencion_id}/formato-traslado", headers=auxiliar_headers)
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
        f"/atenciones/{atencion_id}/formato-traslado",
        json=ENCABEZADO_VALIDO,
        headers=medico_headers,
    )
 
    assert response.status_code == 200
 
 
def test_reescribir_el_encabezado_mientras_esta_abierta(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    client.put(
        f"/atenciones/{atencion_id}/formato-traslado",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    corregido = {**ENCABEZADO_VALIDO, "paciente_nombres": "Pepita"}
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado", json=corregido, headers=auxiliar_headers
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
        f"/atenciones/{atencion_id}/formato-traslado",
        json=ENCABEZADO_VALIDO,
        headers=auxiliar_headers,
    )
 
    assert response.status_code == 409
 
 
def test_leer_encabezado_antes_de_crearlo_da_404(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
    response = client.get(f"/atenciones/{atencion_id}/formato-traslado", headers=auxiliar_headers)
 
    assert response.status_code == 404
 
 
def test_guardar_encabezado_con_campo_faltante_da_422(
    client: TestClient, db: Session, auxiliar_headers: dict[str, str]
) -> None:
    atencion_id = _crear_atencion(client, db, auxiliar_headers)
    incompleto = {k: v for k, v in ENCABEZADO_VALIDO.items() if k != "paciente_nombres"}
 
    response = client.put(
        f"/atenciones/{atencion_id}/formato-traslado", json=incompleto, headers=auxiliar_headers
    )
 
    assert response.status_code == 422