from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c9e5b7a21f36"
down_revision: str | Sequence[str] | None = "a4c7e92b1d05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None
IRREVERSIBLE = "admin second-factor data is never dropped; accounts are only soft deleted"
TEXT = 320
TABLE = "admin_accounts"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("mfa_secret", sa.String(length=TEXT), nullable=True))
    op.add_column(TABLE, sa.Column("mfa_pending_secret", sa.String(length=TEXT), nullable=True))
    op.add_column(TABLE, sa.Column("mfa_last_step", sa.BigInteger(), nullable=True))
    op.add_column(TABLE, sa.Column("mfa_recovery_hashes", sa.JSON(), nullable=True))
    accounts = sa.table(TABLE, sa.column("mfa_enabled", sa.Boolean()), sa.column("mfa_secret", sa.String()))
    op.execute(accounts.update().where(accounts.c.mfa_secret.is_(None)).values(mfa_enabled=False))


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
