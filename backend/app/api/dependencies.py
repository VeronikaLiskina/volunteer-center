from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.user import User, UserRole
from app.services.auth import AuthService

bearer = HTTPBearer(auto_error=False)


async def current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if credentials is None:
        raise HTTPException(401, "Требуется вход", headers={"WWW-Authenticate": "Bearer"})
    return await AuthService(session).authenticate(credentials.credentials)


CurrentUser = Annotated[User, Depends(current_user)]


def coordinator(user: CurrentUser) -> User:
    if user.role != UserRole.COORDINATOR:
        raise HTTPException(403, "Доступ только для координатора")
    return user
