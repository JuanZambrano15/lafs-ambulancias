"""notas de enfermería/médico y pdf generado del formato SOAT (issue #71)

Revision ID: f5a8c2e71b4d
Revises: 21dff62fa4b6
Create Date: 2026-10-23 00:00:00.000000

El PDF descargable del formato de accidente SOAT (AA-LAFS-005) agrega
una segunda página -- no existente en el papel físico -- con "Notas de
enfermería" y "Notas del médico" por separado (a pedido explícito del
cliente, ver nota de módulo en `formato_accidente_soat.py`), mismo
criterio que `nota_auxiliar`/`nota_medica` ya tiene `formato_traslado`.
Se aplican a `formato_accidente_soat` y a su historial
`formato_accidente_soat_version` (mismo patrón que la migración
`9f2e7a1c4b83`, que agregó las firmas de ese mismo formato).

`pdf_generado`/`pdf_generado_en` solo van en la tabla principal -- no
se versionan, igual que en `formato_traslado` (ver migración
`d3b7f0a52c91` y el comentario en `formato_version.py`).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f5a8c2e71b4d"
down_revision: str | None = "21dff62fa4b6"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_TABLAS_NOTAS = ("formato_accidente_soat", "formato_accidente_soat_version")


def upgrade() -> None:
    for tabla in _TABLAS_NOTAS:
        op.add_column(tabla, sa.Column("nota_auxiliar", sa.Text(), nullable=True))
        op.add_column(tabla, sa.Column("nota_medica", sa.Text(), nullable=True))

    # Bytes del PDF renderizado (ver ADR-0011) — nullable: nada de esto
    # existe hasta que se guarda el encabezado por primera vez. Solo en
    # la tabla principal, no en el historial de versiones.
    op.add_column(
        "formato_accidente_soat", sa.Column("pdf_generado", sa.LargeBinary(), nullable=True)
    )
    op.add_column(
        "formato_accidente_soat",
        sa.Column("pdf_generado_en", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("formato_accidente_soat", "pdf_generado_en")
    op.drop_column("formato_accidente_soat", "pdf_generado")

    for tabla in _TABLAS_NOTAS:
        op.drop_column(tabla, "nota_medica")
        op.drop_column(tabla, "nota_auxiliar")
