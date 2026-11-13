"""Chequeo semanal del vehículo (issue #19) y semáforo de vigencias."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.core.chequeo_vehiculo import (
    FRECUENCIA_CHEQUEO_DIAS,
    ITEMS_CHEQUEO_VEHICULO,
    hoy_colombia,
    semaforo_vencimiento,
)
from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.chequeo_vehiculo import ChequeoVehiculo
from app.models.empleado import Empleado
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _ambulancia(
    db: Session,
    movil: str = "M-01",
    soat_en_dias: int = 200,
    tecno_en_dias: int = 200,
    activa: bool = True,
) -> Ambulancia:
    hoy = hoy_colombia()
    a = Ambulancia(
        movil=movil,
        placa=f"{movil}PLACA"[:10],
        tipo=TipoAmbulancia.basica,
        vencimiento_soat=hoy + timedelta(days=soat_en_dias),
        vencimiento_tecnomecanica=hoy + timedelta(days=tecno_en_dias),
        activa=activa,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _items_bien() -> list[dict[str, object]]:
    return [{"item": n, "estado": "bien"} for n in ITEMS_CHEQUEO_VEHICULO]


def _cuerpo(ambulancia_id: int, items: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {"ambulancia_id": ambulancia_id, "items": items if items is not None else _items_bien()}


class TestSemaforo:
    HOY = date(2026, 11, 12)

    def test_mas_de_30_dias_es_verde(self) -> None:
        assert semaforo_vencimiento(self.HOY + timedelta(days=31), self.HOY) == "verde"

    def test_entre_16_y_30_dias_es_amarillo(self) -> None:
        assert semaforo_vencimiento(self.HOY + timedelta(days=30), self.HOY) == "amarillo"
        assert semaforo_vencimiento(self.HOY + timedelta(days=16), self.HOY) == "amarillo"

    def test_15_dias_o_menos_es_rojo(self) -> None:
        assert semaforo_vencimiento(self.HOY + timedelta(days=15), self.HOY) == "rojo"
        assert semaforo_vencimiento(self.HOY, self.HOY) == "rojo"

    def test_vencido_es_rojo(self) -> None:
        assert semaforo_vencimiento(self.HOY - timedelta(days=3), self.HOY) == "rojo"


def test_el_catalogo_tiene_los_37_items_sin_repetir() -> None:
    assert len(ITEMS_CHEQUEO_VEHICULO) == 37
    assert len(set(ITEMS_CHEQUEO_VEHICULO)) == 37


class TestCatalogo:
    def test_el_conductor_lo_obtiene(
        self, client: TestClient, conductor_headers: dict[str, str]
    ) -> None:
        r = client.get("/chequeos-vehiculo/catalogo", headers=conductor_headers)

        assert r.status_code == 200
        assert r.json()["frecuencia_dias"] == FRECUENCIA_CHEQUEO_DIAS == 7
        assert r.json()["items"] == list(ITEMS_CHEQUEO_VEHICULO)

    def test_un_auxiliar_no(self, client: TestClient, auxiliar_headers: dict[str, str]) -> None:
        r = client.get("/chequeos-vehiculo/catalogo", headers=auxiliar_headers)

        assert r.status_code == 403


class TestCrear:
    def test_el_conductor_guarda_un_chequeo_completo(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        r = client.post("/chequeos-vehiculo", json=_cuerpo(a.id), headers=conductor_headers)

        assert r.status_code == 201
        cuerpo = r.json()
        assert cuerpo["movil"] == "M-01"
        assert cuerpo["conductor_nombre"] == "Pedro Londoño"
        assert cuerpo["tiene_fallas"] is False
        assert cuerpo["total_fallas"] == 0
        assert len(cuerpo["items"]) == 37

    def test_una_falla_se_marca_y_se_cuenta(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _items_bien()
        items[0] = {"item": items[0]["item"], "estado": "falla", "observacion": "Rasgada"}

        r = client.post("/chequeos-vehiculo", json=_cuerpo(a.id, items), headers=conductor_headers)

        assert r.status_code == 201
        assert r.json()["tiene_fallas"] is True
        assert r.json()["total_fallas"] == 1
        assert db.query(ChequeoVehiculo).one().tiene_fallas is True

    def test_una_falla_sin_descripcion_da_422(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _items_bien()
        items[3] = {"item": items[3]["item"], "estado": "falla"}

        r = client.post("/chequeos-vehiculo", json=_cuerpo(a.id, items), headers=conductor_headers)

        assert r.status_code == 422

    def test_faltan_items_da_422(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        r = client.post(
            "/chequeos-vehiculo", json=_cuerpo(a.id, _items_bien()[:-1]), headers=conductor_headers
        )

        assert r.status_code == 422

    def test_un_item_inventado_da_422(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _items_bien()
        items[0] = {"item": "Algo que no existe", "estado": "bien"}

        r = client.post("/chequeos-vehiculo", json=_cuerpo(a.id, items), headers=conductor_headers)

        assert r.status_code == 422

    def test_un_item_repetido_da_422(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _items_bien()
        items[1] = dict(items[0])

        r = client.post("/chequeos-vehiculo", json=_cuerpo(a.id, items), headers=conductor_headers)

        assert r.status_code == 422

    def test_ambulancia_inexistente_da_404(
        self, client: TestClient, conductor_headers: dict[str, str]
    ) -> None:
        r = client.post("/chequeos-vehiculo", json=_cuerpo(9999), headers=conductor_headers)

        assert r.status_code == 404

    def test_ambulancia_inactiva_da_409(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db, activa=False)

        r = client.post("/chequeos-vehiculo", json=_cuerpo(a.id), headers=conductor_headers)

        assert r.status_code == 409

    def test_otros_roles_no_pueden_crearlo(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        a = _ambulancia(db)

        for headers in (auxiliar_headers, admin_headers):
            r = client.post("/chequeos-vehiculo", json=_cuerpo(a.id), headers=headers)
            assert r.status_code == 403

    def test_sin_sesion_da_401(self, client: TestClient, db: Session) -> None:
        a = _ambulancia(db)

        assert client.post("/chequeos-vehiculo", json=_cuerpo(a.id)).status_code == 401


class TestFlota:
    def test_muestra_semaforo_de_soat_y_tecnomecanica(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        _ambulancia(db, "M-01", soat_en_dias=200, tecno_en_dias=20)
        _ambulancia(db, "M-02", soat_en_dias=-5, tecno_en_dias=10)

        r = client.get("/chequeos-vehiculo/flota", headers=conductor_headers)

        assert r.status_code == 200
        m1, m2 = r.json()
        assert (m1["movil"], m1["semaforo_soat"], m1["semaforo_tecnomecanica"]) == (
            "M-01", "verde", "amarillo",
        )
        assert m1["dias_tecnomecanica"] == 20
        assert (m2["semaforo_soat"], m2["dias_soat"], m2["semaforo_tecnomecanica"]) == (
            "rojo", -5, "rojo",
        )

    def test_no_incluye_las_inactivas(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        _ambulancia(db, "M-01")
        _ambulancia(db, "M-02", activa=False)

        r = client.get("/chequeos-vehiculo/flota", headers=conductor_headers)

        assert [a["movil"] for a in r.json()] == ["M-01"]

    def test_sin_chequeo_no_esta_al_dia(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        _ambulancia(db)

        fila = client.get("/chequeos-vehiculo/flota", headers=conductor_headers).json()[0]

        assert fila["ultimo_chequeo"] is None
        assert fila["dias_desde_chequeo"] is None
        assert fila["chequeo_al_dia"] is False

    def test_chequeo_de_hoy_deja_el_movil_al_dia(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        client.post("/chequeos-vehiculo", json=_cuerpo(a.id), headers=conductor_headers)

        fila = client.get("/chequeos-vehiculo/flota", headers=conductor_headers).json()[0]

        assert fila["chequeo_al_dia"] is True
        assert fila["dias_desde_chequeo"] == 0
        assert fila["ultimo_chequeo"]["conductor_nombre"] == "Pedro Londoño"

    def test_un_chequeo_de_hace_una_semana_ya_no_esta_al_dia(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        conductor = db.query(Empleado).one()
        limite = FRECUENCIA_CHEQUEO_DIAS
        for dias, esperado in ((limite - 1, True), (limite, False)):
            db.query(ChequeoVehiculo).delete()
            db.add(
                ChequeoVehiculo(
                    ambulancia_id=a.id,
                    conductor_id=conductor.id,
                    realizado_en=datetime.now(UTC) - timedelta(days=dias, minutes=1),
                    items=[],
                    tiene_fallas=False,
                )
            )
            db.commit()

            fila = client.get("/chequeos-vehiculo/flota", headers=conductor_headers).json()[0]

            assert fila["chequeo_al_dia"] is esperado, dias

    def test_el_admin_y_el_contador_la_ven_y_el_auxiliar_no(
        self,
        client: TestClient,
        db: Session,
        admin_headers: dict[str, str],
        contador_headers: dict[str, str],
        auxiliar_headers: dict[str, str],
    ) -> None:
        _ambulancia(db)

        assert client.get("/chequeos-vehiculo/flota", headers=admin_headers).status_code == 200
        assert client.get("/chequeos-vehiculo/flota", headers=contador_headers).status_code == 200
        assert client.get("/chequeos-vehiculo/flota", headers=auxiliar_headers).status_code == 403


class TestHistorial:
    def test_lista_y_detalle_para_admin(
        self,
        client: TestClient,
        db: Session,
        conductor_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        a = _ambulancia(db)
        b = _ambulancia(db, "M-02")
        creado = client.post("/chequeos-vehiculo", json=_cuerpo(a.id), headers=conductor_headers)
        client.post("/chequeos-vehiculo", json=_cuerpo(b.id), headers=conductor_headers)

        todos = client.get("/chequeos-vehiculo", headers=admin_headers).json()
        solo_a = client.get(
            f"/chequeos-vehiculo?ambulancia_id={a.id}", headers=admin_headers
        ).json()
        detalle = client.get(f"/chequeos-vehiculo/{creado.json()['id']}", headers=admin_headers)

        assert len(todos) == 2
        assert [c["movil"] for c in solo_a] == ["M-01"]
        assert detalle.status_code == 200
        assert len(detalle.json()["items"]) == 37

    def test_chequeo_inexistente_da_404(
        self, client: TestClient, admin_headers: dict[str, str]
    ) -> None:
        assert client.get("/chequeos-vehiculo/999", headers=admin_headers).status_code == 404

    def test_el_conductor_no_ve_el_historial(
        self, client: TestClient, conductor_headers: dict[str, str]
    ) -> None:
        assert client.get("/chequeos-vehiculo", headers=conductor_headers).status_code == 403