"""Columna EPS en los listados de servicios cerrados (administrador) y en el
detalle de viajes del reporte (contador).

Reusa los helpers y datos de `test_formato_version.py` (traslado) y
`test_formato_accidente_soat_version.py` (accidente SOAT).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.models.usuario import Usuario
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests import test_formato_accidente_soat_version as soat
from tests import test_formato_version as traslado


class TestEps:
    def test_servicios_cerrados_trae_la_eps_del_traslado_y_la_aseguradora_del_soat(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        admin_headers: dict[str, str],
    ) -> None:
        traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        # Otra atención SOAT con otra ambulancia/conductor del propio helper.
        soat._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)

        r = client.get("/atenciones/cerradas", headers=admin_headers)

        assert r.status_code == 200
        por_tipo = {fila["tipo"]: fila["paciente_eps"] for fila in r.json()}
        assert por_tipo["traslado"] == "Nueva EPS"
        assert por_tipo["atencion_soat"] == "SOAT Seguros XYZ"

    def test_el_detalle_del_contador_trae_la_eps(
        self,
        client: TestClient,
        db: Session,
        auxiliar_headers: dict[str, str],
        contador_headers: dict[str, str],
    ) -> None:
        atencion_id = traslado._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        soat_id = soat._crear_atencion_cerrada_con_formato(client, db, auxiliar_headers)
        hoy = datetime.now(UTC).date()
        desde, hasta = (hoy - timedelta(days=1)).isoformat(), (hoy + timedelta(days=1)).isoformat()
        auxiliar = db.query(Usuario).filter(Usuario.documento == "700000001").one()

        r = client.get(
            "/reportes/servicios-por-persona/detalle",
            params={
                "empleado_id": auxiliar.empleado_id,
                "funcion": "responsable",
                "desde": desde,
                "hasta": hasta,
            },
            headers=contador_headers,
        )

        assert r.status_code == 200
        eps = {fila["atencion_id"]: fila["eps"] for fila in r.json()}
        assert eps == {atencion_id: "Nueva EPS", soat_id: "SOAT Seguros XYZ"}