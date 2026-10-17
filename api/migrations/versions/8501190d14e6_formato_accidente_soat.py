"""formato de atención de accidentes SOAT (issue #17)
 
Revision ID: 8501190d14e6
Revises: 472c53abd65f
Create Date: 2026-10-16 00:00:00.000000
 
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
 
# revision identifiers, used by Alembic.
revision: str = "8501190d14e6"
down_revision: str | None = "472c53abd65f"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
# Tipos nuevos de este formato (no existen todavía, a diferencia de
# tipo_documento_paciente/sexo_paciente/reflejo_pupilar, que ya los creó
# formato_traslado y acá solo se reutilizan).
ROL_VICTIMA = sa.Enum(
    "conductor", "pasajero", "parrillero", "peaton", "otro", name="rol_victima"
)
TRIAGE_NIVEL = sa.Enum("i", "ii", "iii", name="triage_nivel")
 
 
def upgrade() -> None:
    # tipo_documento_paciente, sexo_paciente y reflejo_pupilar ya existen
    # (los creó 44a345a09945/f2c8e4b1a3d7 para formato_traslado) — se
    # referencian con `create_type=False` para no repetir el "CREATE TYPE"
    # (mismo criterio que 472c53abd65f con formato_version). rol_victima y
    # triage_nivel sí son nuevos de este formato, se crean normal.
    ROL_VICTIMA.create(op.get_bind(), checkfirst=True)
    TRIAGE_NIVEL.create(op.get_bind(), checkfirst=True)
 
    op.create_table(
        "formato_accidente_soat",
        sa.Column("atencion_id", sa.Integer(), sa.ForeignKey("atencion.id"), primary_key=True),
        # Encabezado
        sa.Column("fecha_atencion", sa.Date(), nullable=False),
        sa.Column("hora_atencion", sa.Time(), nullable=False),
        sa.Column("hora_entrega", sa.Time(), nullable=True),
        sa.Column(
            "identificado", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
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
        sa.Column("lugar_ocurrencia", sa.String(length=255), nullable=False),
        sa.Column("ciudad", sa.String(length=100), nullable=False),
        sa.Column("telefono_contacto", sa.String(length=20), nullable=True),
        sa.Column(
            "rol_victima",
            PGEnum(name="rol_victima", create_type=False),
            nullable=False,
        ),
        sa.Column("poliza_vigente_desde", sa.Date(), nullable=True),
        sa.Column("poliza_vigente_hasta", sa.Date(), nullable=True),
        sa.Column("vehiculo_placa", sa.String(length=10), nullable=False),
        sa.Column("vehiculo_tipo", sa.String(length=50), nullable=False),
        sa.Column("vehiculo_marca", sa.String(length=50), nullable=False),
        sa.Column("numero_poliza", sa.String(length=50), nullable=False),
        # Parte clínica
        sa.Column(
            "tratamiento", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
        ),
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
        sa.Column(
            "signos_vitales", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
        ),
        sa.Column(
            "lesiones", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
        ),
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
    )
 
 
def downgrade() -> None:
    op.drop_table("formato_accidente_soat")
 
    # tipo_documento_paciente/sexo_paciente/reflejo_pupilar son
    # compartidos con formato_traslado (create_type=False) — no se
    # borran acá, los maneja el downgrade de esa migración. rol_victima
    # y triage_nivel sí son propios de este formato.
    TRIAGE_NIVEL.drop(op.get_bind(), checkfirst=True)
    ROL_VICTIMA.drop(op.get_bind(), checkfirst=True)
