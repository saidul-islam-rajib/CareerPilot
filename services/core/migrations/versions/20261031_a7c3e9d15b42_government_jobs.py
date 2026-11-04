from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a7c3e9d15b42"
down_revision: str | Sequence[str] | None = "9b3e5d2a7c14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "government job tables are never dropped; rows are only soft deleted"
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
        "gov_circulars",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("status", sa.String(length=SHORT), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gov_circulars_status"), "gov_circulars", ["status"], unique=False)
    op.create_table(
        "gov_holidays",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("on_date", sa.Date(), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gov_holidays_on_date"), "gov_holidays", ["on_date"], unique=False)
    op.create_table(
        "gov_applications",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("circular_id", sa.String(length=ID), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gov_applications_user_id"), "gov_applications", ["user_id"], unique=False)
    op.create_index(op.f("ix_gov_applications_circular_id"), "gov_applications", ["circular_id"], unique=False)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
