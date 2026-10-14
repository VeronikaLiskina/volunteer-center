from datetime import datetime, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.care_procedure import CareProcedure, CareProcedureStatus
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.repositories.care_procedure import CareProcedureRepository


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def recipients(self, volunteer_ids: set[int]) -> list[User]:
        return list(await self.session.scalars(select(User).where(User.is_active.is_(True), or_(
            User.role == UserRole.COORDINATOR, User.volunteer_id.in_(volunteer_ids)))))

    async def add_event(self, user_id: int, procedure: CareProcedure, kind: str, message: str):
        await self.session.execute(insert(Notification).values(
            user_id=user_id, procedure_id=procedure.id, kind=kind, message=message,
            event_key=f"{procedure.id}:{procedure.revision}:{kind}",
        ).on_conflict_do_nothing(constraint="uq_notification_event"))

    async def scheduled(self, user: User, now: datetime) -> list[CareProcedure]:
        query = select(CareProcedure).options(*CareProcedureRepository(self.session).with_references()).where(
            CareProcedure.status.in_([CareProcedureStatus.ASSIGNED, CareProcedureStatus.OVERDUE]),
            CareProcedure.suspended_by_archive.is_(False),
            CareProcedure.planned_date + CareProcedure.planned_time <= now + timedelta(hours=24),
        )
        if user.role == UserRole.VOLUNTEER:
            query = query.where(CareProcedure.volunteer_id == user.volunteer_id)
        return list(await self.session.scalars(query))

    async def list(self, user_id: int, limit: int, offset: int):
        return list(await self.session.scalars(select(Notification).where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).offset(offset)))

    async def unread_count(self, user_id: int) -> int:
        return await self.session.scalar(select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.is_read.is_(False))) or 0

    async def mark_read(self, user_id: int, notification_id: int) -> bool:
        result = await self.session.execute(update(Notification).where(
            Notification.user_id == user_id, Notification.id == notification_id).values(is_read=True))
        return result.rowcount > 0
