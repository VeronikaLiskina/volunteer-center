"""Separate display names from unique phone credentials."""
from alembic import op
import sqlalchemy as sa

revision = "0008_user_phone_name"
down_revision = "0007_report_snapshots"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("users_login_key", "users", type_="unique")
    op.alter_column("users", "login", new_column_name="full_name")
    # Old coordinator accounts have no phone: retain them for explicit profile setup.
    op.add_column("users", sa.Column("phone", sa.String(12), nullable=True))
    op.execute("""
        UPDATE users AS u SET full_name = v.full_name
        FROM volunteers AS v WHERE u.volunteer_id = v.id
    """)
    op.execute(r"""
        WITH candidates AS (
            SELECT u.id, v.phone, count(*) OVER (PARTITION BY v.phone) AS phone_count
            FROM users u JOIN volunteers v ON v.id = u.volunteer_id
            WHERE v.phone ~ '^\+7[0-9]{10}$'
        )
        UPDATE users AS u SET phone = c.phone FROM candidates c
        WHERE u.id = c.id AND c.phone_count = 1
    """)
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.create_check_constraint("ck_users_phone", "users", r"phone IS NULL OR phone ~ '^\+7[0-9]{10}$'")


def downgrade():
    # Names are no longer unique. Use the unique phone/ID as the legacy login.
    op.execute("UPDATE users SET full_name = COALESCE(phone, 'user-' || id::text)")
    op.drop_constraint("ck_users_phone", "users", type_="check")
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.drop_column("users", "phone")
    op.alter_column("users", "full_name", new_column_name="login")
    op.create_unique_constraint("users_login_key", "users", ["login"])
