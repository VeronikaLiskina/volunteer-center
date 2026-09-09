"""Protect normalized volunteer duplicates at the database level.

Revision ID: 0003_volunteer_duplicate_key
Revises: 0002_volunteers
"""
from collections.abc import Sequence
import hashlib

from alembic import op
import sqlalchemy as sa

revision: str = "0003_volunteer_duplicate_key"
down_revision: str | None = "0002_volunteers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def duplicate_key(full_name: str, phone: str) -> str:
    normalized_name = " ".join(full_name.casefold().split())
    return hashlib.sha256(f"{normalized_name}\0{phone}".encode()).hexdigest()


def upgrade() -> None:
    op.add_column("volunteers", sa.Column("duplicate_key", sa.String(64), nullable=True))
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, full_name, phone FROM volunteers")).mappings()
    for row in rows:
        connection.execute(
            sa.text("UPDATE volunteers SET duplicate_key = :key WHERE id = :id"),
            {"id": row["id"], "key": duplicate_key(row["full_name"], row["phone"])},
        )
    op.alter_column("volunteers", "duplicate_key", nullable=False)
    op.drop_constraint("uq_volunteers_full_name_phone", "volunteers", type_="unique")
    op.create_unique_constraint("uq_volunteers_duplicate_key", "volunteers", ["duplicate_key"])


def downgrade() -> None:
    op.drop_constraint("uq_volunteers_duplicate_key", "volunteers", type_="unique")
    op.create_unique_constraint("uq_volunteers_full_name_phone", "volunteers", ["full_name", "phone"])
    op.drop_column("volunteers", "duplicate_key")
