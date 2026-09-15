from datetime import date, datetime, timedelta, timezone

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.animal import Animal, AnimalStatus
from app.models.care_procedure import CareProcedure, CareProcedureStatus
from app.models.care_procedure_type import CareProcedureType
from app.models.procedure_execution import ProcedureExecution
from app.models.volunteer import Volunteer, VolunteerStatus
from app.models.report_snapshot import ReportSnapshot


class AnalyticsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def save_snapshot(self, report_id: str, user_id: int, data: dict) -> None:
        now = datetime.now(timezone.utc)
        await self.session.execute(delete(ReportSnapshot).where(ReportSnapshot.expires_at <= now))
        self.session.add(ReportSnapshot(id=report_id, user_id=user_id, data=data, expires_at=now + timedelta(hours=24)))

    async def get_snapshot(self, report_id: str, user_id: int) -> dict | None:
        return await self.session.scalar(select(ReportSnapshot.data).where(
            ReportSnapshot.id == report_id, ReportSnapshot.user_id == user_id,
            ReportSnapshot.expires_at > datetime.now(timezone.utc)))

    @staticmethod
    def filters(date_from: date, date_to: date, procedure_type_id: int | None):
        conditions = [CareProcedure.planned_date.between(date_from, date_to)]
        if procedure_type_id is not None:
            conditions.append(CareProcedure.procedure_type_id == procedure_type_id)
        return conditions

    async def filtered_details(self, date_from: date, date_to: date, procedure_type_id: int | None):
        conditions = self.filters(date_from, date_to, procedure_type_id)
        month = func.to_char(CareProcedure.planned_date, "YYYY-MM")
        monthly = dict((await self.session.execute(select(month, func.count(ProcedureExecution.id))
            .select_from(CareProcedure).join(ProcedureExecution)
            .where(*conditions).group_by(month).order_by(month))).all())
        distribution = (await self.session.execute(select(CareProcedureType.id, CareProcedureType.name, func.count(CareProcedure.id))
            .join(CareProcedure).where(*conditions).group_by(CareProcedureType.id, CareProcedureType.name)
            .order_by(CareProcedureType.name))).all()
        activity = (await self.session.execute(select(Volunteer.id, Volunteer.full_name, func.count(ProcedureExecution.id))
            .select_from(Volunteer).join(CareProcedure).outerjoin(ProcedureExecution).where(*conditions)
            .group_by(Volunteer.id, Volunteer.full_name).order_by(func.count(ProcedureExecution.id).desc(), Volunteer.full_name))).all()
        return monthly, distribution, activity

    async def animal_counts(self) -> tuple[int, int, int]:
        return (await self.session.execute(select(
            func.count(Animal.id),
            func.count(Animal.id).filter(Animal.status == AnimalStatus.IN_CARE),
            func.count(Animal.id).filter(Animal.status == AnimalStatus.ARCHIVED),
        ))).one()

    async def volunteer_counts(self) -> tuple[int, int, int]:
        return (await self.session.execute(select(
            func.count(Volunteer.id),
            func.count(Volunteer.id).filter(Volunteer.status == VolunteerStatus.ACTIVE),
            func.count(Volunteer.id).filter(Volunteer.status == VolunteerStatus.INACTIVE),
        ))).one()

    async def procedure_counts(self) -> tuple[int, int, int, int, int]:
        return (await self.session.execute(select(
            func.count(CareProcedure.id),
            func.count(CareProcedure.id).filter(CareProcedure.status == CareProcedureStatus.ASSIGNED),
            func.count(CareProcedure.id).filter(CareProcedure.status == CareProcedureStatus.COMPLETED),
            func.count(CareProcedure.id).filter(CareProcedure.status == CareProcedureStatus.CANCELLED),
            func.count(CareProcedure.id).filter(CareProcedure.status == CareProcedureStatus.OVERDUE),
        ))).one()

    async def monthly_executions(self, since: date) -> dict[str, int]:
        month = func.to_char(ProcedureExecution.execution_date, "YYYY-MM")
        rows = await self.session.execute(
            select(month, func.count(ProcedureExecution.id))
            .where(ProcedureExecution.execution_date >= since)
            .group_by(month)
            .order_by(month)
        )
        return {key: count for key, count in rows}

    async def procedure_type_distribution(self) -> list[tuple[int, str, int]]:
        count = func.count(CareProcedure.id)
        rows = await self.session.execute(
            select(CareProcedureType.id, CareProcedureType.name, count)
            .join(CareProcedure, CareProcedure.procedure_type_id == CareProcedureType.id, isouter=True)
            .group_by(CareProcedureType.id, CareProcedureType.name)
            .order_by(count.desc(), CareProcedureType.name)
        )
        return [(type_id, name, total) for type_id, name, total in rows if total]

    async def top_volunteers(self, limit: int = 5) -> list[tuple[int, str, int]]:
        count = func.count(ProcedureExecution.id)
        rows = await self.session.execute(
            select(Volunteer.id, Volunteer.full_name, count)
            .join(CareProcedure, CareProcedure.volunteer_id == Volunteer.id)
            .join(ProcedureExecution, ProcedureExecution.care_procedure_id == CareProcedure.id)
            .group_by(Volunteer.id, Volunteer.full_name)
            .order_by(count.desc(), Volunteer.full_name)
            .limit(limit)
        )
        return list(rows)

    async def report_counts(self, date_from: date, date_to: date, procedure_type_id: int | None = None) -> dict[str, int]:
        condition = CareProcedure.planned_date.between(date_from, date_to)
        status = case((
            (CareProcedure.status == CareProcedureStatus.ASSIGNED)
            & (CareProcedure.planned_date + CareProcedure.planned_time < datetime.now()),
            CareProcedureStatus.OVERDUE.value), else_=CareProcedure.status)
        row = (await self.session.execute(select(
            func.count(CareProcedure.id).filter(condition),
            func.count(CareProcedure.id).filter(condition, status == CareProcedureStatus.ASSIGNED),
            func.count(CareProcedure.id).filter(condition, status == CareProcedureStatus.COMPLETED),
            func.count(CareProcedure.id).filter(condition, status == CareProcedureStatus.CANCELLED),
            func.count(CareProcedure.id).filter(condition, status == CareProcedureStatus.OVERDUE),
            func.count(func.distinct(CareProcedure.animal_id)).filter(condition),
            func.count(func.distinct(CareProcedure.volunteer_id)).filter(condition),
        ).where(*self.filters(date_from, date_to, procedure_type_id)))).one()
        return dict(zip(
            ("total", "assigned", "completed", "cancelled", "overdue", "animals", "volunteers"),
            row,
            strict=True,
        ))
