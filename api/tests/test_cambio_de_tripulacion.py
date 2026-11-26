"""Cambio de ambulancia, conductor y responsable al corregir un formato
cerrado: no deja nada en el historial de versiones.

Reusa los helpers y datos de `test_formato_version.py` (traslado) y
`test_formato_accidente_soat_version.py` (accidente SOAT).
"""

from __future__ import annotations

from app.core.security import hash_secret
from app.models.empleado import Empleado
from app.models.formato_version import FormatoVersion
from app.models.rol import Rol
from app.models.usuario import Usuario
from app.models.usuario_rol import UsuarioRol
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests import test_formato_accidente_soat_version as soat
from tests import test_formato_version as traslado


def _crear_empleado_con_rol(db: Session, cedula: str, rol_nombre: str, nombre: str) -> Empleado:
    empleado = Empleado(nombres=nombre, apellidos="Prueba", cedula=cedula)
    db.add(empleado)
    db.flush()
    rol = db.query(Rol).filter(Rol.nombre == rol_nombre).first()
    if rol is None:
        rol = Rol(nombre=rol_nombre, descripcion="Rol de prueba")
        db.add(rol)
        db.flush()
    usuario = Usuario(documento=cedula, password_hash=hash_secret("clave"), empleado_id=empleado.id)
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.commit()
    db.refresh(empleado)
    return empleado


class TestCambioDeTripulacionAlCorregir:
    def _corregir(
        self, client: TestClient, atencion_id: int, headers: dict[str, str], **cambios: object
    ):  # type: ignore[no-untyped-def]
        return client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir?motivo=Se+eligió+mal",
            json={**traslado.ENCABEZADO_VALIDO, **traslado.CLINICO_VALIDO, **cambios},
            headers=headers,
        )

    def test_cambia_la_ambulancia_sin_dejar_rastro_en_el_historial(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        otra = traslado._crear_ambulancia(db, "M-otra")

        r = self._corregir(client, atencion_id, admin_headers, ambulancia_id=otra.id)

        assert r.status_code == 200
        detalle = client.get(f"/atenciones/{atencion_id}", headers=admin_headers).json()
        assert detalle["ambulancia"]["movil"] == "M-otra"
        assert db.query(FormatoVersion).count() == 0

    def test_cambia_conductor_y_responsable(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        conductor = _crear_empleado_con_rol(db, "810000001", "conductor", "Nuevo")
        medico = _crear_empleado_con_rol(db, "810000002", "medico", "Dr")

        r = self._corregir(
            client, atencion_id, admin_headers, conductor_id=conductor.id, responsable_id=medico.id
        )

        assert r.status_code == 200
        detalle = client.get(f"/atenciones/{atencion_id}", headers=admin_headers).json()
        assert detalle["conductor"]["id"] == conductor.id
        assert detalle["responsable"]["id"] == medico.id
        assert db.query(FormatoVersion).count() == 0

    def test_sin_los_campos_no_cambia_nada(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        antes = client.get(f"/atenciones/{atencion_id}", headers=admin_headers).json()

        self._corregir(client, atencion_id, admin_headers)

        despues = client.get(f"/atenciones/{atencion_id}", headers=admin_headers).json()
        assert despues["ambulancia"] == antes["ambulancia"]
        assert despues["conductor"] == antes["conductor"]
        assert despues["responsable"] == antes["responsable"]

    def test_ambulancia_inactiva_da_409(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        baja = traslado._crear_ambulancia(db, "M-baja")
        baja.activa = False
        db.commit()

        assert (
            self._corregir(client, atencion_id, admin_headers, ambulancia_id=baja.id).status_code
            == 409
        )

    def test_ambulancia_inexistente_da_404(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        assert (
            self._corregir(client, atencion_id, admin_headers, ambulancia_id=9999).status_code
            == 404
        )

    def test_quien_no_es_conductor_da_409(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        medico = _crear_empleado_con_rol(db, "810000003", "medico", "Dr")

        assert (
            self._corregir(client, atencion_id, admin_headers, conductor_id=medico.id).status_code
            == 409
        )

    def test_responsable_que_es_conductor_no_es_clinico_da_409(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        conductor = _crear_empleado_con_rol(db, "810000004", "conductor", "Cond")

        r = self._corregir(client, atencion_id, admin_headers, responsable_id=conductor.id)

        assert r.status_code == 409

    def test_conductor_y_responsable_no_pueden_ser_la_misma_persona(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        ambos = _crear_empleado_con_rol(db, "810000005", "conductor", "Mixto")
        _crear_empleado_con_rol(db, "810000005x", "medico", "Otro")
        usuario = db.query(Usuario).filter(Usuario.documento == "810000005").one()
        rol_medico = db.query(Rol).filter(Rol.nombre == "medico").one()
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol_medico.id))
        db.commit()

        r = self._corregir(
            client, atencion_id, admin_headers, conductor_id=ambos.id, responsable_id=ambos.id
        )

        assert r.status_code == 409

    def test_funciona_igual_en_accidente_soat(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = soat._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        otra = soat._crear_ambulancia(db, "M-soatB")

        r = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/corregir?motivo=Mal+elegida",
            json={**soat.ENCABEZADO_VALIDO, **soat.CLINICO_VALIDO, "ambulancia_id": otra.id},
            headers=admin_headers,
        )

        assert r.status_code == 200
        detalle = client.get(f"/atenciones/{atencion_id}", headers=admin_headers).json()
        assert detalle["ambulancia"]["movil"] == "M-soatB"

    def test_el_motivo_sigue_siendo_obligatorio(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        otra = traslado._crear_ambulancia(db, "M-otra2")

        r = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir",
            json={
                **traslado.ENCABEZADO_VALIDO,
                **traslado.CLINICO_VALIDO,
                "ambulancia_id": otra.id,
            },
            headers=admin_headers,
        )

        assert r.status_code == 422


class TestListasParaElAdministrador:
    def test_conductores_disponibles_incluye_al_admin_como_lector(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        _crear_empleado_con_rol(db, "820000001", "conductor", "Pedro")

        r = client.get("/atenciones/conductores-disponibles", headers=admin_headers)

        assert r.status_code == 200
        assert [c["cedula"] for c in r.json()] == ["820000001"]

    def test_responsables_disponibles_son_auxiliares_y_medicos(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        _crear_empleado_con_rol(db, "820000002", "auxiliar_enfermeria", "Ana")
        _crear_empleado_con_rol(db, "820000003", "medico", "Luis")
        _crear_empleado_con_rol(db, "820000004", "conductor", "Pedro")

        r = client.get("/atenciones/responsables-disponibles", headers=admin_headers)

        assert r.status_code == 200
        assert {c["cedula"] for c in r.json()} == {"820000002", "820000003"}

    def test_el_contador_no_las_ve(
        self, client: TestClient, contador_headers: dict[str, str]
    ) -> None:
        assert (
            client.get("/atenciones/responsables-disponibles", headers=contador_headers).status_code
            == 403
        )
        assert (
            client.get("/atenciones/conductores-disponibles", headers=contador_headers).status_code
            == 403
        )