from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3c7e9a41d2f8"
down_revision: str | Sequence[str] | None = "5b983c18e6b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "account columns are never dropped; records are only soft deleted"
TABLE = "user_accounts"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(TABLE, sa.Column("consent_ip", sa.String(length=320), nullable=True))
    op.add_column(TABLE, sa.Column("consent_device", sa.String(length=320), nullable=True))
    op.add_column(TABLE, sa.Column("credentials_changed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
