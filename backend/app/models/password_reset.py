from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PasswordReset(Base):
    __tablename__ = "password_resets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    phone: Mapped[str] = mapped_column(String(12), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    password_fingerprint: Mapped[str | None] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PasswordResetLimit(Base):
    __tablename__ = "password_reset_limits"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    count: Mapped[int] = mapped_column()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
