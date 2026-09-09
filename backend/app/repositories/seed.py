from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.animal_type import AnimalType
from app.models.breed import Breed
from app.models.care_procedure_type import CareProcedureType


# Sample dictionary only. Weight ranges are intentionally unspecified, not medical advice.
INITIAL_BREEDS: dict[str, tuple[str, ...]] = {
    "Кошка": ("Беспородная", "Сиамская", "Британская короткошёрстная", "Мейн-кун"),
    "Собака": ("Беспородная", "Немецкая овчарка", "Лабрадор", "Сенбернар"),
    "Птица": ("Без породы",),
    "Грызун": ("Без породы",),
}

INITIAL_CARE_PROCEDURE_TYPES = ("Кормление", "Выгул", "Уборка", "Обработка")


async def seed_dictionaries(session: AsyncSession) -> None:
    for name, breeds in INITIAL_BREEDS.items():
        await session.execute(insert(AnimalType).values(name=name).on_conflict_do_nothing())
        type_id = await session.scalar(select(AnimalType.id).where(AnimalType.name == name))
        for breed_name in breeds:
            await session.execute(
                insert(Breed).values(animal_type_id=type_id, name=breed_name).on_conflict_do_nothing()
            )


async def seed_care_procedure_types(session: AsyncSession) -> None:
    for name in INITIAL_CARE_PROCEDURE_TYPES:
        await session.execute(
            insert(CareProcedureType).values(name=name).on_conflict_do_nothing()
        )
