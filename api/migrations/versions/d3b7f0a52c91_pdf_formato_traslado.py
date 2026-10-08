"""pdf generado del formato de traslado (issue #13)
 
Revision ID: d3b7f0a52c91
Revises: c8f3a1d6e9b2
Create Date: 2026-10-07 00:00:00.000000
 
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "d3b7f0a52c91"
down_revision: str | None = "c8f3a1d6e9b2"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
 
def upgrade() -> None:
    # Bytes del PDF renderizado (ver ADR-0011) — nullable: nada de
    # esto existe hasta que se guarda el encabezado por primera vez.
    op.add_column("formato_traslado", sa.Column("pdf_generado", sa.LargeBinary(), nullable=True))
    op.add_column(
        "formato_traslado",
        sa.Column("pdf_generado_en", sa.DateTime(timezone=True), nullable=True),
    )
 
 
def downgrade() -> None:
    op.drop_column("formato_traslado", "pdf_generado_en")
    op.drop_column("formato_traslado", "pdf_generado")
