from datetime import date

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.care_procedure import CareProcedure, CareProcedureStatus


class CareProcedureRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def with_references(self):
        return (joinedload(CareProcedure.animal), joinedload(CareProcedure.procedure_type),
                joinedload(CareProcedure.volunteer))

    async def lock_schedule(self) -> None:
        # One transaction lock for all schedule mutations, including archive and
        # availability changes. Prevents concurrent check-then-assign races.
        await self.session.execute(text("SELECT pg_advisory_xact_lock(73421901)"))

    async def pending(self, *, volunteer_id: int | None = None, animal_id: int | None = None,
                      suspended: bool = False) -> list[CareProcedure]:
        query = select(CareProcedure).options(*self.with_references()).where(
            CareProcedure.stored_status.in_([CareProcedureStatus.ASSIGNED, CareProcedureStatus.OVERDUE]),
            CareProcedure.suspended_by_archive.is_(suspended),
        ).order_by(CareProcedure.planned_date, CareProcedure.planned_time, CareProcedure.id)
        if volunteer_id is not None:
            query = query.where(CareProcedure.volunteer_id == volunteer_id)
        if animal_id is not None:
            query = query.where(CareProcedure.animal_id == animal_id)
        return list(await self.session.scalars(query))

    async def list(self, *, status: CareProcedureStatus | None, animal_id: int | None,
                   volunteer_id: int | None, procedure_type_id: int | None,
                   date_from: date | None, date_to: date | None, limit: int, offset: int) -> list[CareProcedure]:
        query = select(CareProcedure).options(*self.with_references()).where(CareProcedure.suspended_by_archive.is_(False))
        for column, value in ((CareProcedure.status, status), (CareProcedure.animal_id, animal_id),
                              (CareProcedure.volunteer_id, volunteer_id),
                              (CareProcedure.procedure_type_id, procedure_type_id)):
            if value is not None:
                query = query.where(column == value)
        if date_from is not None:
            query = query.where(CareProcedure.planned_date >= date_from)
        if date_to is not None:
            query = query.where(CareProcedure.planned_date <= date_to)
        query = query.order_by(CareProcedure.planned_date, CareProcedure.planned_time, CareProcedure.id)
        return list(await self.session.scalars(query.limit(limit).offset(offset)))

    async def get(self, procedure_id: int, *, for_update: bool = False) -> CareProcedure | None:
        query = (select(CareProcedure).where(CareProcedure.id == procedure_id)
                 .options(*self.with_references()).execution_options(populate_existing=True))
        if for_update:
            query = query.with_for_update(of=CareProcedure)
        return await self.session.scalar(query)

    def add(self, procedure: CareProcedure) -> None:
        self.session.add(procedure)

    async def count_on_date(self, planned_date: date, volunteer_id: int | None = None) -> int:
        return await self.session.scalar(
            select(func.count(CareProcedure.id)).where(
                CareProcedure.planned_date == planned_date,
                CareProcedure.suspended_by_archive.is_(False),
                *([CareProcedure.volunteer_id == volunteer_id] if volunteer_id is not None else []),
            )
        ) or 0
