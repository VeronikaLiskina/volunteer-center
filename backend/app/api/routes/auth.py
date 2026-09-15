from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, bearer
from app.db.session import get_session
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, session: Session):
    return await AuthService(session).login(data.phone, data.password)


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return user


@router.post("/logout", status_code=204)
async def logout(user: CurrentUser, session: Session,
                 credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)]):
    await AuthService(session).logout(credentials.credentials)
