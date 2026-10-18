"""diagrama corporal: lesiones localizadas (issue #54)

Revision ID: d4a08f6c3e17
Revises: a7c21f5e9d34
Create Date: 2026-10-18 00:00:00.000000

El checklist `lesiones` (sólo el TIPO de lesión) y el texto libre
`lesion_otro` ya existían, pero el diagrama corporal del papel
(adelante/atrás, para marcar DÓNDE) había quedado explícitamente
fuera de esa entrega. Se reemplazan ambas columnas por
`lesiones_localizadas`: una lista JSON de objetos
{tipo, tipo_otro, zona, lado, vista} -- ver `LesionLocalizadaItem`
en `app/schemas/formato_traslado.py`. Cada lesión ahora lleva su
propio "otro" (si aplica) en vez de uno solo compartido por formato.

Se aplica a las 4 tablas que tenían `lesiones`/`lesion_otro`:
`formato_traslado`, `formato_version`, `formato_accidente_soat` y
`formato_accidente_soat_version`.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4a08f6c3e17"
down_revision: str | None = "a7c21f5e9d34"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_TABLAS = (
    "formato_traslado",
    "formato_version",
    "formato_accidente_soat",
    "formato_accidente_soat_version",
)


def upgrade() -> None:
    for tabla in _TABLAS:
        op.add_column(
            tabla,
            sa.Column(
                "lesiones_localizadas",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'::json"),
            ),
        )
        op.drop_column(tabla, "lesion_otro")
        op.drop_column(tabla, "lesiones")


def downgrade() -> None:
    for tabla in _TABLAS:
        op.add_column(
            tabla,
            sa.Column(
                "lesiones", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
            ),
        )
        op.add_column(tabla, sa.Column("lesion_otro", sa.String(length=255), nullable=True))
        op.drop_column(tabla, "lesiones_localizadas")
