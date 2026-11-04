from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c5d8f2a41b73"
down_revision: str | Sequence[str] | None = "a7c3e9d15b42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "privacy tables are never dropped; rows are only soft deleted"
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


def create_request_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("status", sa.String(length=SHORT), nullable=False),
        sa.Column("requested_at", sa.String(length=SHORT), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f(f"ix_{name}_user_id"), name, ["user_id"], unique=False)
    op.create_index(op.f(f"ix_{name}_status"), name, ["status"], unique=False)
    op.create_index(op.f(f"ix_{name}_requested_at"), name, ["requested_at"], unique=False)


def upgrade() -> None:
    create_request_table("data_exports")
    create_request_table("account_deletions")
    op.create_table(
        "consent_records",
        sa.Column("id", sa.String(length=ID), nullable=False),
        sa.Column("user_id", sa.String(length=ID), nullable=False),
        sa.Column("kind", sa.String(length=SHORT), nullable=False),
        sa.Column("at", sa.String(length=SHORT), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        *audit_columns(),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_consent_records_user_id"), "consent_records", ["user_id"], unique=False)
    op.create_index(op.f("ix_consent_records_at"), "consent_records", ["at"], unique=False)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
