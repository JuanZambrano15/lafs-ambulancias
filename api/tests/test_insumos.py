"""Catálogo de insumos por móvil y chequeo de insumos (issue #20)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.catalogo_insumos_inicial import PLANTILLAS_INSUMOS
from app.core.chequeo_insumos import FRECUENCIA_CHEQUEO_DIAS, es_faltante
from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.chequeo_insumos import ChequeoInsumos
from app.models.empleado import Empleado
from app.models.insumo_catalogo import InsumoCatalogo
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _ambulancia(db: Session, movil: str = "M-01", activa: bool = True) -> Ambulancia:
    a = Ambulancia(
        movil=movil,
        placa=f"{movil}PLACA"[:10],
        tipo=TipoAmbulancia.basica,
        vencimiento_soat=datetime.now(UTC).date() + timedelta(days=200),
        vencimiento_tecnomecanica=datetime.now(UTC).date() + timedelta(days=200),
        activa=activa,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def _catalogo(db: Session, ambulancia: Ambulancia) -> list[InsumoCatalogo]:
    filas = [
        InsumoCatalogo(
            ambulancia_id=ambulancia.id,
            categoria="Respiratorio",
            nombre="Ambu adulto",
            minimo=1,
            orden=1,
        ),
        InsumoCatalogo(
            ambulancia_id=ambulancia.id,
            categoria="Circulatorio",
            nombre="Jeringa de 5cc",
            minimo=10,
            orden=2,
        ),
        InsumoCatalogo(
            ambulancia_id=ambulancia.id,
            categoria="Medicamentos",
            nombre="Adrenalina",
            minimo=5,
            unidad="amp",
            orden=3,
        ),
    ]
    db.add_all(filas)
    db.commit()
    for f in filas:
        db.refresh(f)
    return filas


def _cuerpo(
    ambulancia_id: int, items: list[InsumoCatalogo], encontrados: list[int]
) -> dict[str, object]:
    return {
        "ambulancia_id": ambulancia_id,
        "items": [
            {"insumo_id": i.id, "encontrado": n} for i, n in zip(items, encontrados, strict=True)
        ],
    }


def test_es_faltante_compara_contra_el_minimo() -> None:
    assert es_faltante(4, 5) is True
    assert es_faltante(5, 5) is False
    assert es_faltante(9, 5) is False
    assert es_faltante(0, 0) is False


def test_la_frecuencia_es_la_misma_del_chequeo_de_vehiculo() -> None:
    assert FRECUENCIA_CHEQUEO_DIAS == 7


def test_las_plantillas_no_repiten_nombres_dentro_de_un_movil() -> None:
    assert set(PLANTILLAS_INSUMOS) == {"M01", "M02", "IVECO"}
    for _, filas in PLANTILLAS_INSUMOS.values():
        nombres = [n.lower() for _, n, _, _ in filas]
        assert len(nombres) == len(set(nombres))
        assert all(minimo >= 0 for _, _, minimo, _ in filas)


class TestCatalogo:
    def test_el_admin_agrega_un_item_al_final(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        _catalogo(db, a)

        r = client.post(
            "/insumos",
            json={
                "ambulancia_id": a.id,
                "categoria": " Trauma ",
                "nombre": "  Collar  cervical ",
                "minimo": 2,
            },
            headers=admin_headers,
        )

        assert r.status_code == 201
        assert r.json()["categoria"] == "Trauma"
        assert r.json()["nombre"] == "Collar cervical"
        assert r.json()["orden"] == 4

    def test_no_se_repite_el_nombre_en_el_mismo_movil(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        _catalogo(db, a)

        r = client.post(
            "/insumos",
            json={
                "ambulancia_id": a.id,
                "categoria": "Respiratorio",
                "nombre": "ambu ADULTO",
                "minimo": 1,
            },
            headers=admin_headers,
        )

        assert r.status_code == 409

    def test_el_mismo_nombre_si_sirve_en_otro_movil(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        b = _ambulancia(db, "M-02")
        _catalogo(db, a)

        r = client.post(
            "/insumos",
            json={
                "ambulancia_id": b.id,
                "categoria": "Respiratorio",
                "nombre": "Ambu adulto",
                "minimo": 1,
            },
            headers=admin_headers,
        )

        assert r.status_code == 201

    def test_minimo_negativo_da_422(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        r = client.post(
            "/insumos",
            json={"ambulancia_id": a.id, "categoria": "X", "nombre": "Y", "minimo": -1},
            headers=admin_headers,
        )

        assert r.status_code == 422

    def test_el_admin_cambia_el_minimo(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        r = client.patch(
            f"/insumos/{items[0].id}", json={"minimo": 3, "unidad": " "}, headers=admin_headers
        )

        assert r.status_code == 200
        assert r.json()["minimo"] == 3
        assert r.json()["unidad"] is None

    def test_renombrar_a_un_nombre_repetido_da_409(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        r = client.patch(
            f"/insumos/{items[0].id}", json={"nombre": "Adrenalina"}, headers=admin_headers
        )

        assert r.status_code == 409

    def test_el_admin_elimina_un_item(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        r = client.delete(f"/insumos/{items[0].id}", headers=admin_headers)

        assert r.status_code == 204
        assert db.query(InsumoCatalogo).count() == 2

    def test_el_auxiliar_lee_el_catalogo_pero_no_lo_edita(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        lista = client.get(f"/insumos?ambulancia_id={a.id}", headers=auxiliar_headers)
        edicion = client.patch(
            f"/insumos/{items[0].id}", json={"minimo": 9}, headers=auxiliar_headers
        )

        assert lista.status_code == 200
        assert [i["nombre"] for i in lista.json()] == [
            "Ambu adulto",
            "Jeringa de 5cc",
            "Adrenalina",
        ]
        assert edicion.status_code == 403

    def test_el_conductor_no_ve_el_catalogo(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        assert (
            client.get(f"/insumos?ambulancia_id={a.id}", headers=conductor_headers).status_code
            == 403
        )

    def test_ambulancia_inexistente_da_404(
        self, client: TestClient, admin_headers: dict[str, str]
    ) -> None:
        assert client.get("/insumos?ambulancia_id=999", headers=admin_headers).status_code == 404


class TestPlantillas:
    def test_lista_las_tres_plantillas(
        self, client: TestClient, admin_headers: dict[str, str]
    ) -> None:
        r = client.get("/insumos/plantillas", headers=admin_headers)

        assert r.status_code == 200
        assert {p["clave"] for p in r.json()} == {"M01", "M02", "IVECO"}
        assert all(p["total"] > 90 for p in r.json())

    def test_carga_la_plantilla_en_un_movil_vacio(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        r = client.post(
            "/insumos/plantilla",
            json={"ambulancia_id": a.id, "plantilla": "M02"},
            headers=admin_headers,
        )

        assert r.status_code == 201
        assert len(r.json()) == len(PLANTILLAS_INSUMOS["M02"][1])
        assert db.query(InsumoCatalogo).filter_by(nombre="Fentanilo").one().minimo == 5

    def test_no_pisa_un_catalogo_que_ya_tiene_items(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        _catalogo(db, a)

        r = client.post(
            "/insumos/plantilla",
            json={"ambulancia_id": a.id, "plantilla": "M01"},
            headers=admin_headers,
        )

        assert r.status_code == 409
        assert db.query(InsumoCatalogo).count() == 3

    def test_plantilla_desconocida_da_404(
        self, client: TestClient, db: Session, admin_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        r = client.post(
            "/insumos/plantilla",
            json={"ambulancia_id": a.id, "plantilla": "M09"},
            headers=admin_headers,
        )

        assert r.status_code == 404


class TestFormulario:
    def test_el_auxiliar_obtiene_lo_que_debe_contar(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        _catalogo(db, a)

        r = client.get(
            f"/chequeos-insumos/formulario?ambulancia_id={a.id}", headers=auxiliar_headers
        )

        assert r.status_code == 200
        assert r.json()["frecuencia_dias"] == 7
        assert len(r.json()["items"]) == 3

    def test_el_conductor_no(
        self, client: TestClient, db: Session, conductor_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        r = client.get(
            f"/chequeos-insumos/formulario?ambulancia_id={a.id}", headers=conductor_headers
        )

        assert r.status_code == 403


class TestCrearChequeo:
    def test_compara_lo_encontrado_contra_el_minimo(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        r = client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items, [1, 7, 5]), headers=auxiliar_headers
        )

        assert r.status_code == 201
        cuerpo = r.json()
        assert cuerpo["movil"] == "M-01"
        assert cuerpo["auxiliar_nombre"] == "Ana Ruiz"
        assert cuerpo["tiene_faltantes"] is True
        assert cuerpo["total_faltantes"] == 1
        por_nombre = {i["nombre"]: i for i in cuerpo["items"]}
        assert por_nombre["Jeringa de 5cc"]["faltante"] is True
        assert por_nombre["Jeringa de 5cc"]["minimo"] == 10
        assert por_nombre["Jeringa de 5cc"]["encontrado"] == 7
        assert por_nombre["Ambu adulto"]["faltante"] is False
        assert por_nombre["Adrenalina"]["faltante"] is False

    def test_todo_completo_no_tiene_faltantes(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        r = client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items, [1, 12, 5]), headers=auxiliar_headers
        )

        assert r.status_code == 201
        assert r.json()["tiene_faltantes"] is False
        assert r.json()["total_faltantes"] == 0
        assert db.query(ChequeoInsumos).one().tiene_faltantes is False

    def test_el_historial_no_cambia_si_se_edita_el_catalogo(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)
        creado = client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items, [1, 7, 5]), headers=auxiliar_headers
        ).json()

        client.patch(
            f"/insumos/{items[1].id}",
            json={"minimo": 2, "nombre": "Otra cosa"},
            headers=admin_headers,
        )
        client.delete(f"/insumos/{items[0].id}", headers=admin_headers)

        detalle = client.get(f"/chequeos-insumos/{creado['id']}", headers=admin_headers).json()
        assert [i["nombre"] for i in detalle["items"]] == [
            "Ambu adulto",
            "Jeringa de 5cc",
            "Adrenalina",
        ]
        assert detalle["items"][1]["minimo"] == 10
        assert detalle["total_faltantes"] == 1

    def test_faltan_items_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        r = client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items[:2], [1, 10]), headers=auxiliar_headers
        )

        assert r.status_code == 422

    def test_un_item_repetido_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)
        cuerpo = _cuerpo(a.id, items, [1, 10, 5])
        cuerpo["items"] = [*cuerpo["items"], cuerpo["items"][0]]  # type: ignore[index, operator]

        assert (
            client.post("/chequeos-insumos", json=cuerpo, headers=auxiliar_headers).status_code
            == 422
        )

    def test_un_item_de_otro_movil_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        b = _ambulancia(db, "M-02")
        items_a = _catalogo(db, a)
        _catalogo(db, b)

        r = client.post(
            "/chequeos-insumos", json=_cuerpo(b.id, items_a, [1, 10, 5]), headers=auxiliar_headers
        )

        assert r.status_code == 422

    def test_cantidad_negativa_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)

        r = client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items, [1, -2, 5]), headers=auxiliar_headers
        )

        assert r.status_code == 422

    def test_sin_catalogo_da_409(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)

        r = client.post(
            "/chequeos-insumos", json={"ambulancia_id": a.id, "items": []}, headers=auxiliar_headers
        )

        assert r.status_code == 409

    def test_ambulancia_inactiva_da_409(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db, activa=False)
        items = _catalogo(db, a)

        r = client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items, [1, 10, 5]), headers=auxiliar_headers
        )

        assert r.status_code == 409

    def test_usuario_sin_empleado_da_409(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)
        empleado = db.query(Empleado).filter_by(cedula="700000001").one()
        empleado.activo = False
        db.commit()

        r = client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items, [1, 10, 5]), headers=auxiliar_headers
        )

        assert r.status_code == 409

    def test_solo_el_auxiliar_lo_hace(
        self,
        client: TestClient,
        db: Session,
        conductor_headers: dict[str, str],
        medico_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        a = _ambulancia(db)
        items = _catalogo(db, a)
        cuerpo = _cuerpo(a.id, items, [1, 10, 5])

        for cabeceras in (conductor_headers, medico_headers, admin_headers):
            assert (
                client.post("/chequeos-insumos", json=cuerpo, headers=cabeceras).status_code == 403
            )


class TestConsultas:
    def _chequeo(self, client: TestClient, db: Session, headers: dict[str, str]) -> int:
        a = _ambulancia(db)
        items = _catalogo(db, a)
        return int(
            client.post(
                "/chequeos-insumos", json=_cuerpo(a.id, items, [0, 10, 5]), headers=headers
            ).json()["id"]
        )

    def test_estado_por_movil_antes_y_despues_del_chequeo(
        self,
        client: TestClient,
        db: Session,
        admin_headers: dict[str, str],
        auxiliar_headers: dict[str, str],
    ) -> None:
        a = _ambulancia(db)
        _ambulancia(db, "M-02")
        _ambulancia(db, "M-03", activa=False)
        items = _catalogo(db, a)

        antes = client.get("/chequeos-insumos/moviles", headers=admin_headers).json()
        client.post(
            "/chequeos-insumos", json=_cuerpo(a.id, items, [0, 10, 5]), headers=auxiliar_headers
        )
        despues = client.get("/chequeos-insumos/moviles", headers=admin_headers).json()

        assert [m["movil"] for m in antes] == ["M-01", "M-02"]
        assert antes[0]["total_items"] == 3
        assert antes[0]["ultimo_chequeo"] is None
        assert antes[0]["chequeo_al_dia"] is False
        assert antes[1]["total_items"] == 0
        assert despues[0]["chequeo_al_dia"] is True
        assert despues[0]["dias_desde_chequeo"] == 0
        assert despues[0]["ultimo_chequeo"]["total_faltantes"] == 1
        assert despues[1]["chequeo_al_dia"] is False

    def test_un_chequeo_de_hace_una_semana_ya_no_esta_al_dia(
        self,
        client: TestClient,
        db: Session,
        admin_headers: dict[str, str],
        auxiliar_headers: dict[str, str],
    ) -> None:
        chequeo_id = self._chequeo(client, db, auxiliar_headers)
        chequeo = db.get(ChequeoInsumos, chequeo_id)
        assert chequeo is not None
        chequeo.realizado_en = datetime.now(UTC) - timedelta(days=FRECUENCIA_CHEQUEO_DIAS)
        db.commit()

        estado = client.get("/chequeos-insumos/moviles", headers=admin_headers).json()[0]

        assert estado["dias_desde_chequeo"] == FRECUENCIA_CHEQUEO_DIAS
        assert estado["chequeo_al_dia"] is False

    def test_el_admin_ve_el_historial_y_el_detalle(
        self,
        client: TestClient,
        db: Session,
        admin_headers: dict[str, str],
        auxiliar_headers: dict[str, str],
    ) -> None:
        chequeo_id = self._chequeo(client, db, auxiliar_headers)

        lista = client.get("/chequeos-insumos", headers=admin_headers)
        detalle = client.get(f"/chequeos-insumos/{chequeo_id}", headers=admin_headers)

        assert [c["id"] for c in lista.json()] == [chequeo_id]
        assert lista.json()[0]["total_faltantes"] == 1
        assert detalle.status_code == 200
        assert len(detalle.json()["items"]) == 3

    def test_filtra_el_historial_por_movil(
        self,
        client: TestClient,
        db: Session,
        admin_headers: dict[str, str],
        auxiliar_headers: dict[str, str],
    ) -> None:
        self._chequeo(client, db, auxiliar_headers)

        assert client.get("/chequeos-insumos?ambulancia_id=999", headers=admin_headers).json() == []

    def test_detalle_inexistente_da_404(
        self, client: TestClient, admin_headers: dict[str, str]
    ) -> None:
        assert client.get("/chequeos-insumos/999", headers=admin_headers).status_code == 404

    def test_contador_y_conductor_no_ven_el_historial(
        self,
        client: TestClient,
        contador_headers: dict[str, str],
        conductor_headers: dict[str, str],
    ) -> None:
        for cabeceras in (contador_headers, conductor_headers):
            assert client.get("/chequeos-insumos", headers=cabeceras).status_code == 403
            assert client.get("/chequeos-insumos/moviles", headers=cabeceras).status_code == 403