from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import VolunteerError
from app.models.volunteer import Volunteer, VolunteerStatus
from app.repositories.volunteer import VolunteerRepository
from app.schemas.volunteer import VolunteerCreate, VolunteerUpdate


class VolunteerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = VolunteerRepository(session)

    async def get(self, volunteer_id: int, *, for_update: bool = False) -> Volunteer:
        volunteer = await self.repository.get(volunteer_id, for_update=for_update)
        if volunteer is None:
            raise VolunteerError("Волонтёр не найден", 404)
        return volunteer

    async def check_duplicate(self, full_name: str, phone: str, exclude_id: int | None = None) -> None:
        if await self.repository.find_duplicate(full_name, phone, exclude_id):
            raise VolunteerError("Волонтёр с такими ФИО и телефоном уже существует", 409)

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise VolunteerError("Сохранение невозможно: дубликат или некорректные данные", 409) from error

    async def create(self, data: VolunteerCreate) -> Volunteer:
        await self.check_duplicate(data.full_name, data.phone)
        volunteer = Volunteer(**data.model_dump(), status=VolunteerStatus.ACTIVE)
        self.repository.add(volunteer)
        await self.commit()
        return await self.get(volunteer.id)

    async def update(self, volunteer_id: int, changes: VolunteerUpdate) -> Volunteer:
        volunteer = await self.get(volunteer_id, for_update=True)
        current = {field: getattr(volunteer, field) for field in VolunteerCreate.model_fields}
        data = VolunteerCreate.model_validate(current | changes.model_dump(exclude_unset=True))
        await self.check_duplicate(data.full_name, data.phone, volunteer_id)
        for field, value in data.model_dump().items():
            setattr(volunteer, field, value)
        await self.commit()
        return await self.get(volunteer_id)

    async def set_status(self, volunteer_id: int, status: VolunteerStatus) -> Volunteer:
        volunteer = await self.get(volunteer_id, for_update=True)
        volunteer.status = status
        await self.commit()
        return await self.get(volunteer_id)
