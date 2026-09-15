from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.dependencies import coordinator
from app.db.session import get_session
from app.models.user import User, RegistrationStatus
from app.schemas.auth import ApproveRequest, RegistrationResponse
from app.services.registration import RegistrationService

router = APIRouter(prefix="/registrations", tags=["registrations"], dependencies=[Depends(coordinator)])
Session = Annotated[AsyncSession, Depends(get_session)]
Coordinator = Annotated[User, Depends(coordinator)]
UserId = Annotated[int, Path(gt=0)]


@router.get("", response_model=list[RegistrationResponse])
async def list_registrations(session: Session, status: RegistrationStatus = RegistrationStatus.PENDING,
                             limit: Annotated[int, Query(ge=1, le=100)] = 51,
                             offset: Annotated[int, Query(ge=0)] = 0):
    return await RegistrationService(session).list(status, limit, offset)


@router.post("/{user_id}/approve", response_model=RegistrationResponse)
async def approve(user_id: UserId, data: ApproveRequest, session: Session, actor: Coordinator):
    return await RegistrationService(session).review(user_id, actor.id, data.role)


@router.post("/{user_id}/reject", response_model=RegistrationResponse)
async def reject(user_id: UserId, session: Session, actor: Coordinator):
    return await RegistrationService(session).review(user_id, actor.id, None)
