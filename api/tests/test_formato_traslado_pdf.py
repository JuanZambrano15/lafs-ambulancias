"""PDF del formato de traslado (issue #13, ADR-0011)."""
 
from datetime import date
 
from app.core.security import hash_secret
from app.models.ambulancia import Ambulancia, TipoAmbulancia
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
    "signos_vitales": [{"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97}],
    "lesiones": ["tce", "contusion"],
    "lesion_otro": None,
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "insumos_entregados": ["Collar cervical talla M"],
    "nota_auxiliar": "Paciente estable durante el traslado.",
    "atendido_por": "Ana Ruiz",
    # PNG 1x1 válido (no un string cualquiera) para que WeasyPrint
    # pueda decodificarlo igual que una firma real en producción —
    # con datos basura, WeasyPrint omite la imagen en silencio y el
    # PDF resultante no refleja el contenido real del formato.
    "firma_atendido_por": (
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
        "CAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    ),
    "nota_medica": "Se recomienda TAC de cráneo al ingreso.",
    "evolucionado_por": "Laura Gómez",
    "firma_evolucionado_por": (
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
        "CAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    ),
}
 
 
def _crear_ambulancia(db: Session, movil: str = "M-pdf") -> Ambulancia:
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
 
 
def _crear_conductor(db: Session, cedula: str = "800000099") -> Empleado:
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
 
 
def _crear_atencion(client: TestClient, db: Session, headers: dict[str, str]) -> int:
    ambulancia = _crear_ambulancia(db)
    conductor = _crear_conductor(db)
    response = client.post(
        "/atenciones",
        json={"tipo": "traslado", "ambulancia_id": ambulancia.id, "conductor_id": conductor.id},
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
 
 
class TestGeneracionAutomatica:
    """El PDF se regenera solo, como efecto secundario de guardar
    (ver ADR-0011) — nunca lo pide el cliente explícitamente.
    """
 
    def test_guardar_encabezado_genera_un_pdf(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        )
 
        assert respuesta.status_code == 200
        assert respuesta.headers["content-type"] == "application/pdf"
        assert respuesta.content.startswith(b"%PDF")
 
    def test_guardar_clinico_regenera_el_pdf(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
        pdf_antes = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        ).content
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=CLINICO_VALIDO,
            headers=auxiliar_headers,
        )
        assert respuesta.status_code == 200
 
        pdf_despues = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        ).content
        assert pdf_despues.startswith(b"%PDF")
        # No comparar por tamaño: el subsetting de fuentes varía entre
        # renders y hace que "más contenido" no siempre sea "más
        # bytes". Lo que importa es que el contenido cambió.
        assert pdf_despues != pdf_antes
 
    def test_cerrar_la_atencion_regenera_el_pdf(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
    ) -> None:
        from app.core.security import hash_secret
        from app.models.usuario import Usuario
 
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=CLINICO_VALIDO,
            headers=auxiliar_headers,
        )
 
        usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
        usuario.pin_hash = hash_secret("1234")
        db.commit()
 
        cerrar = client.put(
            f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )
        assert cerrar.status_code == 200
 
        pdf = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        )
        assert pdf.status_code == 200
        assert pdf.content.startswith(b"%PDF")
 
    def test_cerrar_sin_encabezado_no_falla_aunque_no_haya_pdf(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        from app.core.security import hash_secret
        from app.models.usuario import Usuario
 
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
        usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
        usuario.pin_hash = hash_secret("1234")
        db.commit()
 
        cerrar = client.put(
            f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )
        assert cerrar.status_code == 200
 
        pdf = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        )
        assert pdf.status_code == 404
 
 
class TestDescargaPdf:
    def test_sin_token_da_401(self, client: TestClient) -> None:
        respuesta = client.get("/atenciones/1/formato-traslado/pdf")
        assert respuesta.status_code == 401
 
    def test_conductor_no_puede_descargar_da_403(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        conductor_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=conductor_headers
        )
 
        assert respuesta.status_code == 403
 
    def test_medico_tambien_puede_descargar(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=medico_headers
        )
 
        assert respuesta.status_code == 200
 
    def test_administrador_tambien_puede_descargar(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=admin_headers
        )
 
        assert respuesta.status_code == 200
 
    def test_atencion_inexistente_da_404(
        self, client: TestClient, auxiliar_headers: dict[str, str]
    ) -> None:
        respuesta = client.get("/atenciones/999999/formato-traslado/pdf", headers=auxiliar_headers)
        assert respuesta.status_code == 404
 
    def test_sin_encabezado_todavia_da_404(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        )
 
        assert respuesta.status_code == 404
 
 
class TestContenidoDelPdf:
    """No se parsea el PDF byte a byte — solo se confirma que el
    render no reviente con los distintos tipos de dato que puede
    traer el formato (listas vacías, firmas ausentes, atención sin
    acompañante, etc.), ya que eso es lo único que puede realmente
    salir mal en la plantilla.
    """
 
    def test_pdf_con_encabezado_minimo_sin_clinico_no_falla(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        sin_acompanante = {
            **ENCABEZADO_VALIDO,
            "acompanante_nombres_apellidos": None,
            "acompanante_parentesco": None,
            "acompanante_telefono": None,
            "paciente_telefono": None,
        }
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        guardar = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=sin_acompanante,
            headers=auxiliar_headers,
        )
        assert guardar.status_code == 200
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        )
        assert respuesta.status_code == 200
        assert respuesta.content.startswith(b"%PDF")
 
    def test_pdf_con_clinico_vacio_no_falla(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        clinico_vacio = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json={},
            headers=auxiliar_headers,
        )
        assert clinico_vacio.status_code == 200
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/pdf", headers=auxiliar_headers
        )
        assert respuesta.status_code == 200
        assert respuesta.content.startswith(b"%PDF")
