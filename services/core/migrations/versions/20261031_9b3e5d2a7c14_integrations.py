from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9b3e5d2a7c14"
down_revision: str | Sequence[str] | None = "4f2a9c7d1e60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "integration tables are never dropped; rows are only soft deleted"
ID = 64
SHORT = 32
TEXT = 320
MESSAGE_ID = 255


def audit_columns() -> list[sa.Column[object]]:
    return [
        sa.Column("tenant_id", sa.String(length=ID), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(length=ID), nullable=False),
        sa.Column("created_by_type", sa.String(length=SHORT), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.String(length=ID), nullable=False),
        sa.Column("updated_by_type", sa.String(length=SHORT), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=ID), nullable=True),
        sa.Column("deleted_by_type", sa.String(length=SHORT), nullable=True),
        sa.Column("delete_reason", sa.String(length=TEXT), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "integration_connections",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("provider", sa.String(length=SHORT), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_integration_connections_user_id"), "integration_connections", ["user_id"], unique=False)
    op.create_index(op.f("ix_integration_connections_provider"), "integration_connections", ["provider"], unique=False)
    op.create_table(
        "synced_messages",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("message_id", sa.String(length=MESSAGE_ID), nullable=False),
        sa.Column("application_id", sa.String(length=ID), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_synced_messages_user_id"), "synced_messages", ["user_id"], unique=False)
    op.create_index(op.f("ix_synced_messages_message_id"), "synced_messages", ["message_id"], unique=False)
    op.create_index(op.f("ix_synced_messages_application_id"), "synced_messages", ["application_id"], unique=False)
    op.create_table(
        "calendar_events",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("task_id", sa.String(length=ID), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_calendar_events_user_id"), "calendar_events", ["user_id"], unique=False)
    op.create_index(op.f("ix_calendar_events_task_id"), "calendar_events", ["task_id"], unique=False)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
