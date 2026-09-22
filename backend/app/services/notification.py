from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.care_procedure import CareProcedure
from app.models.user import User
from app.repositories.notification import NotificationRepository
from app.schemas.notification import NotificationList, NotificationResponse


class NotificationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = NotificationRepository(session)

    @staticmethod
    def message(procedure: CareProcedure, kind: str) -> str:
        labels = {"assigned": "Назначена услуга", "changed": "Услуга изменена",
                  "cancelled": "Услуга отменена", "reassigned": "Услуга передана другому волонтёру",
                  "upcoming": "Услуга в ближайшие 24 часа", "overdue": "Услуга просрочена"}
        return (f"{labels[kind]}: {procedure.procedure_type.name}, {procedure.animal.name}. "
                f"{procedure.planned_date:%d.%m.%Y} {procedure.planned_time:%H:%M}")[:500]

    async def event(self, procedure: CareProcedure, kind: str, previous_volunteer_id: int | None = None):
        ids = {procedure.volunteer_id}
        if previous_volunteer_id is not None:
            ids.add(previous_volunteer_id)
        for user in await self.repository.recipients(ids):
            user_kind = kind
            if previous_volunteer_id != procedure.volunteer_id:
                if user.volunteer_id == previous_volunteer_id and previous_volunteer_id is not None:
                    user_kind = "reassigned"
                elif user.volunteer_id == procedure.volunteer_id and kind == "changed":
                    user_kind = "assigned"
            await self.repository.add_event(user.id, procedure, user_kind, self.message(procedure, user_kind))

    async def list(self, user: User, limit: int = 20, offset: int = 0) -> NotificationList:
        now = datetime.now()
        for procedure in await self.repository.scheduled(user, now):
            planned = datetime.combine(procedure.planned_date, procedure.planned_time)
            kind = "overdue" if planned < now or procedure.status == "overdue" else "upcoming"
            await self.repository.add_event(user.id, procedure, kind, self.message(procedure, kind))
        await self.session.commit()
        return NotificationList(
            items=[NotificationResponse.model_validate(item) for item in await self.repository.list(user.id, limit, offset)],
            unread_count=await self.repository.unread_count(user.id),
        )

    async def mark_read(self, user: User, notification_id: int):
        if not await self.repository.mark_read(user.id, notification_id):
            raise HTTPException(404, "Уведомление не найдено")
        await self.session.commit()
