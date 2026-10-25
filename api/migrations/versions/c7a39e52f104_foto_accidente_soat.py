"""fotos del accidente SOAT, adjuntadas después del cierre (issue #18)
 
Revision ID: c7a39e52f104
Revises: b2e6d4f8a913
Create Date: 2026-10-24 00:00:00.000000
 
Tabla nueva, no una columna más de `formato_accidente_soat` -- a
diferencia del resto del formato (uno-a-uno con la atención), acá
puede haber cualquier cantidad de fotos por atención, o ninguna. Sin
historial de versiones (ver nota de módulo en
`app/models/formato_accidente_soat_foto.py`): agregar o borrar una
foto no es una corrección de un campo, es la lista cambiando.
"""
 
from __future__ import annotations
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
 
# revision identifiers, used by Alembic.
revision: str = "c7a39e52f104"
down_revision: str | None = "b2e6d4f8a913"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
 
def upgrade() -> None:
    op.create_table(
        "formato_accidente_soat_foto",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("atencion_id", sa.Integer(), nullable=False),
        sa.Column("contenido", sa.LargeBinary(), nullable=False),
        sa.Column("content_type", sa.String(length=50), nullable=False),
        sa.Column("tamanio_bytes", sa.Integer(), nullable=False),
        sa.Column("subida_por_id", sa.Integer(), nullable=False),
        sa.Column("subida_en", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["atencion_id"], ["atencion.id"]),
        sa.ForeignKeyConstraint(["subida_por_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_formato_accidente_soat_foto_atencion_id"),
        "formato_accidente_soat_foto",
        ["atencion_id"],
    )
 
 
def downgrade() -> None:
    op.drop_index(
        op.f("ix_formato_accidente_soat_foto_atencion_id"),
        table_name="formato_accidente_soat_foto",
    )
    op.drop_table("formato_accidente_soat_foto")
 
