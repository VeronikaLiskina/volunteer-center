from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import AuthSession, User


class AuthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def by_phone(self, phone: str) -> User | None:
        return await self.session.scalar(select(User).where(User.phone == phone))

    async def get(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def by_token(self, token_hash: str) -> User | None:
        return await self.session.scalar(select(User).join(AuthSession).where(
            AuthSession.token_hash == token_hash,
            AuthSession.expires_at > datetime.now(timezone.utc), User.is_active.is_(True),
        ))

    async def revoke(self, token_hash: str) -> None:
        await self.session.execute(delete(AuthSession).where(AuthSession.token_hash == token_hash))

    async def revoke_user_sessions(self, user_id: int) -> None:
        await self.session.execute(delete(AuthSession).where(AuthSession.user_id == user_id))

    def add(self, entity: User | AuthSession) -> None:
        self.session.add(entity)
