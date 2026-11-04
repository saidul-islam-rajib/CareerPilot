from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e4b8a2c97d10"
down_revision: str | Sequence[str] | None = "c5d8f2a41b73"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "writing drafts are never dropped; rows are only soft deleted"
ID = 64
SHORT = 32
TEXT = 320


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
        "writing_drafts",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("opportunity_id", sa.String(length=ID), nullable=False),
        sa.Column("kind", sa.String(length=SHORT), nullable=False),
        sa.Column("drafted_at", sa.String(length=SHORT), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_writing_drafts_user_id"), "writing_drafts", ["user_id"], unique=False)
    op.create_index(op.f("ix_writing_drafts_opportunity_id"), "writing_drafts", ["opportunity_id"], unique=False)
    op.create_index(op.f("ix_writing_drafts_kind"), "writing_drafts", ["kind"], unique=False)
    op.create_index(op.f("ix_writing_drafts_drafted_at"), "writing_drafts", ["drafted_at"], unique=False)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
