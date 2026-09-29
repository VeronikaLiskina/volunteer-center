"""Remove retired SMS recovery challenges and limits."""
from alembic import op
import sqlalchemy as sa

revision = "0011_remove_sms_recovery"
down_revision = "0010_password_reset"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("password_reset_limits")
    op.drop_table("password_resets")


def downgrade():
    op.create_table("password_resets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("phone", sa.String(12), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("password_fingerprint", sa.String(64)),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_password_resets_phone", "password_resets", ["phone"])
    op.create_index("ix_password_resets_expires_at", "password_resets", ["expires_at"])
    op.create_table("password_reset_limits",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_password_reset_limits_expires_at", "password_reset_limits", ["expires_at"])
