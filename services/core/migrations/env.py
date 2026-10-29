import os

from alembic import context
from sqlalchemy import create_engine, pool

import careerpilot.administration.adapters.sql
import careerpilot.candidate.adapters.sql
import careerpilot.discovery.adapters.sql
import careerpilot.messaging.adapters.sql
from careerpilot.platform.persistence import Base

MIGRATION_URL_ENV = "CAREERPILOT_MIGRATION_DATABASE_URL"

target_metadata = Base.metadata
registered_modules = (careerpilot.administration.adapters.sql, careerpilot.candidate.adapters.sql, careerpilot.discovery.adapters.sql)


def database_url() -> str:
    url = os.environ.get(MIGRATION_URL_ENV)
    if not url:
        raise RuntimeError(MIGRATION_URL_ENV)
    return url


def run_offline() -> None:
    context.configure(url=database_url(), target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_online() -> None:
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_offline()
else:
    run_online()
