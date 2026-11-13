"""catálogo de insumos por móvil y chequeo de insumos (issue #20)

Revision ID: d5f9b3a7e2c8
Revises: c4e8a2f6d1b7
Create Date: 2026-11-13 00:00:00.000000

Dos tablas nuevas: `insumo_catalogo` (ítems y mínimo por ambulancia) y
`chequeo_insumos` (un chequeo por fila, con los ítems en JSON). No toca
ninguna tabla existente.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5f9b3a7e2c8"
down_revision: str | None = "c4e8a2f6d1b7"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "insumo_catalogo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ambulancia_id", sa.Integer(), nullable=False),
        sa.Column("categoria", sa.String(length=60), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("minimo", sa.Integer(), nullable=False),
        sa.Column("unidad", sa.String(length=30), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["ambulancia_id"], ["ambulancia.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ambulancia_id", "nombre", name="uq_insumo_ambulancia_nombre"),
    )
    op.create_index(op.f("ix_insumo_catalogo_ambulancia_id"), "insumo_catalogo", ["ambulancia_id"])

    op.create_table(
        "chequeo_insumos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ambulancia_id", sa.Integer(), nullable=False),
        sa.Column("auxiliar_id", sa.Integer(), nullable=False),
        sa.Column("realizado_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("tiene_faltantes", sa.Boolean(), nullable=False),
        sa.Column("total_faltantes", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["ambulancia_id"], ["ambulancia.id"]),
        sa.ForeignKeyConstraint(["auxiliar_id"], ["empleado.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chequeo_insumos_ambulancia_id"), "chequeo_insumos", ["ambulancia_id"])
    op.create_index(op.f("ix_chequeo_insumos_realizado_en"), "chequeo_insumos", ["realizado_en"])


def downgrade() -> None:
    op.drop_index(op.f("ix_chequeo_insumos_realizado_en"), table_name="chequeo_insumos")
    op.drop_index(op.f("ix_chequeo_insumos_ambulancia_id"), table_name="chequeo_insumos")
    op.drop_table("chequeo_insumos")
    op.drop_index(op.f("ix_insumo_catalogo_ambulancia_id"), table_name="insumo_catalogo")
    op.drop_table("insumo_catalogo")
