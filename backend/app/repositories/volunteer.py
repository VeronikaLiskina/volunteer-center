from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.volunteer import Volunteer, VolunteerStatus


class VolunteerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(
        self, search: str | None, status: VolunteerStatus | None, limit: int, offset: int,
    ) -> list[Volunteer]:
        query = select(Volunteer)
        if search:
            query = query.where(Volunteer.full_name.icontains(search.strip(), autoescape=True))
        if status is not None:
            query = query.where(Volunteer.status == status)
        return list(await self.session.scalars(
            query.order_by(Volunteer.full_name, Volunteer.id).limit(limit).offset(offset),
        ))

    async def list_active(self) -> list[Volunteer]:
        return list(await self.session.scalars(
            select(Volunteer).where(Volunteer.status == VolunteerStatus.ACTIVE)
            .order_by(Volunteer.full_name, Volunteer.id),
        ))

    async def get(self, volunteer_id: int, *, for_update: bool = False) -> Volunteer | None:
        query = select(Volunteer).where(Volunteer.id == volunteer_id).execution_options(populate_existing=True)
        if for_update:
            query = query.with_for_update(of=Volunteer)
        return await self.session.scalar(query)

    async def find_duplicate(
        self, full_name: str, phone: str, exclude_id: int | None = None,
    ) -> Volunteer | None:
        query = select(Volunteer).where(
            func.lower(Volunteer.full_name) == full_name.casefold(),
            Volunteer.phone == phone,
        )
        if exclude_id is not None:
            query = query.where(Volunteer.id != exclude_id)
        return await self.session.scalar(query)

    async def summary(self) -> tuple[int, int, int]:
        row = (await self.session.execute(select(
            func.count(Volunteer.id),
            func.count(Volunteer.id).filter(Volunteer.status == VolunteerStatus.ACTIVE),
            func.count(Volunteer.id).filter(Volunteer.status == VolunteerStatus.INACTIVE),
        ))).one()
        return row[0], row[1], row[2]

    def add(self, volunteer: Volunteer) -> None:
        self.session.add(volunteer)
