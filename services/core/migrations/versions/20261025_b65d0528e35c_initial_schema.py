from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b65d0528e35c'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

IRREVERSIBLE = "initial schema is never dropped; records are only soft deleted"
APP_ROLE = "careerpilot_app"
INSERT_ONLY_FUNCTION = """
CREATE OR REPLACE FUNCTION reject_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is insert-only';
END;
$$ LANGUAGE plpgsql
"""
INSERT_ONLY_TRIGGER = "CREATE TRIGGER audit_events_insert_only BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit_change()"


def upgrade() -> None:
    op.create_table('admin_accounts',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('full_name', sa.String(length=320), nullable=False),
    sa.Column('role', sa.String(length=32), nullable=False),
    sa.Column('suspended', sa.Boolean(), nullable=False),
    sa.Column('mfa_enabled', sa.Boolean(), nullable=False),
    sa.Column('last_sign_in_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('password_hash', sa.String(length=320), nullable=False),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=False),
    sa.Column('created_by_type', sa.String(length=32), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=64), nullable=False),
    sa.Column('updated_by_type', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(length=64), nullable=True),
    sa.Column('deleted_by_type', sa.String(length=32), nullable=True),
    sa.Column('delete_reason', sa.String(length=320), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_table('admin_projections',
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('sequence', sa.Integer(), nullable=False),
    sa.Column('document', sa.JSON(), nullable=False),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=False),
    sa.Column('created_by_type', sa.String(length=32), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=64), nullable=False),
    sa.Column('updated_by_type', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(length=64), nullable=True),
    sa.Column('deleted_by_type', sa.String(length=32), nullable=True),
    sa.Column('delete_reason', sa.String(length=320), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('kind', 'id')
    )
    op.create_table('audit_events',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('actor_name', sa.String(length=320), nullable=False),
    sa.Column('actor_type', sa.String(length=32), nullable=False),
    sa.Column('action', sa.String(length=320), nullable=False),
    sa.Column('target', sa.String(length=320), nullable=False),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=False),
    sa.Column('created_by_type', sa.String(length=32), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=64), nullable=False),
    sa.Column('updated_by_type', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(length=64), nullable=True),
    sa.Column('deleted_by_type', sa.String(length=32), nullable=True),
    sa.Column('delete_reason', sa.String(length=320), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_events_at'), 'audit_events', ['at'], unique=False)
    op.create_table('candidate_workspaces',
    sa.Column('user_id', sa.String(length=64), nullable=False),
    sa.Column('document', sa.JSON(), nullable=False),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=False),
    sa.Column('created_by_type', sa.String(length=32), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=64), nullable=False),
    sa.Column('updated_by_type', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(length=64), nullable=True),
    sa.Column('deleted_by_type', sa.String(length=32), nullable=True),
    sa.Column('delete_reason', sa.String(length=320), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('opportunities',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('document', sa.JSON(), nullable=False),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=False),
    sa.Column('created_by_type', sa.String(length=32), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=64), nullable=False),
    sa.Column('updated_by_type', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(length=64), nullable=True),
    sa.Column('deleted_by_type', sa.String(length=32), nullable=True),
    sa.Column('delete_reason', sa.String(length=320), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('platform_settings',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('document', sa.JSON(), nullable=False),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=False),
    sa.Column('created_by_type', sa.String(length=32), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=64), nullable=False),
    sa.Column('updated_by_type', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(length=64), nullable=True),
    sa.Column('deleted_by_type', sa.String(length=32), nullable=True),
    sa.Column('delete_reason', sa.String(length=320), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('user_accounts',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('full_name', sa.String(length=320), nullable=False),
    sa.Column('photo_url', sa.String(length=320), nullable=True),
    sa.Column('password_hash', sa.String(length=320), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('consent_terms_version', sa.String(length=32), nullable=True),
    sa.Column('consent_privacy_version', sa.String(length=32), nullable=True),
    sa.Column('tenant_id', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by', sa.String(length=64), nullable=False),
    sa.Column('created_by_type', sa.String(length=32), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=64), nullable=False),
    sa.Column('updated_by_type', sa.String(length=32), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(length=64), nullable=True),
    sa.Column('deleted_by_type', sa.String(length=32), nullable=True),
    sa.Column('delete_reason', sa.String(length=320), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('uq_user_accounts_email_active', 'user_accounts', ['email'], unique=True, sqlite_where=sa.text('deleted_at IS NULL'), postgresql_where=sa.text('deleted_at IS NULL'))
    if op.get_bind().dialect.name == "postgresql":
        op.execute(f"REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM {APP_ROLE}")
        op.execute(INSERT_ONLY_FUNCTION)
        op.execute(INSERT_ONLY_TRIGGER)


def downgrade() -> None:
    raise RuntimeError(IRREVERSIBLE)
