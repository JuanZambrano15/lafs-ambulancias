"""entrega_* del formato de traslado pasan a nullable (issue #55)

Revision ID: 21dff62fa4b6
Revises: b3f7a0e2c6d4
Create Date: 2026-10-22 00:00:00.000000

El encabezado se llenaba todo de una sola vez al iniciar el traslado,
incluyendo "entrega del paciente" -- pero a esa hora todavía no se
sabe, porque el traslado apenas empieza (issue #55). Se parte el flujo
en 3 pasos (recepción al iniciar / estado durante el traslado /
entrega al cerrar, ver ADR-0014), reusando el mismo PUT de encabezado
que ya existía (mismo patrón que `hora_entrega` en el formato SOAT,
issue #70) -- así que las 5 columnas de entrega (fecha, hora, ciudad,
ips, servicio) dejan de ser obligatorias: un traslado recién recibido
todavía no tiene nada de esto.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "21dff62fa4b6"
down_revision: str | None = "b3f7a0e2c6d4"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_COLUMNAS = (
    ("entrega_fecha", sa.Date()),
    ("entrega_hora", sa.Time()),
    ("entrega_ciudad", sa.String(100)),
    ("entrega_ips", sa.String(150)),
    ("entrega_servicio", sa.String(100)),
)


def upgrade() -> None:
    for nombre, tipo in _COLUMNAS:
        op.alter_column("formato_traslado", nombre, existing_type=tipo, nullable=True)


def downgrade() -> None:
    # No hay forma segura de volver a NOT NULL sin saber qué poner en
    # las filas que a esta altura ya existan con estos campos en blanco
    # (traslados abiertos que todavía no llegaron a "entrega") -- se
    # deja documentado en vez de intentar un valor por defecto inventado.
    for nombre, tipo in _COLUMNAS:
        op.alter_column("formato_traslado", nombre, existing_type=tipo, nullable=False)
