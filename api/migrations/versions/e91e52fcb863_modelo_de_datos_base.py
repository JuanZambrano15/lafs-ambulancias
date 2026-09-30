"""modelo de datos base (rol, usuario, usuario_rol, empleado, ambulancia, atencion)

Revision ID: e91e52fcb863
Revises:
Create Date: 2026-09-30 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e91e52fcb863"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rol",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=True),
        sa.UniqueConstraint("nombre"),
    )
    op.create_index("ix_rol_nombre", "rol", ["nombre"])

    op.create_table(
        "empleado",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombres", sa.String(length=100), nullable=False),
        sa.Column("apellidos", sa.String(length=100), nullable=False),
        sa.Column("cedula", sa.String(length=20), nullable=False),
        sa.Column("telefono", sa.String(length=20), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("cedula"),
    )
    op.create_index("ix_empleado_cedula", "empleado", ["cedula"])

    op.create_table(
        "ambulancia",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("movil", sa.String(length=20), nullable=False),
        sa.Column("placa", sa.String(length=10), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum("basica", "medicalizada", name="tipo_ambulancia"),
            nullable=False,
        ),
        sa.Column("vencimiento_soat", sa.Date(), nullable=False),
        sa.Column("vencimiento_tecnomecanica", sa.Date(), nullable=False),
        sa.Column("activa", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("movil"),
        sa.UniqueConstraint("placa"),
    )
    op.create_index("ix_ambulancia_movil", "ambulancia", ["movil"])
    op.create_index("ix_ambulancia_placa", "ambulancia", ["placa"])

    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("documento", sa.String(length=20), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("pin_hash", sa.String(length=255), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("empleado_id", sa.Integer(), sa.ForeignKey("empleado.id"), nullable=True),
        sa.UniqueConstraint("documento"),
    )
    op.create_index("ix_usuario_documento", "usuario", ["documento"])

    op.create_table(
        "usuario_rol",
        sa.Column(
            "usuario_id",
            sa.Integer(),
            sa.ForeignKey("usuario.id"),
            primary_key=True,
        ),
        sa.Column("rol_id", sa.Integer(), sa.ForeignKey("rol.id"), primary_key=True),
    )

    op.create_table(
        "atencion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ambulancia_id", sa.Integer(), sa.ForeignKey("ambulancia.id"), nullable=False),
        sa.Column("conductor_id", sa.Integer(), sa.ForeignKey("empleado.id"), nullable=False),
        sa.Column("responsable_id", sa.Integer(), sa.ForeignKey("empleado.id"), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum("traslado", "atencion_soat", name="tipo_atencion"),
            nullable=False,
        ),
        sa.Column(
            "estado",
            sa.Enum("abierto", "cerrado", name="estado_atencion"),
            nullable=False,
            server_default="abierto",
        ),
        sa.Column("abierta_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cerrada_en", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("atencion")
    op.drop_table("usuario_rol")
    op.drop_table("usuario")
    op.drop_table("ambulancia")
    op.drop_table("empleado")
    op.drop_table("rol")
    sa.Enum(name="tipo_atencion").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="estado_atencion").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="tipo_ambulancia").drop(op.get_bind(), checkfirst=True)
