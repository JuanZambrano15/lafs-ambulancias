"""observaciones en el formato de traslado (issue #66)
 
Revision ID: b3f7a0e2c6d4
Revises: d4a08f6c3e17
Create Date: 2026-10-19 00:00:00.000000
 
El PDF generado no coincidía con el formato real en papel
(TAP-LAFS-002): entre otras correcciones de orden y contenido, el
papel trae un campo "OBSERVACIONES" en la página 2 (después de la
evolución médica, antes de la tripulación) que nunca se modeló en la
base de datos.
 
Es texto libre, como `nota_auxiliar`/`nota_medica`, así que sigue la
misma decisión de ADR-0012: no se versiona en `formato_version` (ese
historial deja fuera el diagnóstico y las notas por decisión explícita
del cliente, ver el ADR).
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "b3f7a0e2c6d4"
down_revision: str | None = "d4a08f6c3e17"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
 
def upgrade() -> None:
    op.add_column("formato_traslado", sa.Column("observaciones", sa.Text(), nullable=True))
 
 
def downgrade() -> None:
    op.drop_column("formato_traslado", "observaciones")
