"""Retain generated reports for exports matching the displayed results."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0007_report_snapshots"
down_revision = "0006_auth_notifications"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("report_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", JSONB(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_report_snapshots_user_id", "report_snapshots", ["user_id"])
    op.create_index("ix_report_snapshots_expires_at", "report_snapshots", ["expires_at"])


def downgrade():
    op.drop_table("report_snapshots")
