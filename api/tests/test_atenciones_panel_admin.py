
"""Pendientes (atenciones abiertas) y cerradas con descarga de PDF,
para el panel del administrador (issue #15).
 
`/atenciones/pendientes` y `/atenciones/cerradas` son los dos
endpoints nuevos: el primero resuelve "vista de formatos con la parte
1 sin cerrar" (no hay "parte 1" independiente en el modelo -- es la
atención entera la que está `abierta` o `cerrada`, ver
`app/models/atencion.py`), el segundo resuelve "descargar el PDF del
formato ya firmado y cerrado" dándole al administrador una forma de
encontrar cuál atención cerrada quiere, ya que `GET
/atenciones/{id}/formato-traslado/pdf` (issue #13) existe desde antes
pero exige saber el id de antemano.
"""
 
from datetime import date
 
from app.core.security import hash_secret
from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.empleado import Empleado
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
 
# Issue #80 (adelanto): encabezado/clínico mínimos para crear y cerrar
# un accidente SOAT, igual que `ENCABEZADO_VALIDO`/`CLINICO_VALIDO` de
# arriba pero para `/atenciones/cerradas` -- antes este endpoint
# ignoraba por completo los accidentes SOAT.
ENCABEZADO_SOAT_VALIDO = {
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
 
CLINICO_SOAT_VALIDO = {
    "tratamiento": [],
    "tratamiento_otro": None,
    "pupila_derecha": None,
    "pupila_izquierda": None,
    "signos_vitales": [{"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97}],
    "lesiones_localizadas": [],
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "triage": "ii",
    "descripcion": "Paciente víctima de accidente de tránsito, trasladado estable.",
    "nota_auxiliar": None,
    "atendido_por": "Ana Ruiz",
    "firma_atendido_por": None,
    "nota_medica": None,
    "evolucionado_por": None,
    "firma_evolucionado_por": None,
    "profesional_recibe_nombre": None,
    "profesional_recibe_cedula": None,
    "firma_profesional_recibe": None,
}
 
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
    "nivel_servicio": "basico",
    "modalidad": "sencillo",
}
 
CLINICO_VALIDO = {
    "diagnostico": "Trauma craneoencefálico leve por caída de altura",
    "tratamiento": [],
    "tratamiento_otro": None,
    "pupila_derecha": None,
    "pupila_izquierda": None,
    "signos_vitales": [{"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97}],
    "lesiones_localizadas": [],
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "insumos_entregados": [],
    "nota_auxiliar": "Paciente estable durante el traslado.",
    "atendido_por": "Ana Ruiz",
    "firma_atendido_por": None,
    "nota_medica": None,
    "evolucionado_por": None,
    "firma_evolucionado_por": None,
}
 
 
def _crear_ambulancia(db: Session, movil: str = "M-panel") -> Ambulancia:
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
 
 
def _crear_conductor(db: Session, cedula: str = "800000098") -> Empleado:
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
    ambulancia = _crear_ambulancia(db, movil=f"M-panel-{db.query(Ambulancia).count()}")
    conductor = _crear_conductor(db, cedula=f"8000000{db.query(Empleado).count():02d}")
    response = client.post(
        "/atenciones",
        json={"tipo": tipo, "ambulancia_id": ambulancia.id, "conductor_id": conductor.id},
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]
 
 
def _crear_y_cerrar_atencion(
    client: TestClient,
    db: Session,
    headers: dict[str, str],
    documento_responsable: str,
    *,
    paciente_nombres: str = "Pepito",
    paciente_apellidos: str = "Pérez",
    paciente_numero_documento: str = "123456789",
) -> int:
    """Crea una atención de traslado, le pone encabezado + clínico (lo
    mínimo que exige `_campos_faltantes_para_cerrar`, issue #57) y la
    cierra -- para dejar algo que listar en `/atenciones/cerradas`.
    """
    atencion_id = _crear_atencion(client, db, headers)
    encabezado = {
        **ENCABEZADO_VALIDO,
        "paciente_nombres": paciente_nombres,
        "paciente_apellidos": paciente_apellidos,
        "paciente_numero_documento": paciente_numero_documento,
    }
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-traslado", json=encabezado, headers=headers
    )
    assert respuesta.status_code == 200
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
 
    usuario = db.query(Usuario).filter(Usuario.documento == documento_responsable).one()
    usuario.pin_hash = hash_secret("1234")
    db.commit()
 
    cerrar = client.put(
        f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=headers
    )
    assert cerrar.status_code == 200
    return atencion_id
 
 
def _crear_y_cerrar_atencion_soat(
    client: TestClient,
    db: Session,
    headers: dict[str, str],
    documento_responsable: str,
    *,
    identificado: bool = True,
    paciente_nombres: str | None = "Pepito",
    paciente_apellidos: str | None = "Pérez",
    paciente_numero_documento: str | None = "123456789",
) -> int:
    """Igual que `_crear_y_cerrar_atencion`, pero para un accidente
    SOAT (issue #80 adelanto) -- usa `_campos_faltantes_para_cerrar_soat`
    como lo mínimo exigido. Permite dejar el paciente como NN
    (`identificado=False`, ADR-0002) para probar que esas filas también
    aparecen en el listado aunque no tengan nombre/documento.
    """
    atencion_id = _crear_atencion(client, db, headers, tipo="atencion_soat")
    encabezado = {
        **ENCABEZADO_SOAT_VALIDO,
        "identificado": identificado,
        "paciente_nombres": paciente_nombres if identificado else None,
        "paciente_apellidos": paciente_apellidos if identificado else None,
        "paciente_numero_documento": paciente_numero_documento if identificado else None,
    }
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat", json=encabezado, headers=headers
    )
    assert respuesta.status_code == 200
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
        json=CLINICO_SOAT_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
 
    usuario = db.query(Usuario).filter(Usuario.documento == documento_responsable).one()
    usuario.pin_hash = hash_secret("1234")
    db.commit()
 
    cerrar = client.put(
        f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=headers
    )
    assert cerrar.status_code == 200
    return atencion_id
 
 
class TestAtencionesPendientes:
    def test_sin_token_da_401(self, client: TestClient) -> None:
        respuesta = client.get("/atenciones/pendientes")
        assert respuesta.status_code == 401
 
    def test_auxiliar_no_puede_listar_da_403(
        self, client: TestClient, auxiliar_headers: dict[str, str]
    ) -> None:
        respuesta = client.get("/atenciones/pendientes", headers=auxiliar_headers)
        assert respuesta.status_code == 403
 
    def test_conductor_no_puede_listar_da_403(
        self, client: TestClient, conductor_headers: dict[str, str]
    ) -> None:
        respuesta = client.get("/atenciones/pendientes", headers=conductor_headers)
        assert respuesta.status_code == 403
 
    def test_trae_todas_las_abiertas_sin_filtrar_por_responsable(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        # Dos responsables distintos -- a diferencia de `/en-curso`
        # (issue #51), el administrador tiene que ver las dos, no solo
        # las propias (de hecho nunca tiene `empleado_id`).
        id_auxiliar = _crear_atencion(client, db, auxiliar_headers)
        id_medico = _crear_atencion(client, db, medico_headers)
 
        respuesta = client.get("/atenciones/pendientes", headers=admin_headers)
 
        assert respuesta.status_code == 200
        ids = {fila["id"] for fila in respuesta.json()}
        assert ids == {id_auxiliar, id_medico}
 
    def test_no_incluye_cerradas(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        id_abierta = _crear_atencion(client, db, auxiliar_headers)
        _crear_y_cerrar_atencion(client, db, auxiliar_headers, "700000001")
 
        respuesta = client.get("/atenciones/pendientes", headers=admin_headers)
 
        ids = {fila["id"] for fila in respuesta.json()}
        assert ids == {id_abierta}
 
    def test_incluye_atenciones_soat(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        # Issue #79: el dashboard de inicio necesita ver TODAS las
        # abiertas (traslado y SOAT) para calcular qué ambulancias
        # están en uso -- antes este endpoint ignoraba los SOAT por
        # completo y los mostraba como "disponibles" por error.
        id_traslado = _crear_atencion(client, db, auxiliar_headers, tipo="traslado")
        id_soat = _crear_atencion(client, db, auxiliar_headers, tipo="atencion_soat")
 
        respuesta = client.get("/atenciones/pendientes", headers=admin_headers)
 
        ids = {fila["id"] for fila in respuesta.json()}
        assert ids == {id_traslado, id_soat}
 
    def test_ordenadas_de_mas_antigua_a_mas_reciente(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        primera = _crear_atencion(client, db, auxiliar_headers)
        segunda = _crear_atencion(client, db, auxiliar_headers)
 
        respuesta = client.get("/atenciones/pendientes", headers=admin_headers)
 
        ids_en_orden = [fila["id"] for fila in respuesta.json()]
        assert ids_en_orden == [primera, segunda]
 
 
class TestAtencionesCerradas:
    def test_sin_token_da_401(self, client: TestClient) -> None:
        respuesta = client.get("/atenciones/cerradas")
        assert respuesta.status_code == 401
 
    def test_auxiliar_no_puede_listar_da_403(
        self, client: TestClient, auxiliar_headers: dict[str, str]
    ) -> None:
        respuesta = client.get("/atenciones/cerradas", headers=auxiliar_headers)
        assert respuesta.status_code == 403
 
    def test_trae_cerradas_con_datos_del_paciente_y_tiene_pdf(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_y_cerrar_atencion(client, db, auxiliar_headers, "700000001")
 
        respuesta = client.get("/atenciones/cerradas", headers=admin_headers)
 
        assert respuesta.status_code == 200
        filas = respuesta.json()
        assert len(filas) == 1
        fila = filas[0]
        assert fila["id"] == atencion_id
        assert fila["tipo"] == "traslado"
        assert fila["nivel_servicio"] == "basico"
        assert fila["paciente_nombres"] == "Pepito"
        assert fila["paciente_apellidos"] == "Pérez"
        assert fila["paciente_numero_documento"] == "123456789"
        assert fila["tiene_pdf"] is True
 
    def test_trae_atenciones_soat_con_tipo_y_sin_nivel_servicio(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        # Issue #80 (adelanto): antes este endpoint solo traía
        # traslados -- los accidentes SOAT ya cerrados no aparecían en
        # el panel web, ni siquiera para descargar su PDF (issue #71).
        atencion_id = _crear_y_cerrar_atencion_soat(client, db, auxiliar_headers, "700000001")
 
        respuesta = client.get("/atenciones/cerradas", headers=admin_headers)
 
        assert respuesta.status_code == 200
        filas = respuesta.json()
        assert len(filas) == 1
        fila = filas[0]
        assert fila["id"] == atencion_id
        assert fila["tipo"] == "atencion_soat"
        assert fila["nivel_servicio"] is None
        assert fila["paciente_nombres"] == "Pepito"
        assert fila["tiene_pdf"] is True
 
    def test_atencion_soat_nn_aparece_sin_datos_de_paciente(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        # Un accidente SOAT puede cerrarse sin identificar al paciente
        # (NN, ADR-0002) -- debería poder listarse igual, sin nombre
        # ni documento.
        atencion_id = _crear_y_cerrar_atencion_soat(
            client, db, auxiliar_headers, "700000001", identificado=False
        )
 
        respuesta = client.get("/atenciones/cerradas", headers=admin_headers)
 
        filas = respuesta.json()
        assert len(filas) == 1
        fila = filas[0]
        assert fila["id"] == atencion_id
        assert fila["paciente_nombres"] is None
        assert fila["paciente_apellidos"] is None
        assert fila["paciente_numero_documento"] is None
 
    def test_mezcla_traslados_y_soat_ordenados_por_cierre(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        primera = _crear_y_cerrar_atencion(
            client, db, auxiliar_headers, "700000001", paciente_numero_documento="111111111"
        )
        segunda = _crear_y_cerrar_atencion_soat(
            client, db, auxiliar_headers, "700000001", paciente_numero_documento="222222222"
        )
 
        respuesta = client.get("/atenciones/cerradas", headers=admin_headers)
 
        ids_en_orden = [fila["id"] for fila in respuesta.json()]
        assert ids_en_orden == [segunda, primera]
 
    def test_no_incluye_abiertas(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        _crear_atencion(client, db, auxiliar_headers)
 
        respuesta = client.get("/atenciones/cerradas", headers=admin_headers)
 
        assert respuesta.json() == []
 
    def test_no_incluye_cerradas_sin_formato(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        # Se puede cerrar una atención que nunca llegó a tener
        # encabezado (servicio cancelado antes de atender a nadie, ver
        # ADR-0002) -- sin encabezado no hay datos de paciente ni PDF
        # que mostrar, así que no debería aparecer en este listado.
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
        usuario.pin_hash = hash_secret("1234")
        db.commit()
        cerrar = client.put(
            f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )
        assert cerrar.status_code == 200
 
        respuesta = client.get("/atenciones/cerradas", headers=admin_headers)
 
        assert respuesta.json() == []
 
    def test_mas_reciente_primero(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        primera = _crear_y_cerrar_atencion(
            client, db, auxiliar_headers, "700000001", paciente_numero_documento="111111111"
        )
        segunda = _crear_y_cerrar_atencion(
            client, db, auxiliar_headers, "700000001", paciente_numero_documento="222222222"
        )
 
        respuesta = client.get("/atenciones/cerradas", headers=admin_headers)
 
        ids_en_orden = [fila["id"] for fila in respuesta.json()]
        assert ids_en_orden == [segunda, primera]
 
    def test_busqueda_por_nombre_filtra(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        id_pepito = _crear_y_cerrar_atencion(
            client,
            db,
            auxiliar_headers,
            "700000001",
            paciente_nombres="Pepito",
            paciente_apellidos="Pérez",
            paciente_numero_documento="111111111",
        )
        _crear_y_cerrar_atencion(
            client,
            db,
            auxiliar_headers,
            "700000001",
            paciente_nombres="Juana",
            paciente_apellidos="Gómez",
            paciente_numero_documento="222222222",
        )
 
        respuesta = client.get(
            "/atenciones/cerradas", params={"q": "pepito"}, headers=admin_headers
        )
 
        ids = [fila["id"] for fila in respuesta.json()]
        assert ids == [id_pepito]
 
    def test_busqueda_por_documento_filtra(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        id_buscada = _crear_y_cerrar_atencion(
            client,
            db,
            auxiliar_headers,
            "700000001",
            paciente_numero_documento="999888777",
        )
        _crear_y_cerrar_atencion(
            client,
            db,
            auxiliar_headers,
            "700000001",
            paciente_numero_documento="111111111",
        )
 
        respuesta = client.get(
            "/atenciones/cerradas", params={"q": "999888"}, headers=admin_headers
        )
 
        ids = [fila["id"] for fila in respuesta.json()]
        assert ids == [id_buscada]
 
    def test_limit_fuera_de_rango_da_422(
        self, client: TestClient, admin_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/atenciones/cerradas", params={"limit": 101}, headers=admin_headers
        )
        assert respuesta.status_code == 422