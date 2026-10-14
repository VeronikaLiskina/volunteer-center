import hashlib

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError

from app.core.errors import VolunteerError, CareProcedureError
from app.models.volunteer import Volunteer, VolunteerStatus
from app.repositories.volunteer import VolunteerRepository
from app.schemas.volunteer import VolunteerCreate, VolunteerUpdate, VolunteerDeactivate
from app.schemas.care_procedure import DeactivationAssignment, CareProcedureResponse
from app.repositories.care_procedure import CareProcedureRepository
from app.services.care_procedure import CareProcedureService
from app.services.notification import NotificationService


def volunteer_duplicate_key(full_name: str, phone: str) -> str:
    normalized_name = " ".join(full_name.casefold().split())
    return hashlib.sha256(f"{normalized_name}\0{phone}".encode()).hexdigest()


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
        key = volunteer_duplicate_key(full_name, phone)
        if await self.repository.find_duplicate(key, exclude_id):
            raise VolunteerError("Волонтёр с такими ФИО и телефоном уже существует", 409)

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise VolunteerError("Сохранение невозможно: дубликат или некорректные данные", 409) from error

    async def create(self, data: VolunteerCreate) -> Volunteer:
        await self.check_duplicate(data.full_name, data.phone)
        volunteer = Volunteer(**data.model_dump(), status=VolunteerStatus.ACTIVE,
                              duplicate_key=volunteer_duplicate_key(data.full_name, data.phone))
        self.repository.add(volunteer)
        await self.commit()
        return await self.get(volunteer.id)

    async def update(self, volunteer_id: int, changes: VolunteerUpdate) -> Volunteer:
        await CareProcedureRepository(self.session).lock_schedule()
        volunteer = await self.get(volunteer_id, for_update=True)
        current = {field: getattr(volunteer, field) for field in VolunteerCreate.model_fields}
        try:
            data = VolunteerCreate.model_validate(current | changes.model_dump(exclude_unset=True))
        except ValidationError as error:
            raise VolunteerError("Начало доступности должно быть раньше окончания", 422) from error
        for procedure in await CareProcedureRepository(self.session).pending(volunteer_id=volunteer_id):
            if CareProcedureService.availability_error(data, procedure.planned_date, procedure.planned_time, procedure.duration_minutes):
                raise VolunteerError("Новая доступность несовместима с назначенными услугами. Сначала переназначьте их", 409)
        await self.check_duplicate(data.full_name, data.phone, volunteer_id)
        for field, value in data.model_dump().items():
            setattr(volunteer, field, value)
        volunteer.duplicate_key = volunteer_duplicate_key(data.full_name, data.phone)
        await self.commit()
        return await self.get(volunteer_id)

    async def set_status(self, volunteer_id: int, status: VolunteerStatus) -> Volunteer:
        if status == VolunteerStatus.INACTIVE:
            return await self.deactivate(volunteer_id, VolunteerDeactivate())
        await CareProcedureRepository(self.session).lock_schedule()
        volunteer = await self.get(volunteer_id, for_update=True)
        volunteer.status = status
        await self.commit()
        return await self.get(volunteer_id)

    async def deactivation_assignments(self, volunteer_id: int) -> list[DeactivationAssignment]:
        await self.get(volunteer_id)
        service = CareProcedureService(self.session)
        candidates = await self.repository.list_active()
        result = []
        for procedure in await service.repository.pending(volunteer_id=volunteer_id):
            suitable = []
            for volunteer in candidates:
                if volunteer.id == volunteer_id:
                    continue
                try:
                    await service.validate_assignment(volunteer_id=volunteer.id, planned_date=procedure.planned_date,
                        planned_time=procedure.planned_time, duration_minutes=procedure.duration_minutes)
                except CareProcedureError:
                    continue
                suitable.append(volunteer)
            result.append(DeactivationAssignment(procedure=CareProcedureResponse.model_validate(procedure), candidates=suitable))
        return result

    async def deactivate(self, volunteer_id: int, data: VolunteerDeactivate) -> Volunteer:
        repository = CareProcedureRepository(self.session)
        try:
            await repository.lock_schedule()
            volunteer = await self.get(volunteer_id, for_update=True)
            if volunteer.status == VolunteerStatus.INACTIVE:
                await self.commit()
                return await self.get(volunteer_id)
            pending = await repository.pending(volunteer_id=volunteer_id)
            replacements = {item.procedure_id: item.volunteer_id for item in data.reassignments}
            if len(replacements) != len(data.reassignments) or set(replacements) != {item.id for item in pending}:
                raise VolunteerError("Выберите замену для каждой актуальной услуги. Обновите список назначений", 409)
            service = CareProcedureService(self.session)
            for procedure in pending:
                replacement_id = replacements[procedure.id]
                if replacement_id == volunteer_id:
                    raise VolunteerError("Выберите другого волонтёра", 409)
                await service.validate_assignment(volunteer_id=replacement_id, planned_date=procedure.planned_date,
                    planned_time=procedure.planned_time, duration_minutes=procedure.duration_minutes)
                procedure.volunteer_id = replacement_id
                procedure.revision += 1
                await self.session.flush()
                procedure = await repository.get(procedure.id)
                await NotificationService(self.session).event(procedure, "changed", volunteer_id)
            volunteer.status = VolunteerStatus.INACTIVE
            await self.commit()
            return await self.get(volunteer_id)
        except Exception:
            await self.session.rollback()
            raise
