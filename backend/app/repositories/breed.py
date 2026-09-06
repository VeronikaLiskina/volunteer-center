from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.breed import Breed


async def list_breeds(session: AsyncSession, animal_type_id: int | None = None) -> list[Breed]:
    query = select(Breed).order_by(Breed.name)
    if animal_type_id is not None:
        query = query.where(Breed.animal_type_id == animal_type_id)
    return list(await session.scalars(query))


async def get_breed(session: AsyncSession, breed_id: int) -> Breed | None:
    return await session.get(Breed, breed_id)
