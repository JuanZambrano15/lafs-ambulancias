"""historial de versiones del formato de traslado (issue #14)
 
Revision ID: 472c53abd65f
Revises: d3b7f0a52c91
Create Date: 2026-10-09 00:00:00.000000
 
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
 
# revision identifiers, used by Alembic.
revision: str = "472c53abd65f"
down_revision: str | None = "d3b7f0a52c91"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
 
def upgrade() -> None:
    # Todos los tipos ENUM de acá ya existen (los creó
    # 44a345a09945/f2c8e4b1a3d7 para formato_traslado) — se referencian con
    # `create_type=False` para no repetir el "CREATE TYPE" y fallar con
    # "type already exists" (mismo criterio que f2c8e4b1a3d7 con
    # reflejo_pupilar). Importante: `create_type` NO es un argumento de
    # `sa.Enum` genérico (ahí se ignora en silencio, sin error, y termina
    # intentando crear el tipo de todas formas) — es específico de
    # `sqlalchemy.dialects.postgresql.ENUM`, por eso se usa ese import
    # acá en vez del genérico `sa.Enum(...)`.
    op.create_table(
        "formato_version",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("atencion_id", sa.Integer(), nullable=False),
        sa.Column("corregido_por_id", sa.Integer(), nullable=False),
        sa.Column("corregido_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "paciente_tipo_documento",
            PGEnum(name="tipo_documento_paciente", create_type=False),
            nullable=True,
        ),
        sa.Column("paciente_numero_documento", sa.String(length=20), nullable=True),
        sa.Column("paciente_eps", sa.String(length=100), nullable=True),
        sa.Column("paciente_nombres", sa.String(length=100), nullable=True),
        sa.Column("paciente_apellidos", sa.String(length=100), nullable=True),
        sa.Column("paciente_edad", sa.Integer(), nullable=True),
        sa.Column(
            "paciente_sexo",
            PGEnum(name="sexo_paciente", create_type=False),
            nullable=True,
        ),
        sa.Column("paciente_direccion_residencial", sa.String(length=255), nullable=True),
        sa.Column("paciente_ciudad", sa.String(length=100), nullable=True),
        sa.Column("paciente_telefono", sa.String(length=20), nullable=True),
        sa.Column("acompanante_nombres_apellidos", sa.String(length=150), nullable=True),
        sa.Column("acompanante_parentesco", sa.String(length=50), nullable=True),
        sa.Column("acompanante_telefono", sa.String(length=20), nullable=True),
        sa.Column("recepcion_fecha", sa.Date(), nullable=True),
        sa.Column("recepcion_hora", sa.Time(), nullable=True),
        sa.Column("recepcion_ciudad", sa.String(length=100), nullable=True),
        sa.Column("recepcion_ips", sa.String(length=150), nullable=True),
        sa.Column("recepcion_servicio", sa.String(length=100), nullable=True),
        sa.Column("entrega_fecha", sa.Date(), nullable=True),
        sa.Column("entrega_hora", sa.Time(), nullable=True),
        sa.Column("entrega_ciudad", sa.String(length=100), nullable=True),
        sa.Column("entrega_ips", sa.String(length=150), nullable=True),
        sa.Column("entrega_servicio", sa.String(length=100), nullable=True),
        sa.Column(
            "complejidad",
            PGEnum(name="complejidad_traslado", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "categoria_paciente",
            PGEnum(name="categoria_paciente", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "nivel_servicio",
            PGEnum(name="nivel_servicio_traslado", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "modalidad",
            PGEnum(name="modalidad_traslado", create_type=False),
            nullable=True,
        ),
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
        sa.Column("insumos_entregados", sa.JSON(), nullable=False),
        sa.Column("atendido_por", sa.String(length=150), nullable=True),
        sa.Column("firma_atendido_por", sa.Text(), nullable=True),
        sa.Column("evolucionado_por", sa.String(length=150), nullable=True),
        sa.Column("firma_evolucionado_por", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["atencion_id"], ["atencion.id"]),
        sa.ForeignKeyConstraint(["corregido_por_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_formato_version_atencion_id"), "formato_version", ["atencion_id"]
    )
 
 
def downgrade() -> None:
    op.drop_index(op.f("ix_formato_version_atencion_id"), table_name="formato_version")
    op.drop_table("formato_version")
 
    # Los tipos ENUM de Postgres de las columnas de arriba son
    # compartidos con formato_traslado (mismo `name=`, creados con
    # `create_type=False`) — no se borran acá, los sigue usando esa
    # tabla; los maneja el downgrade de su propia migración.
