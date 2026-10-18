"""profesional que recibe en el formato de traslado (issue #75)

Revision ID: a7c21f5e9d34
Revises: 9f2e7a1c4b83
Create Date: 2026-10-17 00:00:00.000000

El modelo original del formato de traslado (issue #11, ADR-0009) dejó
explícitamente fuera los datos de quien recibe al paciente en la
IPS/ESE de destino -- personal de la institución, no de LAFS -- igual
que ocurría en el formato de accidente SOAT antes de corregirse. Se
agrega el mismo patrón ya usado ahí: nombre, cédula y firma de quien
recibe, siempre a mano (nunca se autocompleta de ningún perfil, es un
tercero ajeno a la app). El sello físico que la acompaña en el papel
no se captura en la app.

Se aplica igual a `formato_traslado` y a su historial `formato_version`.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c21f5e9d34"
down_revision: str | None = "9f2e7a1c4b83"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_TABLAS = ("formato_traslado", "formato_version")

_COLUMNAS_NUEVAS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("profesional_recibe_nombre", sa.String(length=150)),
    ("profesional_recibe_cedula", sa.String(length=20)),
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
