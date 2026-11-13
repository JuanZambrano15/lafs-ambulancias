"""chequeo semanal del vehículo (issue #19)

Revision ID: c4e8a2f6d1b7
Revises: b3d5e7f9a1c4
Create Date: 2026-11-12 00:00:00.000000

Tabla nueva `chequeo_vehiculo`: un chequeo por fila, con los ítems en
JSON. No toca ninguna tabla existente.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4e8a2f6d1b7"
down_revision: str | None = "b3d5e7f9a1c4"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chequeo_vehiculo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ambulancia_id", sa.Integer(), nullable=False),
        sa.Column("conductor_id", sa.Integer(), nullable=False),
        sa.Column("realizado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("tiene_fallas", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["ambulancia_id"], ["ambulancia.id"]),
        sa.ForeignKeyConstraint(["conductor_id"], ["empleado.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_chequeo_vehiculo_ambulancia_id"), "chequeo_vehiculo", ["ambulancia_id"]
    )
    op.create_index(
        op.f("ix_chequeo_vehiculo_realizado_en"), "chequeo_vehiculo", ["realizado_en"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_chequeo_vehiculo_realizado_en"), table_name="chequeo_vehiculo")
    op.drop_index(op.f("ix_chequeo_vehiculo_ambulancia_id"), table_name="chequeo_vehiculo")
    op.drop_table("chequeo_vehiculo")
