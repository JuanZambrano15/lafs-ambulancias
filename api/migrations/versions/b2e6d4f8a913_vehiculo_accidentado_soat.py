"""placa, tipo y marca del vehículo accidentado en el formato SOAT (issue #89)

Revision ID: b2e6d4f8a913
Revises: f5a8c2e71b4d
Create Date: 2026-10-24 00:00:00.000000

Estas tres columnas (`vehiculo_placa`, `vehiculo_tipo`, `vehiculo_marca`)
ya habían existido en el modelado original del issue #17, pero se
quitaron en el #70 (migración `6c038653dc18`) porque en ese momento se
creyó que no correspondían al papel real (AA-LAFS-005). El PDF del
issue #71 -- que sí replica el papel fielmente -- mostró que esa fila
sí existe en el formato; el cliente confirmó que la necesita (issue
#89), así que se vuelven a agregar.

Igual que `numero_poliza` (ver migración `6c038653dc18` y el
comentario en `formato_accidente_soat.py`), quedan opcionales: el dato
del vehículo a veces no se conoce al momento de la atención y se
completa después, corregible por el administrador como cualquier otro
campo tras el cierre -- no hay razón para bloquear el cierre de la
atención por esto.

Se aplican a `formato_accidente_soat` y a su historial
`formato_accidente_soat_version`, mismo patrón que el resto de
columnas versionadas de ese formato.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2e6d4f8a913"
down_revision: str | None = "f5a8c2e71b4d"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_TABLAS = ("formato_accidente_soat", "formato_accidente_soat_version")


def upgrade() -> None:
    for tabla in _TABLAS:
        op.add_column(tabla, sa.Column("vehiculo_placa", sa.String(length=10), nullable=True))
        op.add_column(tabla, sa.Column("vehiculo_tipo", sa.String(length=50), nullable=True))
        op.add_column(tabla, sa.Column("vehiculo_marca", sa.String(length=50), nullable=True))


def downgrade() -> None:
    for tabla in _TABLAS:
        op.drop_column(tabla, "vehiculo_marca")
        op.drop_column(tabla, "vehiculo_tipo")
        op.drop_column(tabla, "vehiculo_placa")

