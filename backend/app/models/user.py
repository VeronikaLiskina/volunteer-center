from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(StrEnum):
    COORDINATOR = "COORDINATOR"
    VOLUNTEER = "VOLUNTEER"


class RegistrationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('COORDINATOR', 'VOLUNTEER')", name="ck_users_role"),
        CheckConstraint("role != 'VOLUNTEER' OR volunteer_id IS NOT NULL", name="ck_users_volunteer"),
        UniqueConstraint("phone", name="uq_users_phone"),
        CheckConstraint(r"phone IS NULL OR phone ~ '^\+7[0-9]{10}$'", name="ck_users_phone"),
        CheckConstraint("registration_status IN ('pending', 'approved', 'rejected')", name="ck_users_registration_status"),
        CheckConstraint("(registration_status = 'approved' AND role IS NOT NULL) OR "
                        "(registration_status != 'approved' AND role IS NULL AND NOT is_active AND volunteer_id IS NULL)",
                        name="ck_users_registration_access"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(254))
    phone: Mapped[str | None] = mapped_column(String(12))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(20))
    registration_status: Mapped[str] = mapped_column(String(20), default="approved", server_default="approved")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    volunteer_id: Mapped[int | None] = mapped_column(ForeignKey("volunteers.id"), unique=True)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
