"""Availability, explicit outcomes and reversible animal archive.

Revision ID: 0012_workflow_rules
Revises: 0011_remove_sms_recovery
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_workflow_rules"
down_revision = "0011_remove_sms_recovery"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("volunteers", sa.Column("available_from", sa.Time(), nullable=True))
    op.add_column("volunteers", sa.Column("available_to", sa.Time(), nullable=True))
    op.create_check_constraint("ck_volunteers_availability", "volunteers", "available_from IS NULL OR available_to IS NULL OR available_from < available_to")
    op.add_column("procedure_executions", sa.Column("is_completed", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("procedure_executions", sa.Column("failure_reason", sa.Text(), nullable=True))
    op.create_check_constraint("ck_execution_outcome", "procedure_executions", "(is_completed AND failure_reason IS NULL AND btrim(result) <> '') OR (NOT is_completed AND failure_reason IS NOT NULL AND btrim(failure_reason) <> '')")
    op.add_column("care_procedures", sa.Column("suspended_by_archive", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("UPDATE care_procedures SET suspended_by_archive = true WHERE status IN ('assigned', 'overdue') AND animal_id IN (SELECT id FROM animals WHERE status = 'archived')")


def downgrade():
    op.drop_column("care_procedures", "suspended_by_archive")
    op.drop_constraint("ck_execution_outcome", "procedure_executions")
    op.drop_column("procedure_executions", "failure_reason")
    op.drop_column("procedure_executions", "is_completed")
    op.drop_constraint("ck_volunteers_availability", "volunteers")
    op.drop_column("volunteers", "available_to")
    op.drop_column("volunteers", "available_from")
