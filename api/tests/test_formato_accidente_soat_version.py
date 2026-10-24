"""Corrección de un formato de accidente SOAT cerrado, con historial de
versiones (issue #17, mismo mecanismo que `test_formato_version.py`
para traslado -- issue #14, ADR-0012).
"""
 
from __future__ import annotations
 
from collections.abc import Mapping
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
    "vehiculo_placa": "ABC123",
    "vehiculo_tipo": "Motocicleta",
    "vehiculo_marca": "Yamaha",
}

ENCABEZADO_CORREGIDO = {
    **ENCABEZADO_VALIDO,
    "paciente_edad": 46,
    "ciudad": "Ocaña",
    "vehiculo_placa": "XYZ789",
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
    "tratamiento": ["collar_cervical", "oxigeno"],
    "signos_vitales": [{"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97}],
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "triage": "ii",
    "descripcion": "Paciente víctima de accidente de tránsito, trasladado estable.",
    # Issue #71
    "nota_auxiliar": "Paciente estable durante el traslado.",
    "atendido_por": "Ana Ruiz",
    "firma_atendido_por": "data:image/png;base64,AAAA",
    "profesional_recibe_nombre": "Dra. Carolina Pinto",
    "profesional_recibe_cedula": "1098765432",
    "firma_profesional_recibe": "data:image/png;base64,CCCC",
}
 
CLINICO_CORREGIDO = {**CLINICO_VALIDO, "descripcion": "Se corrige clasificación de triage"}
 
 
def _crear_ambulancia(db: Session, movil: str = "M-soatver") -> Ambulancia:
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
 
 
def _crear_conductor(db: Session, cedula: str = "800000598") -> Empleado:
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
        json={
            "tipo": "atencion_soat",
            "ambulancia_id": ambulancia.id,
            "conductor_id": conductor.id,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["id"]
 
 
def _crear_atencion_cerrada_con_formato(
    client: TestClient,
    db: Session,
    headers: dict[str, str],
    encabezado: Mapping[str, object] | None = None,
) -> int:
    """Atención SOAT con encabezado + clínico completos, ya cerrada --
    el punto de partida de casi todas las pruebas de este archivo.
    """
    atencion_id = _crear_atencion(client, db, headers)
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=encabezado or ENCABEZADO_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
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
    def test_admin_no_puede_editar_encabezado_de_atencion_abierta(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
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
            f"/atenciones/{atencion_id}/formato-accidente-soat",
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
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
            json=CLINICO_CORREGIDO,
            headers=medico_headers,
        )
 
        assert respuesta.status_code == 409
 
 
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
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=ENCABEZADO_CORREGIDO,
            headers=admin_headers,
        )
 
        assert respuesta.status_code == 200
        assert respuesta.json()["paciente_edad"] == 46
        assert respuesta.json()["ciudad"] == "Ocaña"
        # Issue #89 -- el vehículo se versiona igual que el resto del
        # encabezado.
        assert respuesta.json()["vehiculo_placa"] == "XYZ789"

    def test_admin_corrige_el_clinico_de_atencion_cerrada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
            json=CLINICO_CORREGIDO,
            headers=admin_headers,
        )
 
        assert respuesta.status_code == 200
        assert respuesta.json()["descripcion"] == "Se corrige clasificación de triage"
        # El resto de lo clínico sigue estando (no se pisa con la corrección parcial).
        assert respuesta.json()["atendido_por"] == "Ana Ruiz"
        assert respuesta.json()["profesional_recibe_nombre"] == "Dra. Carolina Pinto"
 
    def test_firma_y_atendido_por_quedan_en_el_historial_tras_una_correccion(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
            json=CLINICO_CORREGIDO,
            headers=admin_headers,
        )
 
        historial = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/historial", headers=admin_headers
        ).json()
 
        assert len(historial) == 1
        version = historial[0]
        assert version["nota_auxiliar"] == "Paciente estable durante el traslado."
        assert version["atendido_por"] == "Ana Ruiz"
        assert version["firma_atendido_por"] == "data:image/png;base64,AAAA"
        assert version["profesional_recibe_nombre"] == "Dra. Carolina Pinto"
        assert version["firma_profesional_recibe"] == "data:image/png;base64,CCCC"
 
    def test_admin_completa_la_identidad_de_un_nn_tras_el_cierre(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """ADR-0002: un paciente NN que se identifica después del
        cierre se corrige igual que cualquier otro dato -- no hay un
        flujo especial de "conversión", y el estado NN que tenía queda
        en el historial.
        """
        atencion_id = _crear_atencion_cerrada_con_formato(
            client, db, auxiliar_headers, encabezado=ENCABEZADO_NN
        )
 
        identificado = {
            **ENCABEZADO_VALIDO,
            "identificado": True,
        }
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=identificado,
            headers=admin_headers,
        )
 
        assert respuesta.status_code == 200
        assert respuesta.json()["identificado"] is True
        assert respuesta.json()["paciente_nombres"] == "Pepito"
 
        historial = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/historial", headers=admin_headers
        ).json()
        assert len(historial) == 1
        assert historial[0]["identificado"] is False
        assert historial[0]["paciente_nombres"] is None
 
 
class TestHistorial:
    def test_vacio_si_nunca_hubo_correccion(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/historial", headers=auxiliar_headers
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
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=ENCABEZADO_CORREGIDO,
            headers=admin_headers,
        )
 
        historial = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/historial", headers=admin_headers
        )
        assert historial.status_code == 200
        versiones = historial.json()
        assert len(versiones) == 1
        assert versiones[0]["paciente_edad"] == 45
        assert versiones[0]["ciudad"] == "Cúcuta"
        # Issue #89 -- el estado anterior del vehículo también queda
        # en el historial (ENCABEZADO_CORREGIDO cambia la placa).
        assert versiones[0]["vehiculo_placa"] == "ABC123"
        assert versiones[0]["corregido_por"]["documento"] == "999999999"
 
    def test_conductor_no_puede_ver_el_historial(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        conductor_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/historial",
            headers=conductor_headers,
        )
 
        assert respuesta.status_code == 403
 
    def test_sin_token_da_401(self, client: TestClient) -> None:
        respuesta = client.get("/atenciones/1/formato-accidente-soat/historial")
        assert respuesta.status_code == 401