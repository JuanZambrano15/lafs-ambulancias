"""Edad del paciente por fecha de nacimiento en los formatos de traslado y de
accidente SOAT: se calcula en años cumplidos a la fecha del servicio y la fecha
no se guarda.

Reusa los helpers y datos de `test_formato_version.py` (traslado) y
`test_formato_accidente_soat_version.py` (accidente SOAT).
"""

from __future__ import annotations

from datetime import date

import pytest
from app.core.edad import calcular_edad
from app.models.formato_accidente_soat import FormatoAccidenteSoat
from app.models.formato_traslado import FormatoTraslado
from app.models.formato_version import FormatoVersion
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests import test_formato_accidente_soat_version as soat
from tests import test_formato_version as traslado


class TestCalcularEdad:
    def test_antes_del_cumpleanos(self) -> None:
        assert calcular_edad(date(1990, 5, 20), date(2027, 1, 1)) == 36

    def test_despues_del_cumpleanos(self) -> None:
        assert calcular_edad(date(1990, 5, 20), date(2027, 6, 1)) == 37

    def test_el_dia_del_cumpleanos_ya_los_cumplio(self) -> None:
        assert calcular_edad(date(1990, 5, 20), date(2027, 5, 20)) == 37

    def test_nacido_un_29_de_febrero(self) -> None:
        assert calcular_edad(date(2000, 2, 29), date(2027, 2, 28)) == 26
        assert calcular_edad(date(2000, 2, 29), date(2027, 3, 1)) == 27

    def test_bebe_de_meses_tiene_cero_anos(self) -> None:
        assert calcular_edad(date(2026, 9, 1), date(2027, 1, 1)) == 0

    def test_fecha_futura_es_un_error(self) -> None:
        with pytest.raises(ValueError):
            calcular_edad(date(2027, 1, 2), date(2027, 1, 1))


def _sin_edad(base: dict[str, object], **extra: object) -> dict[str, object]:
    cuerpo = {k: v for k, v in base.items() if k != "paciente_edad"}
    cuerpo.update(extra)
    return cuerpo


class TestEdadEnTraslado:
    def test_la_edad_sale_de_la_fecha_de_nacimiento(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = traslado._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=_sin_edad(traslado.ENCABEZADO_VALIDO, paciente_fecha_nacimiento="1990-05-20"),
            headers=auxiliar_headers,
        )

        assert r.status_code == 200
        assert r.json()["paciente_edad"] == 36  # a la recepción, 2027-01-01
        assert "paciente_fecha_nacimiento" not in r.json()
        assert db.get(FormatoTraslado, atencion_id).paciente_edad == 36  # type: ignore[union-attr]

    def test_la_fecha_de_nacimiento_no_se_guarda(self) -> None:
        assert not hasattr(FormatoTraslado, "paciente_fecha_nacimiento")
        assert not hasattr(FormatoAccidenteSoat, "paciente_fecha_nacimiento")
        assert not hasattr(FormatoVersion, "paciente_fecha_nacimiento")

    def test_sigue_valiendo_escribir_la_edad(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = traslado._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=traslado.ENCABEZADO_VALIDO,
            headers=auxiliar_headers,
        )

        assert r.status_code == 200
        assert r.json()["paciente_edad"] == 45

    def test_sin_edad_ni_fecha_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = traslado._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=_sin_edad(traslado.ENCABEZADO_VALIDO),
            headers=auxiliar_headers,
        )

        assert r.status_code == 422
        assert "edad o la fecha de nacimiento" in r.text

    def test_fecha_posterior_al_servicio_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = traslado._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json=_sin_edad(traslado.ENCABEZADO_VALIDO, paciente_fecha_nacimiento="2028-01-01"),
            headers=auxiliar_headers,
        )

        assert r.status_code == 422

    def test_si_vienen_las_dos_manda_la_fecha(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = traslado._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-traslado",
            json={**traslado.ENCABEZADO_VALIDO, "paciente_fecha_nacimiento": "1990-05-20"},
            headers=auxiliar_headers,
        )

        assert r.json()["paciente_edad"] == 36

    def test_el_administrador_corrige_con_fecha_de_nacimiento(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-traslado/corregir?motivo=Se+leyó+del+documento",
            json=_sin_edad(
                {**traslado.ENCABEZADO_VALIDO, **traslado.CLINICO_VALIDO},
                paciente_fecha_nacimiento="1980-01-02",
            ),
            headers=admin_headers,
        )

        assert r.status_code == 200
        assert r.json()["paciente_edad"] == 46
        # La edad cambió (45 → 46): es rastreable y deja su fila.
        version = db.query(FormatoVersion).one()
        assert version.paciente_edad == 45


class TestEdadEnAccidenteSoat:
    def test_la_edad_sale_de_la_fecha_de_nacimiento(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = soat._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=_sin_edad(soat.ENCABEZADO_VALIDO, paciente_fecha_nacimiento="1990-05-20"),
            headers=auxiliar_headers,
        )

        assert r.status_code == 200
        assert r.json()["paciente_edad"] == 36  # a la atención, 2027-01-01
        assert "paciente_fecha_nacimiento" not in r.json()

    def test_un_nn_puede_ir_sin_edad_ni_fecha(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = soat._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=soat.ENCABEZADO_NN,
            headers=auxiliar_headers,
        )

        assert r.status_code == 200
        assert r.json()["paciente_edad"] is None

    def test_fecha_posterior_a_la_atencion_da_422(
        self, client: TestClient, db: Session, auxiliar_headers: dict[str, str]
    ) -> None:
        atencion_id = soat._crear_atencion(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat",
            json=_sin_edad(soat.ENCABEZADO_VALIDO, paciente_fecha_nacimiento="2028-01-01"),
            headers=auxiliar_headers,
        )

        assert r.status_code == 422

    def test_el_administrador_corrige_con_fecha_de_nacimiento(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        atencion_id = soat._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        r = client.put(
            f"/atenciones/{atencion_id}/formato-accidente-soat/corregir?motivo=Documento",
            json=_sin_edad(
                {**soat.ENCABEZADO_VALIDO, **soat.CLINICO_VALIDO},
                paciente_fecha_nacimiento="1980-01-02",
            ),
            headers=admin_headers,
        )

        assert r.status_code == 200
        assert r.json()["paciente_edad"] == 46