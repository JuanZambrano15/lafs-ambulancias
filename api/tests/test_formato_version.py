"""Corrección de formato cerrado, con historial de versiones
(issue #14, ADR-0012).
"""
 
from __future__ import annotations
 
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
 
ENCABEZADO_CORREGIDO = {**ENCABEZADO_VALIDO, "paciente_edad": 46, "paciente_ciudad": "Ocaña"}
 
CLINICO_VALIDO = {
    "diagnostico": "Trauma craneoencefálico leve por caída de altura",
    "tratamiento": ["collar_cervical", "oxigeno"],
    "signos_vitales": [{"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97}],
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "nota_auxiliar": "Paciente estable durante el traslado.",
    # ENCABEZADO_VALIDO usa nivel_servicio "medicalizado" -- issue #57
    # hace obligatoria la nota médica en ese nivel, así que el formato
    # "válido" de este archivo también debe tenerla o ya no se podría
    # cerrar (_crear_atencion_cerrada_con_formato, usado por casi todas
    # las pruebas de aquí).
    "nota_medica": "Se recomienda TAC de cráneo al ingreso.",
    "atendido_por": "Ana Ruiz",
}
 
CLINICO_CORREGIDO = {**CLINICO_VALIDO, "diagnostico": "TCE moderado, se corrige clasificación"}
 
 
def _crear_ambulancia(db: Session, movil: str = "M-ver") -> Ambulancia:
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
 
 
def _crear_atencion_cerrada_con_formato(
    client: TestClient, db: Session, headers: dict[str, str]
) -> int:
    """Atención con encabezado + clínico completos, ya cerrada —
    el punto de partida de casi todas las pruebas de este archivo.
    """
    atencion_id = _crear_atencion(client, db, headers)
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-traslado", json=ENCABEZADO_VALIDO, headers=headers
    )
    assert respuesta.status_code == 200
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-traslado/clinico",
        json=CLINICO_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
 
    usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
    usuario.pin_hash = hash_secret("1234")
    db.commit()
 
    cerrar = client.put(f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=headers)
    assert cerrar.status_code == 200
 
    return atencion_id
 
 
class TestPermisosDeEdicion:
    """Quién puede editar según el estado de la atención (ADR-0012):
    abierta → auxiliar/médico, no admin; cerrada → solo admin.
    """
 
    def test_admin_no_puede_editar_encabezado_de_atencion_abierta(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=ENCABEZADO_VALIDO,
            headers=admin_headers,
        )
 
        assert respuesta.status_code == 403
 
    def test_auxiliar_no_puede_editar_encabezado_de_atencion_cerrada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=ENCABEZADO_CORREGIDO,
            headers=auxiliar_headers,
        )
 
        assert respuesta.status_code == 409
 
    def test_medico_no_puede_editar_clinico_de_atencion_cerrada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        medico_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=CLINICO_CORREGIDO,
            headers=medico_headers,
        )
 
        assert respuesta.status_code == 409
 
    def test_conductor_no_puede_editar_nada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        conductor_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=ENCABEZADO_VALIDO,
            headers=conductor_headers,
        )
 
        assert respuesta.status_code == 403
 
 
class TestCorreccionDeAdministrador:
    def test_admin_corrige_el_encabezado_de_atencion_cerrada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=ENCABEZADO_CORREGIDO,
            headers=admin_headers,
        )
 
        assert respuesta.status_code == 200
        assert respuesta.json()["paciente_edad"] == 46
        assert respuesta.json()["paciente_ciudad"] == "Ocaña"
 
    def test_admin_corrige_el_clinico_de_atencion_cerrada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=CLINICO_CORREGIDO,
            headers=admin_headers,
        )
 
        assert respuesta.status_code == 200
        assert respuesta.json()["diagnostico"] == "TCE moderado, se corrige clasificación"
 
    def test_corregir_sin_encabezado_previo_da_404(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Atención cerrada sin que nunca haya tenido encabezado
        (ADR-0002: se puede cerrar igual) — no hay parte clínica que
        corregir, 404 en vez de crear algo de la nada.
        """
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
        usuario.pin_hash = hash_secret("1234")
        db.commit()
        cerrar = client.put(
            f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )
        assert cerrar.status_code == 200
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=CLINICO_CORREGIDO,
            headers=admin_headers,
        )
 
        assert respuesta.status_code == 404
 
    def test_admin_crea_encabezado_en_cerrada_sin_formato_previo_no_genera_version(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Caso límite: atención cerrada que nunca tuvo encabezado. El
        admin puede crearlo (no hay nada que "corregir" todavía), pero
        no hay un estado anterior que versionar.
        """
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
        usuario.pin_hash = hash_secret("1234")
        db.commit()
        cerrar = client.put(
            f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )
        assert cerrar.status_code == 200
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=ENCABEZADO_VALIDO,
            headers=admin_headers,
        )
        assert respuesta.status_code == 200
 
        historial = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=admin_headers
        )
        assert historial.json() == []
 
 
class TestHistorial:
    def test_vacio_si_nunca_hubo_correccion(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=auxiliar_headers
        )
 
        assert respuesta.status_code == 200
        assert respuesta.json() == []
 
    def test_una_correccion_crea_una_version_con_el_estado_anterior(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=ENCABEZADO_CORREGIDO,
            headers=admin_headers,
        )
 
        historial = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=admin_headers
        )
        assert historial.status_code == 200
        versiones = historial.json()
        assert len(versiones) == 1
        # La versión guardada es el estado ANTERIOR a la corrección.
        assert versiones[0]["paciente_edad"] == 45
        assert versiones[0]["paciente_ciudad"] == "Cúcuta"
        assert versiones[0]["corregido_por"]["documento"] == "999999999"
 
    def test_varias_correcciones_quedan_mas_reciente_primero(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json={**ENCABEZADO_VALIDO, "paciente_edad": 46},
            headers=admin_headers,
        )
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json={**ENCABEZADO_VALIDO, "paciente_edad": 47},
            headers=admin_headers,
        )
 
        historial = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=admin_headers
        ).json()
 
        assert len(historial) == 2
        # La más reciente (penúltimo estado, edad 46) va primero.
        assert historial[0]["paciente_edad"] == 46
        assert historial[1]["paciente_edad"] == 45
 
    def test_diagnostico_y_notas_nunca_aparecen_en_el_historial(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=CLINICO_CORREGIDO,
            headers=admin_headers,
        )
 
        historial = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=admin_headers
        ).json()
 
        assert len(historial) == 1
        version = historial[0]
        assert "diagnostico" not in version
        assert "nota_auxiliar" not in version
        assert "nota_medica" not in version
        # El resto de lo clínico sí sigue estando.
        assert version["atendido_por"] == "Ana Ruiz"
 
    def test_conductor_no_puede_ver_el_historial(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        conductor_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=conductor_headers
        )
 
        assert respuesta.status_code == 403
 
    def test_sin_token_da_401(self, client: TestClient) -> None:
        respuesta = client.get("/atenciones/1/formato-traslado/historial")
        assert respuesta.status_code == 401