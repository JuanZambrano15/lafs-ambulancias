"""Entorno de Alembic: usa la misma configuración (DATABASE_URL) y la
misma Base declarativa que la aplicación, para que `alembic revision
--autogenerate` detecte los modelos reales en vez de mantener el esquema
a mano.
"""

from logging.config import fileConfig

import app.models  # noqa: F401  (registra los modelos en Base.metadata)
from alembic import context
from app.core.config import get_settings
from app.db.base import Base
from sqlalchemy import engine_from_config, pool

# Importar aquí cada módulo de modelos para que Base.metadata los conozca,
# a medida que se agreguen (ej. `from app.models import usuario, ambulancia`).

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", str(get_settings().database_url))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
