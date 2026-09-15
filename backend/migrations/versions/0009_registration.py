"""Self registration and coordinator review, preserving existing accounts."""
from alembic import op
import sqlalchemy as sa

revision = "0009_registration"
down_revision = "0008_user_phone_name"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("users", "role", existing_type=sa.String(20), nullable=True)
    op.add_column("users", sa.Column("registration_status", sa.String(20), nullable=False, server_default="approved"))
    op.add_column("users", sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.add_column("users", sa.Column("reviewed_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", name="fk_users_reviewed_by")))
    op.create_check_constraint("ck_users_registration_status", "users", "registration_status IN ('pending', 'approved', 'rejected')")
    op.create_check_constraint("ck_users_registration_access", "users",
        "(registration_status = 'approved' AND role IS NOT NULL) OR "
        "(registration_status != 'approved' AND role IS NULL AND NOT is_active AND volunteer_id IS NULL)")


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM users WHERE role IS NULL")):
        raise RuntimeError("Нельзя откатить миграцию, пока существуют заявки без назначенной роли")
    op.drop_constraint("ck_users_registration_access", "users", type_="check")
    op.drop_constraint("ck_users_registration_status", "users", type_="check")
    op.drop_constraint("fk_users_reviewed_by", "users", type_="foreignkey")
    for column in ("reviewed_by", "reviewed_at", "created_at", "registration_status"):
        op.drop_column("users", column)
    op.alter_column("users", "role", existing_type=sa.String(20), nullable=False)
