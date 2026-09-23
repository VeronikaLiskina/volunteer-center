import asyncio
import hashlib
import hmac
import math
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import case, delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.password_reset import PasswordReset, PasswordResetLimit
from app.models.user import User
from app.repositories.auth import AuthRepository
from app.schemas.auth import PasswordResetResponse
from app.services.auth import hash_password, token_digest
from app.services.sms import SmsDeliveryError, SmsSender


INVALID_CODE = "Код неверный или истёк. Проверьте код или запросите новый."
UNAVAILABLE = "Не удалось отправить SMS. Попробуйте позже."


class PasswordResetService:
    def __init__(self, session: AsyncSession):
        self.session = session

    def secret(self) -> bytes:
        secret = settings.password_reset_secret
        if secret is None or len(secret.get_secret_value()) < 32:
            raise HTTPException(503, UNAVAILABLE)
        return secret.get_secret_value().encode()

    def code_hash(self, request_id: str, phone: str, code: str) -> str:
        return hmac.new(self.secret(), f"{request_id}:{phone}:{code}".encode(), hashlib.sha256).hexdigest()

    async def limit(self, scope: str, maximum: int, seconds: int, now: datetime) -> None:
        # Atomic counters in PostgreSQL apply across workers and survive restarts.
        key = token_digest(scope)
        expired = PasswordResetLimit.expires_at <= now
        statement = insert(PasswordResetLimit).values(
            key=key, count=1, expires_at=now + timedelta(seconds=seconds),
        ).on_conflict_do_update(index_elements=[PasswordResetLimit.key], set_={
            "count": case((expired, 1), else_=PasswordResetLimit.count + 1),
            "expires_at": case((expired, now + timedelta(seconds=seconds)), else_=PasswordResetLimit.expires_at),
        }).returning(PasswordResetLimit.count, PasswordResetLimit.expires_at)
        count, expires_at = (await self.session.execute(statement)).one()
        if count > maximum:
            await self.session.commit()
            retry_after = max(1, math.ceil((expires_at - now).total_seconds()))
            raise HTTPException(429, "Слишком много попыток. Подождите и попробуйте снова.",
                                headers={"Retry-After": str(retry_after)})

    async def request_code(self, phone: str, ip: str) -> PasswordResetResponse:
        self.secret()
        sender = SmsSender()
        try:
            sender.ensure_configured()
        except SmsDeliveryError:
            raise HTTPException(503, UNAVAILABLE) from None
        now = datetime.now(timezone.utc)
        # Remove stale records without keeping phone numbers indefinitely.
        cutoff = now - timedelta(days=1)
        await self.session.execute(delete(PasswordReset).where(PasswordReset.expires_at < cutoff))
        await self.session.execute(delete(PasswordResetLimit).where(PasswordResetLimit.expires_at < cutoff))
        await self.limit("send:global:day", 200, 86400, now)
        await self.limit(f"send:ip:{ip}", 20, 3600, now)
        await self.limit(f"send:phone:hour:{phone}", 5, 3600, now)
        await self.limit(f"send:phone:minute:{phone}", 1, 60, now)
        user = await AuthRepository(self.session).by_phone(phone)
        request_id = str(uuid4())
        code = f"{secrets.randbelow(1_000_000):06d}"
        # A new request invalidates earlier codes, including delivery retries.
        await self.session.execute(update(PasswordReset).where(
            PasswordReset.phone == phone, PasswordReset.used_at.is_(None),
        ).values(used_at=now))
        challenge = PasswordReset(
            id=request_id, user_id=user.id if user else None, phone=phone,
            code_hash=self.code_hash(request_id, phone, code),
            password_fingerprint=token_digest(user.password_hash) if user else None,
            attempts=0, expires_at=now + timedelta(minutes=5),
        )
        self.session.add(challenge)
        await self.session.commit()
        if user:
            try:
                await sender.send_code(phone, code)
            except SmsDeliveryError:
                challenge.used_at = datetime.now(timezone.utc)
                await self.session.commit()
                raise HTTPException(503, UNAVAILABLE) from None
        return PasswordResetResponse(request_id=request_id)

    async def confirm(self, request_id: str, code: str, password: str, ip: str) -> None:
        self.secret()
        now = datetime.now(timezone.utc)
        await self.limit(f"confirm:ip:{ip}", 30, 60, now)
        challenge = await self.session.scalar(select(PasswordReset).where(
            PasswordReset.id == request_id,
        ).with_for_update())
        if challenge is None or challenge.used_at is not None or challenge.expires_at <= now or challenge.attempts >= 5:
            await self.session.commit()
            raise HTTPException(400, INVALID_CODE)
        challenge.attempts += 1
        valid = hmac.compare_digest(challenge.code_hash, self.code_hash(request_id, challenge.phone, code))
        if not valid or challenge.user_id is None:
            if challenge.attempts >= 5:
                challenge.used_at = now
            await self.session.commit()
            raise HTTPException(400, INVALID_CODE)
        user = await self.session.scalar(select(User).where(User.id == challenge.user_id).with_for_update())
        # Reject codes issued before a password or phone change; preserve account approval and role.
        if user is None or user.phone != challenge.phone or token_digest(user.password_hash) != challenge.password_fingerprint:
            challenge.used_at = now
            await self.session.commit()
            raise HTTPException(400, INVALID_CODE)
        user.password_hash = await asyncio.to_thread(hash_password, password)
        challenge.used_at = now
        await AuthRepository(self.session).revoke_user_sessions(user.id)
        await self.session.commit()
