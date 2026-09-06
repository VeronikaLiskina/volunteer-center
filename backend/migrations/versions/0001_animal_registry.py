"""Create the animal registry and its dictionaries.

Revision ID: 0001_animal_registry
Revises:
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_animal_registry"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "animal_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
    )
    op.create_table(
        "breeds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("animal_type_id", sa.Integer(), sa.ForeignKey("animal_types.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("min_weight", sa.Numeric(6, 2), nullable=True),
        sa.Column("max_weight", sa.Numeric(6, 2), nullable=True),
        sa.UniqueConstraint("animal_type_id", "name", name="uq_breeds_type_name"),
        sa.UniqueConstraint("id", "animal_type_id", name="uq_breeds_id_type"),
        sa.CheckConstraint("min_weight IS NULL OR min_weight > 0", name="ck_breeds_min_weight"),
        sa.CheckConstraint("max_weight IS NULL OR max_weight > 0", name="ck_breeds_max_weight"),
        sa.CheckConstraint("min_weight <= max_weight", name="ck_breeds_weight_range"),
    )
    op.create_table(
        "animals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("animal_type_id", sa.Integer(), sa.ForeignKey("animal_types.id"), nullable=False),
        sa.Column("breed_id", sa.Integer(), nullable=False),
        sa.Column("weight", sa.Numeric(6, 2), nullable=False),
        sa.Column("birth_year", sa.Integer(), nullable=False),
        sa.Column("owner_name", sa.String(100), nullable=True),
        sa.Column("owner_phone", sa.String(12), nullable=True),
        sa.Column("note", sa.String(255), nullable=True),
        sa.Column("status", sa.Enum("in_care", "archived", name="animal_status",
                  native_enum=False, create_constraint=True), nullable=False, server_default="in_care"),
        sa.Column("duplicate_key", sa.String(64), nullable=False, unique=True),
        sa.CheckConstraint("weight > 0", name="ck_animals_weight"),
        sa.CheckConstraint("birth_year BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE)",
                           name="ck_animals_birth_year"),
        sa.ForeignKeyConstraint(["breed_id", "animal_type_id"], ["breeds.id", "breeds.animal_type_id"],
                                name="fk_animals_breed_type"),
    )
    op.create_index("ix_animals_animal_type_id", "animals", ["animal_type_id"])
    op.create_index("ix_animals_breed_id", "animals", ["breed_id"])
    op.create_index("ix_animals_status", "animals", ["status"])


def downgrade() -> None:
    op.drop_table("animals")
    op.drop_table("breeds")
    op.drop_table("animal_types")
