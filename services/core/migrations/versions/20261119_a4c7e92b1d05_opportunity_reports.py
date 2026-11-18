from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a4c7e92b1d05"
down_revision: str | Sequence[str] | None = "f3c8a1d92e47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "opportunity reports are never dropped; rows are only soft deleted"
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
        "opportunity_reports",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("opportunity_id", sa.String(length=ID), nullable=False),
        sa.Column("status", sa.String(length=SHORT), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_opportunity_reports_user_id"), "opportunity_reports", ["user_id"], unique=False)
    op.create_index(op.f("ix_opportunity_reports_opportunity_id"), "opportunity_reports", ["opportunity_id"], unique=False)
    op.create_index(op.f("ix_opportunity_reports_status"), "opportunity_reports", ["status"], unique=False)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
