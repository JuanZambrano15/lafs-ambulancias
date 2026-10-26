"""Corrección de formato cerrado, con historial de versiones
(issue #14, ADR-0012; combinada en un solo endpoint desde el #80,
ajuste -- ver `corregir_formato_traslado`).
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
    "evolucionado_por": "Dr. Luis Torres",
    "profesional_recibe_nombre": "Carlos Gómez",
    "profesional_recibe_cedula": "900000002",
}

# Corrección combinada "de verdad": cambia algo rastreable
# (paciente_edad/ciudad, en el encabezado) -- debe generar una fila
# de historial.
CORRECCION_VALIDA = {
    **ENCABEZADO_VALIDO,
    **CLINICO_VALIDO,
    "paciente_edad": 46,
    "paciente_ciudad": "Ocaña",
    "diagnostico": "TCE moderado, se corrige clasificación",
}

# Corrección "solo notas": todo lo rastreable queda IGUAL que
# CLINICO_VALIDO/ENCABEZADO_VALIDO, solo cambian diagnóstico, nota de
# auxiliar/médico y quién las firma -- NO debe generar ninguna fila
# de historial (issue #80, el bug reportado).
CORRECCION_SOLO_NOTAS = {
    **ENCABEZADO_VALIDO,
    **CLINICO_VALIDO,
    "diagnostico": "TCE moderado, se corrige clasificación",
    "nota_medica": "Se amplía la nota médica tras la evolución.",
}


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
    abierta → auxiliar/médico, no admin; cerrada → nadie por estas
    rutas, ni siquiera el admin (issue #80, ajuste) -- corregir una
    atención cerrada es siempre `PUT .../corregir`.
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
            json={**ENCABEZADO_VALIDO, "paciente_edad": 46},
            headers=auxiliar_headers,
        )

        assert respuesta.status_code == 409

    def test_admin_tampoco_puede_editar_encabezado_de_cerrada_por_esta_ruta(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Issue #80 (ajuste): esta ruta ya no tiene rama de
        corrección de administrador -- eso es `PUT .../corregir`.
        """
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json={**ENCABEZADO_VALIDO, "paciente_edad": 46},
            headers=admin_headers,
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
            json=CLINICO_VALIDO,
            headers=medico_headers,
        )

        assert respuesta.status_code == 409

    def test_admin_tampoco_puede_editar_clinico_de_cerrada_por_esta_ruta(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=CLINICO_VALIDO,
            headers=admin_headers,
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
    """`PUT .../formato-traslado/corregir` (issue #80, ajuste): un
    solo endpoint para encabezado + clínico, un solo `motivo`, como
    mucho una fila de historial.
    """

    def test_admin_corrige_encabezado_y_clinico_en_una_sola_llamada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            params={"motivo": "El paciente corrigió su edad y ciudad al revisar el PDF"},
            headers=admin_headers,
        )

        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["paciente_edad"] == 46
        assert cuerpo["paciente_ciudad"] == "Ocaña"
        assert cuerpo["diagnostico"] == "TCE moderado, se corrige clasificación"

    def test_la_corregida_no_es_admin_no_puede(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            params={"motivo": "Intento sin ser administrador"},
            headers=auxiliar_headers,
        )

        assert respuesta.status_code == 403

    def test_corregir_de_atencion_abierta_da_409(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado", json=ENCABEZADO_VALIDO,
            headers=auxiliar_headers,
        )

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            params={"motivo": "No debería aplicar, sigue abierta"},
            headers=admin_headers,
        )

        assert respuesta.status_code == 409

    def test_corregir_sin_motivo_da_422(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            headers=admin_headers,
        )

        assert respuesta.status_code == 422

    def test_corregir_con_motivo_en_blanco_da_422(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            params={"motivo": "   "},
            headers=admin_headers,
        )

        assert respuesta.status_code == 422

    def test_corregir_con_motivo_en_blanco_no_crea_formato_aunque_cambie_solo_notas(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Issue #80: `motivo` es siempre obligatorio, incluso cuando
        la corrección termina siendo "solo notas" y no deja fila en
        el historial -- se valida ANTES de decidir si hay o no fila.
        """
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_SOLO_NOTAS,
            headers=admin_headers,
        )

        assert respuesta.status_code == 422

    def test_corregir_sin_formato_previo_da_404(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Atención cerrada sin que nunca haya tenido encabezado
        (ADR-0002: se puede cerrar igual) — no hay nada que corregir,
        404 en vez de crear algo de la nada.
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
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            params={"motivo": "No hay nada que corregir"},
            headers=admin_headers,
        )

        assert respuesta.status_code == 404


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

    def test_una_correccion_crea_una_sola_version_con_el_estado_anterior(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Issue #80, el bug reportado: antes, encabezado + clínico
        por separado dejaban DOS filas para una sola corrección
        lógica -- con el endpoint combinado, una corrección es una
        sola fila.
        """
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            params={"motivo": "El paciente llamó a corregir su edad y ciudad"},
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
        # Issue #80 -- el motivo de la corrección queda en el historial.
        assert versiones[0]["motivo"] == "El paciente llamó a corregir su edad y ciudad"

    def test_correccion_solo_de_notas_no_deja_ninguna_fila(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Issue #80, el bug reportado: corregir ÚNICAMENTE
        diagnóstico/notas (incluido agregar o cambiar quién
        atendió/evolucionó y su firma) no debe dejar rastro alguno en
        el historial -- ni la fila, ni el motivo.
        """
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_SOLO_NOTAS,
            params={"motivo": "Se ajustó el diagnóstico tras revisión médica"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 200
        assert respuesta.json()["diagnostico"] == CORRECCION_SOLO_NOTAS["diagnostico"]

        historial = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=admin_headers
        ).json()
        assert historial == []

    def test_agregar_medico_que_antes_no_estaba_no_deja_fila(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        """Repro exacto del issue #80: un básico sin médico al que se
        le agrega "evolucionado_por" (el médico) y su nota NO debe
        dejar ninguna fila -- antes sí dejaba, porque
        `evolucionado_por`/`firma_evolucionado_por` estaban en
        `_CAMPOS_VERSIONADOS` (se siguen guardando ahí si se crea una
        fila por otro motivo) pero no se habían sacado de lo
        "rastreable": agregar al médico contaba como un cambio que
        disparaba la fila, aunque la nota médica en sí ya estuviera
        excluida.
        """
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        basico_sin_medico = {
            **ENCABEZADO_VALIDO,
            "nivel_servicio": "basico",
        }
        clinico_sin_medico = {
            **CLINICO_VALIDO,
            "nota_medica": None,
            "evolucionado_por": None,
        }
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=basico_sin_medico,
            headers=auxiliar_headers,
        )
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado/clinico",
            json=clinico_sin_medico,
            headers=auxiliar_headers,
        )
        usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
        usuario.pin_hash = hash_secret("1234")
        db.commit()
        client.put(
            f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )

        con_medico = {
            **basico_sin_medico,
            **clinico_sin_medico,
            "evolucionado_por": "Dra. María Gómez",
            "nota_medica": "Se incorpora evolución del médico de planta",
        }
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=con_medico,
            params={"motivo": "Se agregó al médico que faltaba registrar"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 200

        historial = client.get(
            f"/atenciones/{atencion_id}/formato-traslado/historial", headers=admin_headers
        ).json()
        assert historial == []

    def test_varias_correcciones_quedan_mas_reciente_primero(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = _crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json={**CORRECCION_VALIDA, "paciente_edad": 46},
            params={"motivo": "Primera corrección"},
            headers=admin_headers,
        )
        client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json={**CORRECCION_VALIDA, "paciente_edad": 47},
            params={"motivo": "Segunda corrección"},
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
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json=CORRECCION_VALIDA,
            params={"motivo": "Se ajustó el diagnóstico tras revisión médica"},
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
        # Issue #75: el profesional que recibe también se versiona.
        assert version["profesional_recibe_nombre"] == "Carlos Gómez"
        assert version["profesional_recibe_cedula"] == "900000002"

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