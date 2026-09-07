"""Create the volunteer registry.

Revision ID: 0002_volunteers
Revises: 0001_animal_registry
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0002_volunteers"
down_revision: str | None = "0001_animal_registry"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "volunteers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(12), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "inactive", name="volunteer_status", native_enum=False, create_constraint=True),
            nullable=False,
            server_default="active",
        ),
        sa.Column("note", sa.String(255), nullable=True),
        sa.CheckConstraint("btrim(full_name) <> ''", name="ck_volunteers_full_name_not_blank"),
        sa.CheckConstraint("phone ~ '^\\+7[0-9]{10}$'", name="ck_volunteers_phone_normalized"),
        sa.UniqueConstraint("full_name", "phone", name="uq_volunteers_full_name_phone"),
    )
    op.create_index("ix_volunteers_status", "volunteers", ["status"])


def downgrade() -> None:
    op.drop_table("volunteers")
