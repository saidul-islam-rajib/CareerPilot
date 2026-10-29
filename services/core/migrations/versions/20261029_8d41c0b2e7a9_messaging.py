from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8d41c0b2e7a9"
down_revision: str | Sequence[str] | None = "3c7e9a41d2f8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "messaging tables are never dropped; records are only soft deleted"
ID = 64
SHORT = 32
TEXT = 320
PAIR = ID * 2 + 1


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
        "notifications",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("at", sa.String(length=SHORT), nullable=False),
        sa.Column("read_at", sa.String(length=SHORT), nullable=True),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_notifications_at"), "notifications", ["at"], unique=False)
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("kind", sa.String(length=SHORT), nullable=False),
        sa.Column("pair_key", sa.String(length=PAIR), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_conversations_kind"), "conversations", ["kind"], unique=False)
    op.create_index(op.f("ix_conversations_pair_key"), "conversations", ["pair_key"], unique=False)
    op.create_table(
        "conversation_members",
        sa.Column("conversation_id", sa.String(length=ID), nullable=False),
        sa.Column("member_id", sa.String(length=ID), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("conversation_id", "member_id"),
    )
    op.create_index(op.f("ix_conversation_members_member_id"), "conversation_members", ["member_id"], unique=False)
    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("conversation_id", sa.String(length=ID), nullable=False),
        sa.Column("sender_id", sa.String(length=ID), nullable=False),
        sa.Column("at", sa.String(length=SHORT), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_messages_conversation_id"), "messages", ["conversation_id"], unique=False)
    op.create_index(op.f("ix_messages_at"), "messages", ["at"], unique=False)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
