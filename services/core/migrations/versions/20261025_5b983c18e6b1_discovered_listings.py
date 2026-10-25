from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5b983c18e6b1"
down_revision: str | Sequence[str] | None = "b65d0528e35c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "discovery tables are never dropped; records are only soft deleted"


def upgrade() -> None:
    op.create_table(
        "discovered_listings",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=False),
        sa.Column("created_by_type", sa.String(length=32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=False),
        sa.Column("updated_by_type", sa.String(length=32), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_by_type", sa.String(length=32), nullable=True),
        sa.Column("delete_reason", sa.String(length=320), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_discovered_listings_fingerprint"), "discovered_listings", ["fingerprint"], unique=False)
    op.create_index(op.f("ix_discovered_listings_status"), "discovered_listings", ["status"], unique=False)
    op.create_table(
        "discovered_listing_urls",
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("listing_id", sa.String(length=64), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", sa.String(length=64), nullable=False),
        sa.Column("created_by_type", sa.String(length=32), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_by", sa.String(length=64), nullable=False),
        sa.Column("updated_by_type", sa.String(length=32), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=64), nullable=True),
        sa.Column("deleted_by_type", sa.String(length=32), nullable=True),
        sa.Column("delete_reason", sa.String(length=320), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["listing_id"],
            ["discovered_listings.id"],
        ),
        sa.PrimaryKeyConstraint("url"),
    )
    op.create_index(op.f("ix_discovered_listing_urls_listing_id"), "discovered_listing_urls", ["listing_id"], unique=False)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
