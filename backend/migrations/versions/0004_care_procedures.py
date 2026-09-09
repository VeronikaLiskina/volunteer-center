"""Create care procedure planning tables.

Revision ID: 0004_care_procedures
Revises: 0003_volunteer_duplicate_key
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0004_care_procedures"
down_revision: str | None = "0003_volunteer_duplicate_key"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "care_procedure_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.UniqueConstraint("name", name="uq_care_procedure_types_name"),
    )
    op.create_table(
        "care_procedures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("animal_id", sa.Integer(), nullable=False),
        sa.Column("procedure_type_id", sa.Integer(), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=False),
        sa.Column("planned_time", sa.Time(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("volunteer_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "assigned", "completed", "cancelled", "overdue",
                name="care_procedure_status", native_enum=False, create_constraint=True,
            ),
            nullable=False,
            server_default="assigned",
        ),
        sa.Column("comment", sa.String(255), nullable=True),
        sa.CheckConstraint(
            "duration_minutes > 0", name="ck_care_procedures_duration"
        ),
        sa.ForeignKeyConstraint(["animal_id"], ["animals.id"]),
        sa.ForeignKeyConstraint(
            ["procedure_type_id"], ["care_procedure_types.id"]
        ),
        sa.ForeignKeyConstraint(["volunteer_id"], ["volunteers.id"]),
    )
    op.create_index("ix_care_procedures_animal_id", "care_procedures", ["animal_id"])
    op.create_index("ix_care_procedures_planned_date", "care_procedures", ["planned_date"])
    op.create_index("ix_care_procedures_status", "care_procedures", ["status"])
    op.create_index("ix_care_procedures_volunteer_id", "care_procedures", ["volunteer_id"])


def downgrade() -> None:
    op.drop_table("care_procedures")
    op.drop_table("care_procedure_types")
