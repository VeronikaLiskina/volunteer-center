from datetime import date, datetime, time

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.care_procedure import CareProcedure


class ProcedureExecution(Base):
    __tablename__ = "procedure_executions"
    __table_args__ = (
        CheckConstraint("(is_completed AND failure_reason IS NULL AND btrim(result) <> '') OR (NOT is_completed AND failure_reason IS NOT NULL AND btrim(failure_reason) <> '')", name="ck_execution_outcome"),
        UniqueConstraint(
            "care_procedure_id", name="uq_procedure_executions_care_procedure_id"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    care_procedure_id: Mapped[int] = mapped_column(ForeignKey("care_procedures.id"))
    execution_date: Mapped[date] = mapped_column(Date)
    execution_time: Mapped[time] = mapped_column(Time)
    result: Mapped[str] = mapped_column(Text)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    failure_reason: Mapped[str | None] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    care_procedure: Mapped[CareProcedure] = relationship(lazy="raise", viewonly=True)
