from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.care_procedure import CareProcedure


class ProcedureExecution(Base):
    __tablename__ = "procedure_executions"
    __table_args__ = (
        UniqueConstraint(
            "care_procedure_id", name="uq_procedure_executions_care_procedure_id"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    care_procedure_id: Mapped[int] = mapped_column(ForeignKey("care_procedures.id"))
    execution_date: Mapped[date] = mapped_column(Date)
    execution_time: Mapped[time] = mapped_column(Time)
    result: Mapped[str] = mapped_column(Text)
    comment: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    care_procedure: Mapped[CareProcedure] = relationship(lazy="raise", viewonly=True)
