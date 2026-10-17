"""corregir campos del formato de accidente SOAT (fix sobre #17)
 
Revision ID: 6c038653dc18
Revises: 17bb76e4736c
Create Date: 2026-10-16 00:00:00.000000
 
Corrección sobre el modelado original del issue #17, encontrada al
construir las pantallas del issue #70 y revisar contra el papel real
(AA-LAFS-005): `vehiculo_placa`, `vehiculo_tipo`, `vehiculo_marca` y
`paciente_documento_expedido_en` no están en ese formato -- se
inventaron por error al modelar #17, así que se eliminan (no solo se
dejan de usar: no hay motivo para arrastrar columnas muertas).
`numero_poliza` sí está en el papel, pero el dato del paciente a veces
se completa días después de la atención, así que pasa a ser opcional
-- corregible por el administrador como cualquier otro campo, mismo
mecanismo que ya tiene cualquier corrección post-cierre.
 
Se aplica igual a `formato_accidente_soat` y a su historial
`formato_accidente_soat_version` (que no tenía `numero_poliza`
obligatorio porque ahí todas las columnas ya eran nullable).
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "6c038653dc18"
down_revision: str | None = "17bb76e4736c"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
_COLUMNAS_ELIMINADAS = (
    "vehiculo_placa",
    "vehiculo_tipo",
    "vehiculo_marca",
    "paciente_documento_expedido_en",
)
 
 
def upgrade() -> None:
    for columna in _COLUMNAS_ELIMINADAS:
        op.drop_column("formato_accidente_soat", columna)
        op.drop_column("formato_accidente_soat_version", columna)
    op.alter_column(
        "formato_accidente_soat",
        "numero_poliza",
        existing_type=sa.String(length=50),
        nullable=True,
    )
 
 
def downgrade() -> None:
    # Downgrade de mejor esfuerzo: los datos que hubiera en las
    # columnas eliminadas no se pueden recuperar. Se recrean nullable
    # (no como `vehiculo_placa`/etc. originales, que eran NOT NULL) --
    # forzar NOT NULL de nuevo sin datos reales rompería cualquier fila
    # ya existente.
    op.alter_column(
        "formato_accidente_soat",
        "numero_poliza",
        existing_type=sa.String(length=50),
        nullable=False,
    )
    for columna, tipo in (
        ("vehiculo_placa", sa.String(length=10)),
        ("vehiculo_tipo", sa.String(length=50)),
        ("vehiculo_marca", sa.String(length=50)),
        ("paciente_documento_expedido_en", sa.String(length=100)),
    ):
        op.add_column("formato_accidente_soat", sa.Column(columna, tipo, nullable=True))
        op.add_column("formato_accidente_soat_version", sa.Column(columna, tipo, nullable=True))
