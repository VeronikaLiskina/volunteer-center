"""Add users, revocable sessions and procedure notifications."""
from alembic import op
import sqlalchemy as sa

revision = "0006_auth_notifications"
down_revision = "0005_procedure_executions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("care_procedures", sa.Column("revision", sa.Integer(), nullable=False, server_default="1"))
    op.create_table("users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("login", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("volunteer_id", sa.Integer(), sa.ForeignKey("volunteers.id"), unique=True),
        sa.CheckConstraint("role IN ('COORDINATOR', 'VOLUNTEER')", name="ck_users_role"),
        sa.CheckConstraint("role != 'VOLUNTEER' OR volunteer_id IS NOT NULL", name="ck_users_volunteer"),
    )
    op.create_table("auth_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])
    op.create_table("notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("procedure_id", sa.Integer(), sa.ForeignKey("care_procedures.id"), nullable=False),
        sa.Column("event_key", sa.String(120), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "event_key", name="uq_notification_event"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade():
    op.drop_table("notifications")
    op.drop_table("auth_sessions")
    op.drop_table("users")
    op.drop_column("care_procedures", "revision")
