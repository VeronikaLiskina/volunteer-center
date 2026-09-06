from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.animal import Animal, AnimalStatus


class AnimalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list(
        self, search: str | None, animal_type_id: int | None,
        status: AnimalStatus | None, limit: int, offset: int,
    ) -> list[Animal]:
        query = select(Animal).options(joinedload(Animal.animal_type), joinedload(Animal.breed))
        if search:
            query = query.where(Animal.name.icontains(search.strip(), autoescape=True))
        if animal_type_id is not None:
            query = query.where(Animal.animal_type_id == animal_type_id)
        if status is not None:
            query = query.where(Animal.status == status)
        return list(await self.session.scalars(query.order_by(Animal.id.desc()).limit(limit).offset(offset)))

    async def get(self, animal_id: int, *, for_update: bool = False) -> Animal | None:
        query = select(Animal).where(Animal.id == animal_id).options(
            joinedload(Animal.animal_type), joinedload(Animal.breed),
        ).execution_options(populate_existing=True)
        if for_update:
            query = query.with_for_update(of=Animal)
        return await self.session.scalar(query)

    async def find_duplicate(self, key: str, exclude_id: int | None = None) -> Animal | None:
        query = select(Animal).where(Animal.duplicate_key == key)
        if exclude_id is not None:
            query = query.where(Animal.id != exclude_id)
        return await self.session.scalar(query)

    def add(self, animal: Animal) -> None:
        self.session.add(animal)

    async def summary(self) -> tuple[int, int, int]:
        row = (await self.session.execute(select(
            func.count(Animal.id),
            func.count(Animal.id).filter(Animal.status == AnimalStatus.IN_CARE),
            func.count(Animal.id).filter(Animal.status == AnimalStatus.ARCHIVED),
        ))).one()
        return row[0], row[1], row[2]
