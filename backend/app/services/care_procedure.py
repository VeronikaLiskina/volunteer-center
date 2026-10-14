from datetime import date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import CareProcedureError
from app.models.animal import AnimalStatus
from app.models.care_procedure import CareProcedure, CareProcedureStatus
from app.models.volunteer import VolunteerStatus
from app.models.user import User, UserRole
from app.repositories.animal import AnimalRepository
from app.repositories.care_procedure import CareProcedureRepository
from app.repositories.care_procedure_type import get_care_procedure_type
from app.repositories.volunteer import VolunteerRepository
from app.repositories.procedure_execution import ProcedureExecutionRepository
from app.schemas.care_procedure import CareProcedureCreate, CareProcedureUpdate, CareProcedureSummaryResponse
from app.services.notification import NotificationService


class CareProcedureService:
    def __init__(self, session: AsyncSession, actor: User | None = None) -> None:
        self.session = session
        self.actor = actor
        self.repository = CareProcedureRepository(session)

    async def get(self, procedure_id: int, *, for_update: bool = False) -> CareProcedure:
        procedure = await self.repository.get(procedure_id, for_update=for_update)
        if procedure is None:
            raise CareProcedureError("Услуга не найдена", 404)
        if self.actor and self.actor.role == UserRole.VOLUNTEER and procedure.volunteer_id != self.actor.volunteer_id:
            raise HTTPException(404, "Услуга не найдена")
        return procedure

    async def list(self, **filters):
        if self.actor and self.actor.role == UserRole.VOLUNTEER:
            filters["volunteer_id"] = self.actor.volunteer_id
        return await self.repository.list(**filters)

    async def summary(self) -> CareProcedureSummaryResponse:
        volunteer_id = self.actor.volunteer_id if self.actor and self.actor.role == UserRole.VOLUNTEER else None
        return CareProcedureSummaryResponse(
            today_total=await self.repository.count_on_date(date.today(), volunteer_id),
            today_completed=await ProcedureExecutionRepository(self.session).count_on_date(date.today(), volunteer_id),
        )

    async def validate_references(
        self, *, animal_id: int, volunteer_id: int, procedure_type_id: int,
    ) -> None:
        animal = await AnimalRepository(self.session).get(animal_id)
        if animal is None:
            raise CareProcedureError("Животное не найдено", 422, "animal_id")
        if animal.status == AnimalStatus.ARCHIVED:
            raise CareProcedureError("Нельзя назначить услугу архивному животному", 409, "animal_id")
        volunteer = await VolunteerRepository(self.session).get(volunteer_id)
        if volunteer is None:
            raise CareProcedureError("Волонтёр не найден", 422, "volunteer_id")
        if volunteer.status != VolunteerStatus.ACTIVE:
            raise CareProcedureError("Можно назначить только активного волонтёра", 409, "volunteer_id")
        if await get_care_procedure_type(self.session, procedure_type_id) is None:
            raise CareProcedureError("Тип услуги не найден", 422, "procedure_type_id")

    @staticmethod
    def availability_error(volunteer, planned_date, planned_time, duration_minutes) -> str | None:
        start = datetime.combine(planned_date, planned_time)
        end = start + timedelta(minutes=duration_minutes)
        lower = datetime.combine(planned_date, volunteer.available_from) if volunteer.available_from else None
        upper = datetime.combine(planned_date, volunteer.available_to) if volunteer.available_to else None
        if (lower and start < lower) or (upper and end > upper) or (
            (lower or upper) and end.date() != start.date() and end.time() != datetime.min.time()
        ):
            return "Время услуги выходит за пределы доступности волонтёра"
        return None

    async def validate_assignment(self, *, volunteer_id, planned_date, planned_time, duration_minutes,
                                  exclude_id=None) -> None:
        volunteer = await VolunteerRepository(self.session).get(volunteer_id)
        if volunteer is None or volunteer.status != VolunteerStatus.ACTIVE:
            raise CareProcedureError("Можно назначить только активного волонтёра", 409, "volunteer_id")
        reason = self.availability_error(volunteer, planned_date, planned_time, duration_minutes)
        if reason:
            raise CareProcedureError(reason, 409, "volunteer_id")
        start = datetime.combine(planned_date, planned_time)
        end = start + timedelta(minutes=duration_minutes)
        for other in await self.repository.pending(volunteer_id=volunteer_id):
            if other.id == exclude_id:
                continue
            other_start = datetime.combine(other.planned_date, other.planned_time)
            if start < other_start + timedelta(minutes=other.duration_minutes) and other_start < end:
                raise CareProcedureError("Волонтёр занят другой услугой в это время", 409, "volunteer_id")

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise CareProcedureError("Не удалось сохранить услугу из-за конфликта данных", 409) from error

    async def flush(self) -> None:
        try:
            await self.session.flush()
        except IntegrityError as error:
            await self.session.rollback()
            raise CareProcedureError("Не удалось сохранить услугу из-за конфликта данных", 409) from error

    async def create(self, data: CareProcedureCreate) -> CareProcedure:
        await self.repository.lock_schedule()
        await self.validate_references(
            animal_id=data.animal_id,
            volunteer_id=data.volunteer_id,
            procedure_type_id=data.procedure_type_id,
        )
        await self.validate_assignment(volunteer_id=data.volunteer_id, planned_date=data.planned_date,
                                       planned_time=data.planned_time, duration_minutes=data.duration_minutes)
        procedure = CareProcedure(
            **data.model_dump(), status=CareProcedureStatus.ASSIGNED,
        )
        self.repository.add(procedure)
        await self.flush()
        procedure = await self.get(procedure.id)
        await NotificationService(self.session).event(procedure, "assigned")
        await self.commit()
        return await self.get(procedure.id)

    async def update(self, procedure_id: int, changes: CareProcedureUpdate) -> CareProcedure:
        await self.repository.lock_schedule()
        procedure = await self.get(procedure_id, for_update=True)
        if procedure.status == CareProcedureStatus.COMPLETED or await ProcedureExecutionRepository(self.session).get_by_procedure(procedure_id):
            raise CareProcedureError("Выполненное назначение нельзя изменять", 409)
        if procedure.suspended_by_archive:
            if changes.model_dump(exclude_unset=True) == {"status": CareProcedureStatus.CANCELLED}:
                procedure.status = CareProcedureStatus.CANCELLED
                procedure.suspended_by_archive = False
                procedure.revision += 1
                await self.commit()
                return await self.get(procedure_id)
            raise CareProcedureError("Назначение приостановлено: восстановите животное из архива", 409)
        previous_volunteer_id = procedure.volunteer_id
        values = {
            "animal_id": procedure.animal_id,
            "volunteer_id": procedure.volunteer_id,
            "procedure_type_id": procedure.procedure_type_id,
            "planned_date": procedure.planned_date,
            "planned_time": procedure.planned_time,
            "duration_minutes": procedure.duration_minutes,
        } | changes.model_dump(exclude_unset=True)
        await self.validate_references(
            animal_id=values["animal_id"],
            volunteer_id=values["volunteer_id"],
            procedure_type_id=values["procedure_type_id"],
        )
        if values.get("status", procedure.status) != CareProcedureStatus.CANCELLED:
            await self.validate_assignment(volunteer_id=values["volunteer_id"], planned_date=values["planned_date"],
                planned_time=values["planned_time"], duration_minutes=values["duration_minutes"], exclude_id=procedure_id)
        changed = any(getattr(procedure, field) != value for field, value in changes.model_dump(exclude_unset=True).items())
        for field, value in changes.model_dump(exclude_unset=True).items():
            setattr(procedure, field, value)
        if procedure.stored_status in (CareProcedureStatus.ASSIGNED, CareProcedureStatus.OVERDUE):
            procedure.status = CareProcedureStatus.ASSIGNED
        if changed:
            procedure.revision += 1
            await self.flush()
            procedure = await self.get(procedure.id)
            kind = "cancelled" if procedure.status == CareProcedureStatus.CANCELLED else "changed"
            await NotificationService(self.session).event(procedure, kind, previous_volunteer_id)
        await self.commit()
        return await self.get(procedure_id)
