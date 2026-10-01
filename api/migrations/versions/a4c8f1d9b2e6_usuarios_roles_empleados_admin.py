"""agregar tipo_vinculacion y debe_cambiar_password, sembrar roles y admin inicial
 
Revision ID: a4c8f1d9b2e6
Revises: e91e52fcb863
Create Date: 2026-09-30 21:00:00.000000
 
"""
 
from collections.abc import Sequence
 
import sqlalchemy as sa
from alembic import op
from app.core.config import get_settings
from app.core.security import hash_secret
 
# revision identifiers, used by Alembic.
revision: str = "a4c8f1d9b2e6"
down_revision: str | None = "e91e52fcb863"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None
 
# Roles conocidos del negocio (ver docstring de app/models/rol.py). Se
# siembran acá porque sin ellos nadie puede tener el rol "administrador"
# y por lo tanto nadie puede loguearse para crear usuarios desde la API
# — es el huevo y la gallina de cualquier sistema con roles en base de
# datos en vez de un Enum fijo.
_ROLES = [
    ("administrador", "Gestiona usuarios, roles, empleados y la configuración general"),
    ("auxiliar_enfermeria", "Diligencia y cierra formatos de traslado y atención SOAT"),
    ("medico", "Diligencia y cierra formatos de atención médica"),
    ("conductor", "Conduce la ambulancia durante un servicio"),
    ("contador", "Consulta reportes financieros y de inventario"),
]
 
 
def upgrade() -> None:
    tipo_vinculacion = sa.Enum("planta", "ocasional", name="tipo_vinculacion_empleado")
    tipo_vinculacion.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "empleado",
        sa.Column(
            "tipo_vinculacion",
            tipo_vinculacion,
            nullable=False,
            server_default="planta",
        ),
    )
 
    op.add_column(
        "usuario",
        sa.Column(
            "debe_cambiar_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
 
    bind = op.get_bind()
 
    rol_table = sa.table(
        "rol",
        sa.column("id", sa.Integer),
        sa.column("nombre", sa.String),
        sa.column("descripcion", sa.String),
    )
    rol_ids: dict[str, int] = {}
    for nombre, descripcion in _ROLES:
        resultado = bind.execute(
            rol_table.insert()
            .values(nombre=nombre, descripcion=descripcion)
            .returning(rol_table.c.id)
        )
        rol_ids[nombre] = resultado.scalar_one()
 
    settings = get_settings()
    usuario_table = sa.table(
        "usuario",
        sa.column("id", sa.Integer),
        sa.column("documento", sa.String),
        sa.column("password_hash", sa.String),
        sa.column("debe_cambiar_password", sa.Boolean),
    )
    resultado = bind.execute(
        usuario_table.insert()
        .values(
            documento=settings.admin_seed_documento,
            password_hash=hash_secret(settings.admin_seed_password),
            debe_cambiar_password=True,
        )
        .returning(usuario_table.c.id)
    )
    admin_id = resultado.scalar_one()
 
    usuario_rol_table = sa.table(
        "usuario_rol",
        sa.column("usuario_id", sa.Integer),
        sa.column("rol_id", sa.Integer),
    )
    bind.execute(
        usuario_rol_table.insert().values(usuario_id=admin_id, rol_id=rol_ids["administrador"])
    )
 
 
def downgrade() -> None:
    bind = op.get_bind()
    settings = get_settings()
 
    usuario_table = sa.table(
        "usuario", sa.column("id", sa.Integer), sa.column("documento", sa.String)
    )
    usuario_rol_table = sa.table(
        "usuario_rol", sa.column("usuario_id", sa.Integer), sa.column("rol_id", sa.Integer)
    )
    rol_table = sa.table("rol", sa.column("id", sa.Integer), sa.column("nombre", sa.String))
 
    admin = bind.execute(
        sa.select(usuario_table.c.id).where(
            usuario_table.c.documento == settings.admin_seed_documento
        )
    ).first()
    if admin is not None:
        bind.execute(usuario_rol_table.delete().where(usuario_rol_table.c.usuario_id == admin.id))
        bind.execute(usuario_table.delete().where(usuario_table.c.id == admin.id))
 
    nombres = [nombre for nombre, _ in _ROLES]
    bind.execute(rol_table.delete().where(rol_table.c.nombre.in_(nombres)))
 
    op.drop_column("usuario", "debe_cambiar_password")
    op.drop_column("empleado", "tipo_vinculacion")
    sa.Enum(name="tipo_vinculacion_empleado").drop(op.get_bind(), checkfirst=True)
