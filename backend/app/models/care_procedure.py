from datetime import date, datetime, time
from enum import StrEnum

from sqlalchemy import Boolean, CheckConstraint, Date, Enum, ForeignKey, Integer, String, Time, case
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.animal import Animal
from app.models.care_procedure_type import CareProcedureType
from app.models.volunteer import Volunteer


class CareProcedureStatus(StrEnum):
    ASSIGNED = "assigned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class CareProcedure(Base):
    __tablename__ = "care_procedures"
    __table_args__ = (CheckConstraint("duration_minutes > 0", name="ck_care_procedures_duration"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    animal_id: Mapped[int] = mapped_column(ForeignKey("animals.id"), index=True)
    procedure_type_id: Mapped[int] = mapped_column(ForeignKey("care_procedure_types.id"))
    planned_date: Mapped[date] = mapped_column(Date, index=True)
    planned_time: Mapped[time] = mapped_column(Time)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    volunteer_id: Mapped[int] = mapped_column(ForeignKey("volunteers.id"), index=True)
    stored_status: Mapped[CareProcedureStatus] = mapped_column(
        "status",
        Enum(CareProcedureStatus, values_callable=lambda enum: [item.value for item in enum],
             name="care_procedure_status", native_enum=False, create_constraint=True),
        default=CareProcedureStatus.ASSIGNED, server_default=CareProcedureStatus.ASSIGNED.value, index=True,
    )
    comment: Mapped[str | None] = mapped_column(String(255))
    suspended_by_archive: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    @hybrid_property
    def status(self) -> CareProcedureStatus:
        if (self.stored_status == CareProcedureStatus.ASSIGNED and not self.suspended_by_archive
                and datetime.combine(self.planned_date, self.planned_time) < datetime.now()):
            return CareProcedureStatus.OVERDUE
        return self.stored_status

    @status.inplace.setter
    def _set_status(self, value: CareProcedureStatus) -> None:
        self.stored_status = value

    @status.inplace.expression
    @classmethod
    def _status_expression(cls):
        return case(((cls.stored_status == CareProcedureStatus.ASSIGNED)
                     & cls.suspended_by_archive.is_(False)
                     & (cls.planned_date + cls.planned_time < datetime.now()),
                     CareProcedureStatus.OVERDUE.value), else_=cls.stored_status)

    animal: Mapped[Animal] = relationship(lazy="raise", viewonly=True)
    procedure_type: Mapped[CareProcedureType] = relationship(lazy="raise", viewonly=True)
    volunteer: Mapped[Volunteer] = relationship(lazy="raise", viewonly=True)
