from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.care_procedure import CareProcedure, CareProcedureStatus


class CareProcedureRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def with_references(self):
        return (joinedload(CareProcedure.animal), joinedload(CareProcedure.procedure_type),
                joinedload(CareProcedure.volunteer))

    async def list(self, *, status: CareProcedureStatus | None, animal_id: int | None,
                   volunteer_id: int | None, procedure_type_id: int | None,
                   date_from: date | None, date_to: date | None, limit: int, offset: int) -> list[CareProcedure]:
        query = select(CareProcedure).options(*self.with_references())
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

    async def summary(self, today: date) -> tuple[int, int]:
        row = (await self.session.execute(select(
            func.count(CareProcedure.id),
            func.count(CareProcedure.id).filter(CareProcedure.status == CareProcedureStatus.COMPLETED),
        ).where(CareProcedure.planned_date == today))).one()
        return row[0], row[1]
