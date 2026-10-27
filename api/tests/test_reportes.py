
"""Reporte del contador: totales de servicios por persona (issue #24).
 
No pasa por el flujo completo de crear/cerrar una atención con su
formato (eso ya está cubierto en `test_atenciones.py` y
`test_formato_*`) -- acá solo importa la fila de `Atencion` (quién fue
conductor, quién responsable, cuándo se cerró), así que se crea
directo en la base de datos de prueba.
"""
 
from __future__ import annotations
 
from datetime import UTC, date, datetime, time
 
import openpyxl
from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.atencion import Atencion, EstadoAtencion, TipoAtencion
from app.models.empleado import Empleado
from app.models.formato_traslado import (
    CategoriaPaciente,
    ComplejidadTraslado,
    FormatoTraslado,
    ModalidadTraslado,
    NivelServicioTraslado,
    SexoPaciente,
    TipoDocumentoPaciente,
)
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
 
 
def _crear_ambulancia(db: Session, movil: str = "M-rep") -> Ambulancia:
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
 
 
def _crear_empleado(db: Session, nombres: str, apellidos: str, cedula: str) -> Empleado:
    empleado = Empleado(nombres=nombres, apellidos=apellidos, cedula=cedula)
    db.add(empleado)
    db.commit()
    db.refresh(empleado)
    return empleado
 
 
def _crear_atencion(
    db: Session,
    ambulancia: Ambulancia,
    conductor: Empleado,
    responsable: Empleado,
    *,
    estado: EstadoAtencion = EstadoAtencion.cerrado,
    cerrada_en: datetime | None = None,
    tipo: TipoAtencion = TipoAtencion.traslado,
    nivel_servicio: NivelServicioTraslado = NivelServicioTraslado.basico,
) -> Atencion:
    """Crea la atención y, si es de tipo traslado, también el
    encabezado de `FormatoTraslado` del que sale el nivel de servicio
    (básico/medicalizado) que ahora desglosa el reporte -- en el
    sistema real siempre existe para una atención cerrada (se llena al
    recibir al paciente, no al cerrar), así que el reporte asume que
    está ahí.
    """
    abierta_en = cerrada_en or datetime(2027, 1, 1, tzinfo=UTC)
    atencion = Atencion(
        ambulancia_id=ambulancia.id,
        conductor_id=conductor.id,
        responsable_id=responsable.id,
        tipo=tipo,
        estado=estado,
        abierta_en=abierta_en,
        cerrada_en=cerrada_en,
    )
    db.add(atencion)
    db.commit()
    db.refresh(atencion)
 
    if tipo == TipoAtencion.traslado:
        formato = FormatoTraslado(
            atencion_id=atencion.id,
            paciente_tipo_documento=TipoDocumentoPaciente.cc,
            paciente_numero_documento="1000000000",
            paciente_eps="EPS de prueba",
            paciente_nombres="Paciente",
            paciente_apellidos="De Prueba",
            paciente_edad=30,
            paciente_sexo=SexoPaciente.m,
            paciente_direccion_residencial="Calle falsa 123",
            paciente_ciudad="Ocaña",
            recepcion_fecha=abierta_en.date(),
            recepcion_hora=time(8, 0),
            recepcion_ciudad="Ocaña",
            recepcion_ips="IPS de prueba",
            recepcion_servicio="Urgencias",
            complejidad=ComplejidadTraslado.baja,
            categoria_paciente=CategoriaPaciente.adulto,
            nivel_servicio=nivel_servicio,
            modalidad=ModalidadTraslado.sencillo,
        )
        db.add(formato)
        db.commit()
 
    return atencion
 
 
class TestPermisos:
    def test_admin_puede_consultar(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 200
 
    def test_contador_puede_consultar(
        self, client: TestClient, db: Session, contador_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=contador_headers,
        )
        assert respuesta.status_code == 200
 
    def test_auxiliar_no_puede_consultar(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=auxiliar_headers,
        )
        assert respuesta.status_code == 403
 
    def test_conductor_no_puede_consultar(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=conductor_headers,
        )
        assert respuesta.status_code == 403
 
    def test_sin_sesion_da_401(self, client: TestClient) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
        )
        assert respuesta.status_code == 401
 
 
class TestValidacionDeRango:
    def test_desde_mayor_que_hasta_da_422(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-31", "hasta": "2027-01-01"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 422
 
    def test_faltan_parametros_da_422(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        respuesta = client.get("/reportes/servicios-por-persona", headers=admin_headers)
        assert respuesta.status_code == 422
 
 
class TestTotales:
    def test_vacio_si_no_hay_cerradas_en_el_rango(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 200
        assert respuesta.json() == []
 
    def test_cuenta_conductor_y_responsable_en_filas_separadas(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        ambulancia = _crear_ambulancia(db)
        conductor = _crear_empleado(db, "Pedro", "Londoño", "800000100")
        auxiliar = _crear_empleado(db, "Ana", "Ruiz", "700000100")
        # Dos servicios: mismo conductor y mismo auxiliar en ambos.
        _crear_atencion(
            db, ambulancia, conductor, auxiliar, cerrada_en=datetime(2027, 1, 5, tzinfo=UTC)
        )
        _crear_atencion(
            db, ambulancia, conductor, auxiliar, cerrada_en=datetime(2027, 1, 10, tzinfo=UTC)
        )
 
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 200
        filas = respuesta.json()
        assert len(filas) == 2
 
        por_cedula = {fila["cedula"]: fila for fila in filas}
        assert por_cedula["800000100"]["funcion"] == "conductor"
        assert por_cedula["800000100"]["total"] == 2
        assert por_cedula["700000100"]["funcion"] == "responsable"
        assert por_cedula["700000100"]["total"] == 2
 
    def test_una_persona_que_hace_de_ambas_cosas_sale_en_dos_filas(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        """Decisión del cliente (mockup compartido en issue #24): no
        se combina en una sola fila -- una fila por persona y función.
        """
        ambulancia = _crear_ambulancia(db)
        empleado = _crear_empleado(db, "Carlos", "Gómez", "800000101")
        otro = _crear_empleado(db, "Laura", "Gómez", "700000101")
        # Un servicio donde `empleado` conduce, otro donde es responsable.
        _crear_atencion(
            db, ambulancia, empleado, otro, cerrada_en=datetime(2027, 1, 5, tzinfo=UTC)
        )
        _crear_atencion(
            db, ambulancia, otro, empleado, cerrada_en=datetime(2027, 1, 6, tzinfo=UTC)
        )
 
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        filas_empleado = [f for f in respuesta.json() if f["cedula"] == "800000101"]
        assert len(filas_empleado) == 2
        por_funcion = {f["funcion"]: f for f in filas_empleado}
        assert por_funcion["conductor"]["total"] == 1
        assert por_funcion["responsable"]["total"] == 1
 
    def test_desglosa_basicos_medicalizados_y_soat(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        ambulancia = _crear_ambulancia(db)
        conductor = _crear_empleado(db, "Pedro", "Londoño", "800000107")
        auxiliar = _crear_empleado(db, "Ana", "Ruiz", "700000107")
        _crear_atencion(
            db,
            ambulancia,
            conductor,
            auxiliar,
            cerrada_en=datetime(2027, 1, 5, tzinfo=UTC),
            tipo=TipoAtencion.traslado,
            nivel_servicio=NivelServicioTraslado.basico,
        )
        _crear_atencion(
            db,
            ambulancia,
            conductor,
            auxiliar,
            cerrada_en=datetime(2027, 1, 6, tzinfo=UTC),
            tipo=TipoAtencion.traslado,
            nivel_servicio=NivelServicioTraslado.medicalizado,
        )
        _crear_atencion(
            db,
            ambulancia,
            conductor,
            auxiliar,
            cerrada_en=datetime(2027, 1, 7, tzinfo=UTC),
            tipo=TipoAtencion.atencion_soat,
        )
 
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        fila = next(
            f
            for f in respuesta.json()
            if f["cedula"] == "800000107" and f["funcion"] == "conductor"
        )
        assert fila["basicos"] == 1
        assert fila["medicalizados"] == 1
        assert fila["soat"] == 1
        assert fila["total"] == 3
 
    def test_no_cuenta_atenciones_abiertas(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        ambulancia = _crear_ambulancia(db)
        conductor = _crear_empleado(db, "Pedro", "Londoño", "800000102")
        auxiliar = _crear_empleado(db, "Ana", "Ruiz", "700000102")
        _crear_atencion(db, ambulancia, conductor, auxiliar, estado=EstadoAtencion.abierto)
 
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        assert respuesta.json() == []
 
    def test_no_cuenta_cerradas_fuera_del_rango(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        ambulancia = _crear_ambulancia(db)
        conductor = _crear_empleado(db, "Pedro", "Londoño", "800000103")
        auxiliar = _crear_empleado(db, "Ana", "Ruiz", "700000103")
        _crear_atencion(
            db, ambulancia, conductor, auxiliar, cerrada_en=datetime(2027, 2, 1, tzinfo=UTC)
        )
 
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        assert respuesta.json() == []
 
    def test_limites_del_rango_son_inclusivos(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        ambulancia = _crear_ambulancia(db)
        conductor = _crear_empleado(db, "Pedro", "Londoño", "800000104")
        auxiliar = _crear_empleado(db, "Ana", "Ruiz", "700000104")
        # Justo al principio y al final del día del límite.
        _crear_atencion(
            db,
            ambulancia,
            conductor,
            auxiliar,
            cerrada_en=datetime(2027, 1, 1, 0, 0, 1, tzinfo=UTC),
        )
        _crear_atencion(
            db,
            ambulancia,
            conductor,
            auxiliar,
            cerrada_en=datetime(2027, 1, 31, 23, 59, 59, tzinfo=UTC),
        )
 
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        fila = next(f for f in respuesta.json() if f["cedula"] == "800000104")
        assert fila["total"] == 2
 
    def test_todos_los_tipos_de_atencion_cuentan_igual(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        """Decisión del cliente: traslado y accidente SOAT cuentan
        igual como servicio para el pago (ver nota de módulo de
        `app/api/routes/reportes.py` y la decisión guardada del
        issue #24)."""
        ambulancia = _crear_ambulancia(db)
        conductor = _crear_empleado(db, "Pedro", "Londoño", "800000105")
        auxiliar = _crear_empleado(db, "Ana", "Ruiz", "700000105")
        _crear_atencion(
            db,
            ambulancia,
            conductor,
            auxiliar,
            cerrada_en=datetime(2027, 1, 5, tzinfo=UTC),
            tipo=TipoAtencion.traslado,
        )
        _crear_atencion(
            db,
            ambulancia,
            conductor,
            auxiliar,
            cerrada_en=datetime(2027, 1, 6, tzinfo=UTC),
            tipo=TipoAtencion.atencion_soat,
        )
 
        respuesta = client.get(
            "/reportes/servicios-por-persona",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        fila = next(f for f in respuesta.json() if f["cedula"] == "800000105")
        assert fila["total"] == 2
 
 
class TestExcel:
    def test_contador_puede_descargar(
        self, client: TestClient, db: Session, contador_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona.xlsx",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=contador_headers,
        )
        assert respuesta.status_code == 200
        assert respuesta.headers["content-type"] == (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert "servicios-por-persona_2027-01-01_2027-01-31.xlsx" in (
            respuesta.headers["content-disposition"]
        )
 
    def test_auxiliar_no_puede_descargar(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona.xlsx",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=auxiliar_headers,
        )
        assert respuesta.status_code == 403
 
    def test_desde_mayor_que_hasta_da_422(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona.xlsx",
            params={"desde": "2027-01-31", "hasta": "2027-01-01"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 422
 
    def test_contenido_del_excel_coincide_con_el_json(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        ambulancia = _crear_ambulancia(db)
        conductor = _crear_empleado(db, "Pedro", "Londoño", "800000106")
        auxiliar = _crear_empleado(db, "Ana", "Ruiz", "700000106")
        _crear_atencion(
            db, ambulancia, conductor, auxiliar, cerrada_en=datetime(2027, 1, 5, tzinfo=UTC)
        )
 
        respuesta = client.get(
            "/reportes/servicios-por-persona.xlsx",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 200
 
        from io import BytesIO
 
        libro = openpyxl.load_workbook(BytesIO(respuesta.content))
        hoja = libro.active
        encabezados = [celda.value for celda in next(hoja.iter_rows(min_row=1, max_row=1))]
        assert encabezados == [
            "Cédula",
            "Nombres",
            "Apellidos",
            "Función",
            "Básicos",
            "Medicalizados",
            "SOAT",
            "Total",
        ]
        filas = list(hoja.iter_rows(min_row=2, values_only=True))
        # Un servicio básico: una fila para el conductor, otra para el
        # auxiliar, más la fila de totales al final.
        assert ("800000106", "Pedro", "Londoño", "Conductor", 1, 0, 0, 1) in filas
        assert ("700000106", "Ana", "Ruiz", "Auxiliar/médico", 1, 0, 0, 1) in filas
        assert filas[-1] == (None, None, None, "Total", 2, 0, 0, 2)
 
    def test_excel_sin_filas_no_trae_fila_de_totales(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        respuesta = client.get(
            "/reportes/servicios-por-persona.xlsx",
            params={"desde": "2027-01-01", "hasta": "2027-01-31"},
            headers=admin_headers,
        )
        assert respuesta.status_code == 200
 
        from io import BytesIO
 
        libro = openpyxl.load_workbook(BytesIO(respuesta.content))
        hoja = libro.active
        assert list(hoja.iter_rows(min_row=2, values_only=True)) == []