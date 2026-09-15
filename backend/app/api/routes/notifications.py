from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.db.session import get_session
from app.schemas.notification import NotificationList
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=NotificationList)
async def notifications(user: CurrentUser, session: Session,
                        limit: Annotated[int, Query(ge=1, le=100)] = 20,
                        offset: Annotated[int, Query(ge=0)] = 0):
    return await NotificationService(session).list(user, limit, offset)


@router.patch("/{notification_id}/read", status_code=204)
async def mark_read(notification_id: Annotated[int, Path(gt=0)], user: CurrentUser, session: Session):
    await NotificationService(session).mark_read(user, notification_id)
