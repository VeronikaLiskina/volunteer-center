from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.animal_type import AnimalType


async def list_animal_types(session: AsyncSession) -> list[AnimalType]:
    return list(await session.scalars(select(AnimalType).order_by(AnimalType.name)))


async def get_animal_type(session: AsyncSession, type_id: int) -> AnimalType | None:
    return await session.get(AnimalType, type_id)
