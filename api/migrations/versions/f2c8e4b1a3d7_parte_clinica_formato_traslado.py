"""parte clínica del formato de traslado (issue #9)
 
Revision ID: f2c8e4b1a3d7
Revises: 44a345a09945
Create Date: 2026-10-05 00:00:00.000000
 
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "f2c8e4b1a3d7"
down_revision: str | None = "44a345a09945"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
REFLEJO_PUPILAR = sa.Enum(
    "midriatica",
    "miotica",
    "isocorica",
    "anisocorica",
    "no_reactiva",
    name="reflejo_pupilar",
)
 
 
def upgrade() -> None:
    # El tipo se crea una sola vez porque `pupila_derecha` y
    # `pupila_izquierda` lo comparten — si cada `add_column` intentara
    # crearlo de nuevo, el segundo fallaría con "type already exists".
    REFLEJO_PUPILAR.create(op.get_bind(), checkfirst=True)
 
    op.add_column("formato_traslado", sa.Column("diagnostico", sa.Text(), nullable=True))
 
    op.add_column(
        "formato_traslado",
        sa.Column("tratamiento", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column(
        "formato_traslado", sa.Column("tratamiento_otro", sa.String(length=255), nullable=True)
    )
 
    op.add_column(
        "formato_traslado",
        sa.Column(
            "pupila_derecha", sa.Enum(name="reflejo_pupilar", create_type=False), nullable=True
        ),
    )
    op.add_column(
        "formato_traslado",
        sa.Column(
            "pupila_izquierda", sa.Enum(name="reflejo_pupilar", create_type=False), nullable=True
        ),
    )
 
    op.add_column(
        "formato_traslado",
        sa.Column(
            "signos_vitales", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
        ),
    )
 
    op.add_column(
        "formato_traslado",
        sa.Column("lesiones", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column(
        "formato_traslado", sa.Column("lesion_otro", sa.String(length=255), nullable=True)
    )
 
    op.add_column("formato_traslado", sa.Column("glasgow_ocular", sa.Integer(), nullable=True))
    op.add_column("formato_traslado", sa.Column("glasgow_verbal", sa.Integer(), nullable=True))
    op.add_column("formato_traslado", sa.Column("glasgow_motora", sa.Integer(), nullable=True))
 
    op.add_column(
        "formato_traslado",
        sa.Column(
            "insumos_entregados", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")
        ),
    )
 
    op.add_column("formato_traslado", sa.Column("nota_auxiliar", sa.Text(), nullable=True))
    op.add_column(
        "formato_traslado", sa.Column("atendido_por", sa.String(length=150), nullable=True)
    )
    op.add_column("formato_traslado", sa.Column("nota_medica", sa.Text(), nullable=True))
    op.add_column(
        "formato_traslado", sa.Column("evolucionado_por", sa.String(length=150), nullable=True)
    )
 
 
def downgrade() -> None:
    op.drop_column("formato_traslado", "evolucionado_por")
    op.drop_column("formato_traslado", "nota_medica")
    op.drop_column("formato_traslado", "atendido_por")
    op.drop_column("formato_traslado", "nota_auxiliar")
    op.drop_column("formato_traslado", "insumos_entregados")
    op.drop_column("formato_traslado", "glasgow_motora")
    op.drop_column("formato_traslado", "glasgow_verbal")
    op.drop_column("formato_traslado", "glasgow_ocular")
    op.drop_column("formato_traslado", "lesion_otro")
    op.drop_column("formato_traslado", "lesiones")
    op.drop_column("formato_traslado", "signos_vitales")
    op.drop_column("formato_traslado", "pupila_izquierda")
    op.drop_column("formato_traslado", "pupila_derecha")
    op.drop_column("formato_traslado", "tratamiento_otro")
    op.drop_column("formato_traslado", "tratamiento")
    op.drop_column("formato_traslado", "diagnostico")
 
    REFLEJO_PUPILAR.drop(op.get_bind(), checkfirst=True)
