from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import CareProcedureError
from app.models.animal import AnimalStatus
from app.models.care_procedure import CareProcedure
from app.models.volunteer import VolunteerStatus
from app.repositories.animal import AnimalRepository
from app.repositories.care_procedure import CareProcedureRepository
from app.repositories.care_procedure_type import get_care_procedure_type
from app.repositories.volunteer import VolunteerRepository
from app.schemas.care_procedure import CareProcedureCreate, CareProcedureUpdate


class CareProcedureService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = CareProcedureRepository(session)

    async def get(self, procedure_id: int, *, for_update: bool = False) -> CareProcedure:
        procedure = await self.repository.get(procedure_id, for_update=for_update)
        if procedure is None:
            raise CareProcedureError("Процедура не найдена", 404)
        return procedure

    async def validate_references(self, data: CareProcedureCreate) -> None:
        animal = await AnimalRepository(self.session).get(data.animal_id)
        if animal is None:
            raise CareProcedureError("Животное не найдено", 422, "animal_id")
        if animal.status == AnimalStatus.ARCHIVED:
            raise CareProcedureError("Нельзя назначить процедуру архивному животному", 409, "animal_id")
        volunteer = await VolunteerRepository(self.session).get(data.volunteer_id)
        if volunteer is None:
            raise CareProcedureError("Волонтёр не найден", 422, "volunteer_id")
        if volunteer.status != VolunteerStatus.ACTIVE:
            raise CareProcedureError("Можно назначить только активного волонтёра", 409, "volunteer_id")
        if await get_care_procedure_type(self.session, data.procedure_type_id) is None:
            raise CareProcedureError("Тип процедуры не найден", 422, "procedure_type_id")

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise CareProcedureError("Не удалось сохранить процедуру из-за конфликта данных", 409) from error

    async def create(self, data: CareProcedureCreate) -> CareProcedure:
        await self.validate_references(data)
        procedure = CareProcedure(**data.model_dump())
        self.repository.add(procedure)
        await self.commit()
        return await self.get(procedure.id)

    async def update(self, procedure_id: int, changes: CareProcedureUpdate) -> CareProcedure:
        procedure = await self.get(procedure_id, for_update=True)
        current = {field: getattr(procedure, field) for field in CareProcedureCreate.model_fields}
        data = CareProcedureCreate.model_validate(current | changes.model_dump(exclude_unset=True))
        await self.validate_references(data)
        for field, value in data.model_dump().items():
            setattr(procedure, field, value)
        await self.commit()
        return await self.get(procedure_id)
