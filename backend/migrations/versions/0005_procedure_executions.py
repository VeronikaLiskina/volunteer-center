"""Create procedure execution records.

Revision ID: 0005_procedure_executions
Revises: 0004_care_procedures
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0005_procedure_executions"
down_revision: str | None = "0004_care_procedures"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "procedure_executions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("care_procedure_id", sa.Integer(), nullable=False),
        sa.Column("execution_date", sa.Date(), nullable=False),
        sa.Column("execution_time", sa.Time(), nullable=False),
        sa.Column("result", sa.Text(), nullable=False),
        sa.Column("comment", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["care_procedure_id"], ["care_procedures.id"]),
        sa.UniqueConstraint(
            "care_procedure_id", name="uq_procedure_executions_care_procedure_id"
        ),
    )


def downgrade() -> None:
    op.drop_table("procedure_executions")
