"""encabezado del formato de traslado (issue #8)
 
Revision ID: 44a345a09945
Revises: a4c8f1d9b2e6
Create Date: 2026-10-04 00:00:00.000000
 
"""
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "44a345a09945"
down_revision: str | None = "a4c8f1d9b2e6"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
 
def upgrade() -> None:
    op.create_table(
        "formato_traslado",
        sa.Column("atencion_id", sa.Integer(), sa.ForeignKey("atencion.id"), primary_key=True),
        # Datos del paciente
        sa.Column(
            "paciente_tipo_documento",
            sa.Enum("rc", "ti", "cc", "ce", "ppt", name="tipo_documento_paciente"),
            nullable=False,
        ),
        sa.Column("paciente_numero_documento", sa.String(length=20), nullable=False),
        sa.Column("paciente_eps", sa.String(length=100), nullable=False),
        sa.Column("paciente_nombres", sa.String(length=100), nullable=False),
        sa.Column("paciente_apellidos", sa.String(length=100), nullable=False),
        sa.Column("paciente_edad", sa.Integer(), nullable=False),
        sa.Column("paciente_sexo", sa.Enum("m", "f", name="sexo_paciente"), nullable=False),
        sa.Column("paciente_direccion_residencial", sa.String(length=255), nullable=False),
        sa.Column("paciente_ciudad", sa.String(length=100), nullable=False),
        sa.Column("paciente_telefono", sa.String(length=20), nullable=True),
        # Datos del acompañante
        sa.Column("acompanante_nombres_apellidos", sa.String(length=150), nullable=True),
        sa.Column("acompanante_parentesco", sa.String(length=50), nullable=True),
        sa.Column("acompanante_telefono", sa.String(length=20), nullable=True),
        # Recepción del paciente (origen)
        sa.Column("recepcion_fecha", sa.Date(), nullable=False),
        sa.Column("recepcion_hora", sa.Time(), nullable=False),
        sa.Column("recepcion_ciudad", sa.String(length=100), nullable=False),
        sa.Column("recepcion_ips", sa.String(length=150), nullable=False),
        sa.Column("recepcion_servicio", sa.String(length=100), nullable=False),
        # Entrega del paciente (destino)
        sa.Column("entrega_fecha", sa.Date(), nullable=False),
        sa.Column("entrega_hora", sa.Time(), nullable=False),
        sa.Column("entrega_ciudad", sa.String(length=100), nullable=False),
        sa.Column("entrega_ips", sa.String(length=150), nullable=False),
        sa.Column("entrega_servicio", sa.String(length=100), nullable=False),
        # Clasificación del traslado
        sa.Column(
            "complejidad", sa.Enum("alta", "baja", name="complejidad_traslado"), nullable=False
        ),
        sa.Column(
            "categoria_paciente",
            sa.Enum("neonato", "pediatrico", "adulto", name="categoria_paciente"),
            nullable=False,
        ),
        sa.Column(
            "nivel_servicio",
            sa.Enum("basico", "medicalizado", name="nivel_servicio_traslado"),
            nullable=False,
        ),
        sa.Column(
            "modalidad",
            sa.Enum("sencillo", "redondo", name="modalidad_traslado"),
            nullable=False,
        ),
    )
 
 
def downgrade() -> None:
    op.drop_table("formato_traslado")
    sa.Enum(name="tipo_documento_paciente").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="sexo_paciente").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="complejidad_traslado").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="categoria_paciente").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="nivel_servicio_traslado").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="modalidad_traslado").drop(op.get_bind(), checkfirst=True)
