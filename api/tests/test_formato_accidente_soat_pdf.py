"""PDF del formato de accidente SOAT (issue #71, ADR-0011) -- mismas
pruebas que `test_formato_traslado_pdf.py`, adaptadas a este formato
(encabezado con posible NN, sin "insumos entregados", con
"nota_auxiliar"/"nota_medica" nuevas en este issue para la segunda
página).
"""
 
from datetime import date
 
import pytest
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
 
# PNG 1x1 válido (no un string cualquiera) para que WeasyPrint pueda
# decodificarlo igual que una firma real en producción -- con datos
# basura, WeasyPrint omite la imagen en silencio y el PDF resultante
# no refleja el contenido real del formato (mismo comentario que
# `test_formato_traslado_pdf.py`).
_FIRMA_PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
    "CAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
 
CLINICO_VALIDO = {
    "tratamiento": ["collar_cervical", "oxigeno", "otros"],
    "tratamiento_otro": "Férula en brazo izquierdo",
    "pupila_derecha": "isocorica",
    "pupila_izquierda": "isocorica",
    "signos_vitales": [{"hora": "08:05", "ta": "120/80", "fc": 88, "fr": 18, "spo2": 97}],
    "lesiones_localizadas": [
        {"tipo": "tce", "tipo_otro": None, "zona": "cabeza", "lado": "central", "vista": "frontal"},
        {
            "tipo": "contusion",
            "tipo_otro": None,
            "zona": "pierna",
            "lado": "derecho",
            "vista": "posterior",
        },
    ],
    "glasgow_ocular": 4,
    "glasgow_verbal": 5,
    "glasgow_motora": 6,
    "triage": "ii",
    "descripcion": "Paciente víctima de accidente de tránsito, trasladado estable.",
    # Issue #71 -- nuevas en este issue, para la segunda página del PDF.
    "nota_auxiliar": "Paciente estable durante el traslado, se administró oxígeno.",
    "atendido_por": "Ana Ruiz",
    "firma_atendido_por": _FIRMA_PNG,
    "nota_medica": "Se recomienda observación por 24 horas.",
    "evolucionado_por": "Laura Gómez",
    "firma_evolucionado_por": _FIRMA_PNG,
    "profesional_recibe_nombre": "Dra. Carolina Pinto",
    "profesional_recibe_cedula": "1098765432",
    "firma_profesional_recibe": _FIRMA_PNG,
}
 
 
def _crear_ambulancia(db: Session, movil: str = "M-soat-pdf") -> Ambulancia:
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
 
 
def _crear_conductor(db: Session, cedula: str = "800000599") -> Empleado:
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
 
 
def _crear_atencion_con_encabezado(client: TestClient, db: Session, headers: dict[str, str]) -> int:
    atencion_id = _crear_atencion(client, db, headers)
    respuesta = client.put(
        f"/atenciones/{atencion_id}/formato-accidente-soat",
        json=ENCABEZADO_VALIDO,
        headers=headers,
    )
    assert respuesta.status_code == 200
    return atencion_id
 
 
class TestGeneracionAutomatica:
    """El PDF se regenera solo, como efecto secundario de guardar
    (ver ADR-0011) — nunca lo pide el cliente explícitamente, mismo
    criterio que `formato_traslado`.
    """
 
    def test_guardar_encabezado_genera_un_pdf(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
 
        assert respuesta.status_code == 200
        assert respuesta.headers["content-type"] == "application/pdf"
        assert respuesta.content.startswith(b"%PDF")
 
    def test_guardar_encabezado_de_paciente_nn_genera_pdf_igual(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        """ADR-0002 -- un paciente NN deja la identidad en blanco, el
        PDF tiene que mostrar eso sin reventar con AttributeError
        sobre None (`paciente_tipo_documento`/`paciente_sexo` son los
        dos campos que requieren `.value` condicional)."""
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        nn = {
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
        creado = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat", json=nn, headers=auxiliar_headers
        )
        assert creado.status_code == 200
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
        assert respuesta.status_code == 200
        assert respuesta.content.startswith(b"%PDF")
 
    def test_guardar_clinico_regenera_el_pdf(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
        pdf_antes = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        ).content
 
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
            json=CLINICO_VALIDO,
            headers=auxiliar_headers,
        )
        assert respuesta.status_code == 200
 
        pdf_despues = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        ).content
        assert pdf_despues.startswith(b"%PDF")
        # No comparar por tamaño (ver mismo comentario en
        # test_formato_traslado_pdf.py) -- lo que importa es que
        # cambió.
        assert pdf_despues != pdf_antes
 
    def test_cerrar_la_atencion_regenera_el_pdf(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
        client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
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
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
        assert pdf.status_code == 200
        assert pdf.content.startswith(b"%PDF")
 
    def test_cerrar_sin_encabezado_no_falla_aunque_no_haya_pdf(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
        usuario = db.query(Usuario).filter(Usuario.documento == "700000001").one()
        usuario.pin_hash = hash_secret("1234")
        db.commit()
 
        cerrar = client.put(
            f"/atenciones/{atencion_id}/cerrar", json={"pin": "1234"}, headers=auxiliar_headers
        )
        assert cerrar.status_code == 200
 
        pdf = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
        assert pdf.status_code == 404
 
 
class TestDescargaPdf:
    def test_sin_token_da_401(self, client: TestClient) -> None:
        respuesta = client.get("/atenciones/1/formato-accidente-soat/pdf")
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
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=conductor_headers
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
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=medico_headers
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
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=admin_headers
        )
 
        assert respuesta.status_code == 200
 
    def test_atencion_inexistente_da_404(
        self, client: TestClient, auxiliar_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/atenciones/999999/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
        assert respuesta.status_code == 404
 
    def test_sin_encabezado_todavia_da_404(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
 
        assert respuesta.status_code == 404
 
 
class TestContenidoDelPdf:
    """No se parsea el PDF byte a byte -- solo se confirma que el
    render no reviente con los distintos tipos de dato que puede traer
    el formato (listas vacías, firmas ausentes, sin lesiones, etc.),
    mismo criterio que `test_formato_traslado_pdf.py`.
    """
 
    def test_pdf_con_encabezado_minimo_sin_clinico_no_falla(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        sin_telefono = {**ENCABEZADO_VALIDO, "telefono_contacto": None, "numero_poliza": None}
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        guardar = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=sin_telefono,
            headers=auxiliar_headers,
        )
        assert guardar.status_code == 200
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
        assert respuesta.status_code == 200
        assert respuesta.content.startswith(b"%PDF")
 
    def test_pdf_con_clinico_vacio_no_falla(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        clinico_vacio = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
            json={},
            headers=auxiliar_headers,
        )
        assert clinico_vacio.status_code == 200
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
        assert respuesta.status_code == 200
        assert respuesta.content.startswith(b"%PDF")
 
    def test_pdf_con_varias_lesiones_y_diagrama_no_falla(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        """Issue #71 -- el diagrama corporal con puntos (reusado de
        `formato_traslado.py`) es lo único que cambia respecto al
        papel real; esta prueba ejercita ese camino con más de un
        color en ciclo (ver `_COLORES_LESION`)."""
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
        con_varias_lesiones = {
            **CLINICO_VALIDO,
            "lesiones_localizadas": [
                {
                    "tipo": "hematoma",
                    "tipo_otro": None,
                    "zona": "pierna",
                    "lado": "derecho",
                    "vista": "frontal",
                },
                {
                    "tipo": "tce",
                    "tipo_otro": None,
                    "zona": "cabeza",
                    "lado": "central",
                    "vista": "frontal",
                },
                {
                    "tipo": "fractura_abierta",
                    "tipo_otro": None,
                    "zona": "brazo",
                    "lado": "izquierdo",
                    "vista": "posterior",
                },
            ],
        }
        guardar = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
            json=con_varias_lesiones,
            headers=auxiliar_headers,
        )
        assert guardar.status_code == 200
 
        respuesta = client.get(
            f"/atenciones/{atencion_id}/formato-accidente-soat/pdf", headers=auxiliar_headers
        )
        assert respuesta.status_code == 200
        assert respuesta.content.startswith(b"%PDF")
 
 
class TestVigenciaPolizaYCedulaAuxiliar:
    """Issue #88 -- la fila de "Vigencia póliza" se armaba con
    `colspan="3"` + dos `<td>` sueltos (5 "unidades" de columna en una
    tabla de 4), lo que descuadraba el resto del encabezado en cuanto
    el valor no estaba vacío; y la cédula del auxiliar no aparecía en
    ningún lado del PDF (se dejaba en `None` a propósito, ver el
    comentario en `app/pdf/formato_accidente_soat.py`).
 
    Como el resto de este archivo, no se parsea el PDF final (ver
    `TestContenidoDelPdf`) -- acá se intercepta el HTML que arma
    Jinja2 justo antes de pasar por WeasyPrint (monkeypatch sobre
    `HTML`, el símbolo que importa ese módulo), para poder revisar
    contenido sin agregar una dependencia nueva de parseo de PDF.
    """
 
    def _interceptar_html(self, monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
        capturado: dict[str, str] = {}
 
        class _HTMLFalso:
            def __init__(self, string: str) -> None:
                capturado["html"] = string
 
            def write_pdf(self) -> bytes:
                return b"%PDF-1.4 (falso, solo para la prueba)"
 
        monkeypatch.setattr("app.pdf.formato_accidente_soat.HTML", _HTMLFalso)
        return capturado
 
    def test_fila_vigencia_poliza_queda_en_una_sola_celda(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        capturado = self._interceptar_html(monkeypatch)
        # ENCABEZADO_VALIDO ya trae fechas de vigencia reales (no
        # vacías) -- es justo el caso que descuadraba antes.
        _crear_atencion_con_encabezado(client, db, auxiliar_headers)
 
        html = capturado["html"]
        # La fila entera (casillas de rol de víctima + vigencia póliza)
        # debe tener exactamente 2 <td> -- uno con colspan="3" para las
        # casillas (3 unidades), uno con el label+valor de vigencia
        # póliza (1 unidad): suman las 4 de la tabla. Antes tenía 3
        # <td> (el de colspan="3" + dos sueltos = 5 unidades).
        inicio = html.index("Conductor&nbsp;")
        fin = html.index("</tr>", inicio)
        fila = html[inicio:fin]
        assert fila.count("<td") == 2
        assert 'Vigencia póliza:</b> 01/01/2026 / 01/01/2027' in html
 
    def test_cedula_del_auxiliar_aparece_en_firmas_y_tripulacion(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        capturado = self._interceptar_html(monkeypatch)
        atencion_id = _crear_atencion_con_encabezado(client, db, auxiliar_headers)
        guardar = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/clinico",
            json=CLINICO_VALIDO,
            headers=auxiliar_headers,
        )
        assert guardar.status_code == 200
 
        html = capturado["html"]
        # `auxiliar_headers` liga el usuario a un Empleado con esta
        # cédula (ver conftest.py); CLINICO_VALIDO pone "Ana Ruiz"
        # como atendido_por, el mismo nombre de ese empleado.
        assert html.count("700000001") == 2
 
    def test_sin_auxiliar_no_muestra_una_cedula_huerfana(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Si "atendido por" sigue vacío, no debería aparecer la cédula
        # del auxiliar logueado sin nombre al lado -- se vería como un
        # dato huérfano, no como una corrección real del bug.
        capturado = self._interceptar_html(monkeypatch)
        _crear_atencion_con_encabezado(client, db, auxiliar_headers)

        html = capturado["html"]
        assert "700000001" not in html


class TestDatosDelVehiculo:
    """Issue #89 -- `vehiculo_placa`/`vehiculo_tipo`/`vehiculo_marca`
    se habían quitado por error en el #70 (ver nota de módulo en
    `app/models/formato_accidente_soat.py`) y se vuelven a agregar; la
    fila correspondiente del PDF, antes con labels sin valor, ahora
    debe mostrar los tres datos reales. Mismo mecanismo de
    interceptar el HTML que `TestVigenciaPolizaYCedulaAuxiliar`.
    """

    def _interceptar_html(self, monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
        capturado: dict[str, str] = {}

        class _HTMLFalso:
            def __init__(self, string: str) -> None:
                capturado["html"] = string

            def write_pdf(self) -> bytes:
                return b"%PDF-1.4 (falso, solo para la prueba)"

        monkeypatch.setattr("app.pdf.formato_accidente_soat.HTML", _HTMLFalso)
        return capturado

    def test_los_datos_del_vehiculo_aparecen_en_el_pdf(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        capturado = self._interceptar_html(monkeypatch)
        # ENCABEZADO_VALIDO ya trae placa/tipo/marca reales.
        _crear_atencion_con_encabezado(client, db, auxiliar_headers)

        html = capturado["html"]
        assert "ABC123" in html
        assert "Motocicleta" in html
        assert "Yamaha" in html

    def test_sin_datos_del_vehiculo_muestra_guion(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # Igual que numero_poliza, estos campos pueden no conocerse
        # todavía al recibir al paciente -- no deben quedar en blanco
        # sin marca visual, mismo criterio que el resto del PDF.
        capturado = self._interceptar_html(monkeypatch)
        atencion_id = _crear_atencion(client, db, auxiliar_headers)
        sin_vehiculo = {
            **ENCABEZADO_VALIDO,
            "vehiculo_placa": None,
            "vehiculo_tipo": None,
            "vehiculo_marca": None,
        }
        respuesta = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=sin_vehiculo,
            headers=auxiliar_headers,
        )
        assert respuesta.status_code == 200

        html = capturado["html"]
        assert "ABC123" not in html
        inicio = html.index("<b>Placa</b>")
        fin = html.index("</tr>", inicio)
        fila_placa = html[inicio:fin]
        assert "—" in fila_placa