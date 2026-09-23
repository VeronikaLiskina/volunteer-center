from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, bearer
from app.db.session import get_session
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.auth import AuthService
from app.schemas.auth import RegisterRequest
from app.services.registration import RegistrationService
from app.schemas.auth import PasswordResetRequest, PasswordResetResponse, PasswordResetConfirm
from app.services.password_reset import PasswordResetService

router = APIRouter(prefix="/auth", tags=["auth"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.post("/register", status_code=201)
async def register(data: RegisterRequest, session: Session):
    await RegistrationService(session).register(data)
    return {"message": "Заявка отправлена. Дождитесь подтверждения координатором."}


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, session: Session):
    return await AuthService(session).login(data.phone, data.password)


@router.post("/password-reset/request", response_model=PasswordResetResponse)
async def request_password_reset(data: PasswordResetRequest, request: Request, session: Session):
    ip = request.client.host if request.client else "unknown"
    return await PasswordResetService(session).request_code(data.phone, ip)


@router.post("/password-reset/confirm", status_code=204)
async def confirm_password_reset(data: PasswordResetConfirm, request: Request, session: Session):
    ip = request.client.host if request.client else "unknown"
    await PasswordResetService(session).confirm(data.request_id, data.code, data.password, ip)


@router.get("/me", response_model=UserResponse)
async def me(user: CurrentUser):
    return user


@router.post("/logout", status_code=204)
async def logout(user: CurrentUser, session: Session,
                 credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)]):
    await AuthService(session).logout(credentials.credentials)
