import hashlib
import json

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AnimalError
from app.models.animal import Animal, AnimalStatus
from app.repositories.animal import AnimalRepository
from app.repositories.animal_type import get_animal_type
from app.repositories.breed import get_breed
from app.schemas.animal import AnimalCreate, AnimalUpdate
from app.repositories.care_procedure import CareProcedureRepository
from app.services.care_procedure import CareProcedureService
from app.services.notification import NotificationService


def duplicate_key(data: AnimalCreate) -> str:
    def normalize(value: str | None) -> str:
        return " ".join((value or "").casefold().split())

    identity = [normalize(data.name), data.animal_type_id, data.breed_id, data.birth_year,
                normalize(data.owner_name), data.owner_phone]
    return hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()


class AnimalService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = AnimalRepository(session)

    async def get(self, animal_id: int, *, for_update: bool = False) -> Animal:
        animal = await self.repository.get(animal_id, for_update=for_update)
        if animal is None:
            raise AnimalError("Животное не найдено", 404)
        return animal

    async def validate_references(self, data: AnimalCreate) -> None:
        if await get_animal_type(self.session, data.animal_type_id) is None:
            raise AnimalError("Тип животного не найден", 422, "animal_type_id")
        breed = await get_breed(self.session, data.breed_id)
        if breed is None:
            raise AnimalError("Порода не найдена", 422, "breed_id")
        if breed.animal_type_id != data.animal_type_id:
            raise AnimalError("Порода не соответствует выбранному типу животного", 422, "breed_id")

    async def check_duplicate(self, key: str, exclude_id: int | None = None) -> None:
        if await self.repository.find_duplicate(key, exclude_id):
            raise AnimalError("Карточка с такими данными уже существует, в том числе возможно в архиве", 409)

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            # Constraint violations (including concurrent duplicates) are conflicts, never 500s.
            raise AnimalError("Сохранение невозможно: дубликат карточки или конфликт связанных данных", 409) from error

    async def create(self, data: AnimalCreate) -> Animal:
        await self.validate_references(data)
        key = duplicate_key(data)
        await self.check_duplicate(key)
        animal = Animal(**data.model_dump(), duplicate_key=key, status=AnimalStatus.IN_CARE)
        self.repository.add(animal)
        await self.commit()
        return await self.get(animal.id)

    async def update(self, animal_id: int, changes: AnimalUpdate) -> Animal:
        animal = await self.get(animal_id, for_update=True)
        if animal.status == AnimalStatus.ARCHIVED:
            raise AnimalError("Архивная карточка доступна только для просмотра", 409)
        current = {field: getattr(animal, field) for field in AnimalCreate.model_fields}
        data = AnimalCreate.model_validate(current | changes.model_dump(exclude_unset=True))
        await self.validate_references(data)
        key = duplicate_key(data)
        await self.check_duplicate(key, animal_id)
        for field, value in data.model_dump().items():
            setattr(animal, field, value)
        animal.duplicate_key = key
        await self.commit()
        return await self.get(animal_id)

    async def archive(self, animal_id: int) -> Animal:
        return await self.set_archived(animal_id, True)

    async def restore(self, animal_id: int) -> Animal:
        return await self.set_archived(animal_id, False)

    async def set_archived(self, animal_id: int, archived: bool) -> Animal:
        repository = CareProcedureRepository(self.session)
        try:
            await repository.lock_schedule()
            animal = await self.get(animal_id, for_update=True)
            target = AnimalStatus.ARCHIVED if archived else AnimalStatus.IN_CARE
            if animal.status != target:
                procedures = await repository.pending(animal_id=animal_id, suspended=not archived)
                for procedure in procedures:
                    if not archived:
                        await CareProcedureService(self.session).validate_assignment(
                            volunteer_id=procedure.volunteer_id, planned_date=procedure.planned_date,
                            planned_time=procedure.planned_time, duration_minutes=procedure.duration_minutes,
                            exclude_id=procedure.id)
                    procedure.suspended_by_archive = archived
                    procedure.revision += 1
                    await self.session.flush()
                    await NotificationService(self.session).event(procedure, "suspended" if archived else "restored")
                animal.status = target
            await self.commit()
            return await self.get(animal_id)
        except Exception:
            await self.session.rollback()
            raise
