"""profesional que entrega en el formato de traslado (correcciones fase 1)

Revision ID: b3d5e7f9a1c4
Revises: a1f6c9e3b8d2
Create Date: 2026-11-10 00:00:00.000000

El PDF del formato de traslado mostraba como "profesional que entrega"
(fin de la página 1) a quien atendió dentro de la ambulancia -- el
auxiliar o el médico de LAFS -- porque se había entendido que "entrega"
era el papel de la tripulación. En el papel, "entrega" es el
profesional de la IPS/ESE de ORIGEN que remite al paciente (el que lo
entrega a LAFS), igual que "recibe" es el profesional de la IPS/ESE de
destino.

Se agrega el mismo patrón ya usado para quien recibe (issue #75):
nombre, cédula y firma, siempre capturados a mano o como foto (nunca
se autocompletan de ningún perfil, es un tercero ajeno a la app).

Se aplica igual a `formato_traslado` y a su historial `formato_version`.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3d5e7f9a1c4"
down_revision: str | None = "a1f6c9e3b8d2"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_TABLAS = ("formato_traslado", "formato_version")

_COLUMNAS_NUEVAS: tuple[tuple[str, sa.types.TypeEngine], ...] = (
    ("profesional_entrega_nombre", sa.String(length=150)),
    ("profesional_entrega_cedula", sa.String(length=20)),
    ("firma_profesional_entrega", sa.Text()),
)


def upgrade() -> None:
    for tabla in _TABLAS:
        for nombre, tipo in _COLUMNAS_NUEVAS:
            op.add_column(tabla, sa.Column(nombre, tipo, nullable=True))


def downgrade() -> None:
    for tabla in _TABLAS:
        for nombre, _tipo in _COLUMNAS_NUEVAS:
            op.drop_column(tabla, nombre)
