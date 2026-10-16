"""historial de versiones del formato de accidente SOAT (issue #17)

Revision ID: 17bb76e4736c
Revises: 8501190d14e6
Create Date: 2026-10-16 00:00:00.000001

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

# revision identifiers, used by Alembic.
revision: str = "17bb76e4736c"
down_revision: str | None = "8501190d14e6"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Todos los tipos ENUM de acá ya existen (los creó 8501190d14e6 para
    # formato_accidente_soat, o 44a345a09945/f2c8e4b1a3d7 para
    # formato_traslado) — se referencian con `create_type=False`, mismo
    # criterio que 472c53abd65f con formato_version.
    op.create_table(
        "formato_accidente_soat_version",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("atencion_id", sa.Integer(), nullable=False),
        sa.Column("corregido_por_id", sa.Integer(), nullable=False),
        sa.Column("corregido_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fecha_atencion", sa.Date(), nullable=True),
        sa.Column("hora_atencion", sa.Time(), nullable=True),
        sa.Column("hora_entrega", sa.Time(), nullable=True),
        sa.Column("identificado", sa.Boolean(), nullable=True),
        sa.Column(
            "paciente_tipo_documento",
            PGEnum(name="tipo_documento_paciente", create_type=False),
            nullable=True,
        ),
        sa.Column("paciente_numero_documento", sa.String(length=20), nullable=True),
        sa.Column("paciente_documento_expedido_en", sa.String(length=100), nullable=True),
        sa.Column("paciente_aseguradora", sa.String(length=100), nullable=True),
        sa.Column("paciente_nombres", sa.String(length=100), nullable=True),
        sa.Column("paciente_apellidos", sa.String(length=100), nullable=True),
        sa.Column("paciente_edad", sa.Integer(), nullable=True),
        sa.Column(
            "paciente_sexo",
            PGEnum(name="sexo_paciente", create_type=False),
            nullable=True,
        ),
        sa.Column("lugar_ocurrencia", sa.String(length=255), nullable=True),
        sa.Column("ciudad", sa.String(length=100), nullable=True),
        sa.Column("telefono_contacto", sa.String(length=20), nullable=True),
        sa.Column(
            "rol_victima",
            PGEnum(name="rol_victima", create_type=False),
            nullable=True,
        ),
        sa.Column("poliza_vigente_desde", sa.Date(), nullable=True),
        sa.Column("poliza_vigente_hasta", sa.Date(), nullable=True),
        sa.Column("vehiculo_placa", sa.String(length=10), nullable=True),
        sa.Column("vehiculo_tipo", sa.String(length=50), nullable=True),
        sa.Column("vehiculo_marca", sa.String(length=50), nullable=True),
        sa.Column("numero_poliza", sa.String(length=50), nullable=True),
        sa.Column("tratamiento", sa.JSON(), nullable=False),
        sa.Column("tratamiento_otro", sa.String(length=255), nullable=True),
        sa.Column(
            "pupila_derecha",
            PGEnum(name="reflejo_pupilar", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "pupila_izquierda",
            PGEnum(name="reflejo_pupilar", create_type=False),
            nullable=True,
        ),
        sa.Column("signos_vitales", sa.JSON(), nullable=False),
        sa.Column("lesiones", sa.JSON(), nullable=False),
        sa.Column("lesion_otro", sa.String(length=255), nullable=True),
        sa.Column("glasgow_ocular", sa.Integer(), nullable=True),
        sa.Column("glasgow_verbal", sa.Integer(), nullable=True),
        sa.Column("glasgow_motora", sa.Integer(), nullable=True),
        sa.Column(
            "triage",
            PGEnum(name="triage_nivel", create_type=False),
            nullable=True,
        ),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("profesional_recibe_nombre", sa.String(length=150), nullable=True),
        sa.Column("profesional_recibe_cedula", sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(["atencion_id"], ["atencion.id"]),
        sa.ForeignKeyConstraint(["corregido_por_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_formato_accidente_soat_version_atencion_id"),
        "formato_accidente_soat_version",
        ["atencion_id"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_formato_accidente_soat_version_atencion_id"),
        table_name="formato_accidente_soat_version",
    )
    op.drop_table("formato_accidente_soat_version")

    # Los tipos ENUM de las columnas de arriba son compartidos
    # (create_type=False) — no se borran acá, los maneja el downgrade de
    # su propia migración (8501190d14e6 para rol_victima/triage_nivel,
    # 44a345a09945/f2c8e4b1a3d7 para los de formato_traslado).
