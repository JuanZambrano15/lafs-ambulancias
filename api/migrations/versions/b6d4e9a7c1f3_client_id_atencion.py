"""client_id en atencion, para sincronización offline (issue #10)
 
Revision ID: b6d4e9a7c1f3
Revises: f2c8e4b1a3d7
Create Date: 2026-10-07 00:00:00.000000
 
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "b6d4e9a7c1f3"
down_revision: str | None = "f2c8e4b1a3d7"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
 
def upgrade() -> None:
    # Nullable: solo lo llenan las atenciones creadas sin conexión (ver
    # ADR-0008) — una atención creada en línea normalmente no manda
    # `client_id`. Único para que el backend pueda detectar un
    # reintento de sincronización por su valor (NULL no cuenta como
    # duplicado, ni en Postgres ni en SQLite).
    op.add_column("atencion", sa.Column("client_id", sa.String(length=36), nullable=True))
    op.create_unique_constraint("uq_atencion_client_id", "atencion", ["client_id"])
 
 
def downgrade() -> None:
    op.drop_constraint("uq_atencion_client_id", "atencion", type_="unique")
    op.drop_column("atencion", "client_id")
