"""firma guardada (empleado) y firma en formato de traslado (issue #11)
 
Revision ID: c8f3a1d6e9b2
Revises: b6d4e9a7c1f3
Create Date: 2026-10-07 00:00:00.000000
 
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "c8f3a1d6e9b2"
down_revision: str | None = "b6d4e9a7c1f3"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
 
def upgrade() -> None:
    # Data URL en base64 de la firma dibujada en pantalla (ver
    # ADR-0009) — Text en los tres casos, nullable: nada de esto
    # existe hasta que alguien firma por primera vez.
    op.add_column("empleado", sa.Column("firma_guardada", sa.Text(), nullable=True))
    op.add_column("formato_traslado", sa.Column("firma_atendido_por", sa.Text(), nullable=True))
    op.add_column("formato_traslado", sa.Column("firma_evolucionado_por", sa.Text(), nullable=True))
 
 
def downgrade() -> None:
    op.drop_column("formato_traslado", "firma_evolucionado_por")
    op.drop_column("formato_traslado", "firma_atendido_por")
    op.drop_column("empleado", "firma_guardada")
