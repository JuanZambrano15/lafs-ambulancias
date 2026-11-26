"""Reactivar una ambulancia dada de baja y eliminar de verdad una que
nunca se usó (gestión de ambulancias desde el panel)."""

from __future__ import annotations

from datetime import date

from app.models.ambulancia import Ambulancia, TipoAmbulancia
from app.models.insumo_catalogo import InsumoCatalogo
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests import test_formato_version as traslado


def _ambulancia(db: Session, movil: str = "M-09") -> Ambulancia:
    a = Ambulancia(
        movil=movil,
        placa=f"{movil}X"[:10],
        tipo=TipoAmbulancia.basica,
        vencimiento_soat=date(2027, 1, 1),
        vencimiento_tecnomecanica=date(2027, 1, 1),
        activa=True,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def test_el_admin_reactiva_una_ambulancia_dada_de_baja(
    client: TestClient, db: Session, admin_headers: dict[str, str]
) -> None:
    a = _ambulancia(db)
    client.delete(f"/ambulancias/{a.id}", headers=admin_headers)

    r = client.patch(f"/ambulancias/{a.id}", json={"activa": True}, headers=admin_headers)

    assert r.status_code == 200
    assert r.json()["activa"] is True


def test_el_admin_cambia_movil_placa_y_tipo(
    client: TestClient, db: Session, admin_headers: dict[str, str]
) -> None:
    a = _ambulancia(db)

    r = client.patch(
        f"/ambulancias/{a.id}",
        json={"movil": "M-10", "placa": "NEW123", "tipo": "medicalizada"},
        headers=admin_headers,
    )

    assert r.status_code == 200
    assert (r.json()["movil"], r.json()["placa"], r.json()["tipo"]) == (
        "M-10",
        "NEW123",
        "medicalizada",
    )


def test_elimina_de_verdad_una_ambulancia_sin_historial_y_su_catalogo(
    client: TestClient, db: Session, admin_headers: dict[str, str]
) -> None:
    a = _ambulancia(db)
    db.add(InsumoCatalogo(ambulancia_id=a.id, categoria="X", nombre="Y", minimo=1, orden=1))
    db.commit()

    r = client.delete(f"/ambulancias/{a.id}/definitivo", headers=admin_headers)

    assert r.status_code == 204
    assert db.query(Ambulancia).filter(Ambulancia.id == a.id).count() == 0
    assert db.query(InsumoCatalogo).count() == 0


def test_no_elimina_una_ambulancia_con_atenciones(
    client: TestClient,
    db: Session,
    auxiliar_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    atencion_id = traslado._crear_atencion(client, db, auxiliar_headers)
    ambulancia_id = client.get("/atenciones/en-curso", headers=auxiliar_headers).json()[0][
        "ambulancia"
    ]["id"]
    assert atencion_id

    r = client.delete(f"/ambulancias/{ambulancia_id}/definitivo", headers=admin_headers)

    assert r.status_code == 409
    assert db.get(Ambulancia, ambulancia_id) is not None


def test_solo_el_admin_elimina(
    client: TestClient, db: Session, contador_headers: dict[str, str]
) -> None:
    a = _ambulancia(db)

    assert (
        client.delete(f"/ambulancias/{a.id}/definitivo", headers=contador_headers).status_code
        == 403
    )


def test_eliminar_una_inexistente_da_404(client: TestClient, admin_headers: dict[str, str]) -> None:
    assert client.delete("/ambulancias/9999/definitivo", headers=admin_headers).status_code == 404