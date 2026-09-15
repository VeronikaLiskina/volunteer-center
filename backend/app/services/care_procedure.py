from datetime import date

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
            raise CareProcedureError("Процедура не найдена", 404)
        if self.actor and self.actor.role == UserRole.VOLUNTEER and procedure.volunteer_id != self.actor.volunteer_id:
            raise HTTPException(404, "Процедура не найдена")
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
            raise CareProcedureError("Нельзя назначить процедуру архивному животному", 409, "animal_id")
        volunteer = await VolunteerRepository(self.session).get(volunteer_id)
        if volunteer is None:
            raise CareProcedureError("Волонтёр не найден", 422, "volunteer_id")
        if volunteer.status != VolunteerStatus.ACTIVE:
            raise CareProcedureError("Можно назначить только активного волонтёра", 409, "volunteer_id")
        if await get_care_procedure_type(self.session, procedure_type_id) is None:
            raise CareProcedureError("Тип процедуры не найден", 422, "procedure_type_id")

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise CareProcedureError("Не удалось сохранить процедуру из-за конфликта данных", 409) from error

    async def flush(self) -> None:
        try:
            await self.session.flush()
        except IntegrityError as error:
            await self.session.rollback()
            raise CareProcedureError("Не удалось сохранить процедуру из-за конфликта данных", 409) from error

    async def create(self, data: CareProcedureCreate) -> CareProcedure:
        await self.validate_references(
            animal_id=data.animal_id,
            volunteer_id=data.volunteer_id,
            procedure_type_id=data.procedure_type_id,
        )
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
        procedure = await self.get(procedure_id, for_update=True)
        if procedure.status == CareProcedureStatus.COMPLETED:
            raise CareProcedureError("Выполненное назначение нельзя изменять", 409)
        previous_volunteer_id = procedure.volunteer_id
        values = {
            "animal_id": procedure.animal_id,
            "volunteer_id": procedure.volunteer_id,
            "procedure_type_id": procedure.procedure_type_id,
        } | changes.model_dump(exclude_unset=True)
        await self.validate_references(
            animal_id=values["animal_id"],
            volunteer_id=values["volunteer_id"],
            procedure_type_id=values["procedure_type_id"],
        )
        changed = any(getattr(procedure, field) != value for field, value in changes.model_dump(exclude_unset=True).items())
        for field, value in changes.model_dump(exclude_unset=True).items():
            setattr(procedure, field, value)
        if changed:
            procedure.revision += 1
            await self.flush()
            procedure = await self.get(procedure.id)
            kind = "cancelled" if procedure.status == CareProcedureStatus.CANCELLED else "changed"
            await NotificationService(self.session).event(procedure, kind, previous_volunteer_id)
        await self.commit()
        return await self.get(procedure_id)
