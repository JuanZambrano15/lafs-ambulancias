"""firma del auxiliar y médico en el formato de accidente SOAT (fix sobre #17)
 
Revision ID: 9f2e7a1c4b83
Revises: 6c038653dc18
Create Date: 2026-10-17 00:00:00.000000
 
Segunda corrección sobre el modelado original del issue #17, encontrada
al revisar las pantallas del issue #70 contra el papel real
(AA-LAFS-005): el formato también pide la identificación y firma del
auxiliar que atiende ("atendido por"/firma, igual que en el formato de
traslado) y, opcionalmente, de un médico que haya participado
("evolucionado por"/firma) — ninguno de los dos se modeló en #17.
 
`profesional_recibe_nombre`/`profesional_recibe_cedula` (issue #17)
seguían vigentes -- se confirmó que la IPS/ESE que recibe sí firma y
sella en el papel -- así que no se tocan, solo se les agrega la
columna de firma que les faltaba (`firma_profesional_recibe`): el
sello físico no se captura en la app, igual que la firma del
conductor, que queda para el PDF de un issue aparte.
 
Se aplica igual a `formato_accidente_soat` y a su historial
`formato_accidente_soat_version`.
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "9f2e7a1c4b83"
down_revision: str | None = "6c038653dc18"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
_TABLAS = ("formato_accidente_soat", "formato_accidente_soat_version")
 
_COLUMNAS_NUEVAS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("atendido_por", sa.String(length=150)),
    ("firma_atendido_por", sa.Text()),
    ("evolucionado_por", sa.String(length=150)),
    ("firma_evolucionado_por", sa.Text()),
    ("firma_profesional_recibe", sa.Text()),
)
 
 
def upgrade() -> None:
    for tabla in _TABLAS:
        for nombre, tipo in _COLUMNAS_NUEVAS:
            op.add_column(tabla, sa.Column(nombre, tipo, nullable=True))
 
 
def downgrade() -> None:
    for tabla in _TABLAS:
        for nombre, _tipo in _COLUMNAS_NUEVAS:
            op.drop_column(tabla, nombre)
