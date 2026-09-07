from enum import StrEnum

from sqlalchemy import CheckConstraint, Enum, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VolunteerStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Volunteer(Base):
    __tablename__ = "volunteers"
    __table_args__ = (
        CheckConstraint("btrim(full_name) <> ''", name="ck_volunteers_full_name_not_blank"),
        CheckConstraint("phone ~ '^\\+7[0-9]{10}$'", name="ck_volunteers_phone_normalized"),
        UniqueConstraint("full_name", "phone", name="uq_volunteers_full_name_phone"),
        Index("ix_volunteers_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(12))
    status: Mapped[VolunteerStatus] = mapped_column(
        Enum(VolunteerStatus, values_callable=lambda enum: [item.value for item in enum],
             name="volunteer_status", native_enum=False, create_constraint=True),
        default=VolunteerStatus.ACTIVE,
        server_default=VolunteerStatus.ACTIVE.value,
    )
    note: Mapped[str | None] = mapped_column(String(255))
