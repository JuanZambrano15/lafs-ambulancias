"""motivo obligatorio al corregir un formato ya cerrado (issue #80)

Revision ID: a1f6c9e3b8d2
Revises: c7a39e52f104
Create Date: 2026-10-25 00:00:00.000000

El #14 (ADR-0012) había decidido a propósito NO guardar un motivo en
texto libre -- "con el documento alcanza para identificar quién fue"
(ver el comentario que sigue, ahora corregido, en
`app/models/formato_version.py`). El #80 cambia esa decisión: el
panel web va a tener un botón "Corregir formato" de verdad (antes
este flujo solo existía a nivel de API, sin ninguna pantalla), y el
cliente quiere saber POR QUÉ se corrigió un formato ya firmado y
cerrado, no solo quién y cuándo.

`NOT NULL` sin valor por defecto a propósito: a diferencia del resto
de las columnas de estas dos tablas (que son un snapshot de un
formato que, al guardarse originalmente, sí podía tener campos
vacíos), `motivo` no es parte del formato que se está versionando --
es metadata de la corrección en sí, igual que `corregido_por_id`/
`corregido_en` (que tampoco son nullable). No hay filas existentes
que migrar: ninguna pantalla permitió corregir un formato cerrado
antes de este issue, así que no hay riesgo de romper datos reales.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1f6c9e3b8d2"
down_revision: str | None = "c7a39e52f104"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("formato_version", sa.Column("motivo", sa.Text(), nullable=False))
    op.add_column(
        "formato_accidente_soat_version", sa.Column("motivo", sa.Text(), nullable=False)
    )


def downgrade() -> None:
    op.drop_column("formato_accidente_soat_version", "motivo")
    op.drop_column("formato_version", "motivo")

