from enum import StrEnum
from datetime import time

from sqlalchemy import CheckConstraint, Enum, Index, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VolunteerStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Volunteer(Base):
    __tablename__ = "volunteers"
    __table_args__ = (
        CheckConstraint("available_from IS NULL OR available_to IS NULL OR available_from < available_to", name="ck_volunteers_availability"),
        CheckConstraint("btrim(full_name) <> ''", name="ck_volunteers_full_name_not_blank"),
        CheckConstraint("phone ~ '^\\+7[0-9]{10}$'", name="ck_volunteers_phone_normalized"),
        UniqueConstraint("duplicate_key", name="uq_volunteers_duplicate_key"),
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
    available_from: Mapped[time | None] = mapped_column(Time)
    available_to: Mapped[time | None] = mapped_column(Time)
    # Server-generated fingerprint, deliberately absent from public API schemas.
    duplicate_key: Mapped[str] = mapped_column(String(64))
