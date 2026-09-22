from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ProcedureExecutionError
from app.models.care_procedure import CareProcedureStatus
from app.models.procedure_execution import ProcedureExecution
from app.repositories.procedure_execution import ProcedureExecutionRepository
from app.schemas.procedure_execution import (
    ProcedureExecutionCreate,
    ProcedureExecutionUpdate,
)
from app.services.care_procedure import CareProcedureService
from app.models.user import User


class ProcedureExecutionService:
    def __init__(self, session: AsyncSession, actor: User | None = None) -> None:
        self.session = session
        self.actor = actor
        self.repository = ProcedureExecutionRepository(session)

    async def get(
        self, procedure_id: int, *, for_update: bool = False,
    ) -> ProcedureExecution:
        await CareProcedureService(self.session, self.actor).get(procedure_id)
        execution = await self.repository.get_by_procedure(
            procedure_id, for_update=for_update
        )
        if execution is None:
            raise ProcedureExecutionError("Результат выполнения не найден", 404)
        return execution

    async def commit(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ProcedureExecutionError("Услуга уже была выполнена", 409) from error

    async def execute(
        self, procedure_id: int, data: ProcedureExecutionCreate,
    ) -> ProcedureExecution:
        procedure = await CareProcedureService(self.session, self.actor).get(
            procedure_id, for_update=True
        )
        if procedure.status == CareProcedureStatus.COMPLETED:
            raise ProcedureExecutionError("Услуга уже выполнена", 409)
        if procedure.status == CareProcedureStatus.CANCELLED:
            raise ProcedureExecutionError("Отменённую услугу выполнить нельзя", 409)
        if procedure.status not in (
            CareProcedureStatus.ASSIGNED, CareProcedureStatus.OVERDUE,
        ):
            raise ProcedureExecutionError("Услугу с этим статусом выполнить нельзя", 409)
        if await self.repository.get_by_procedure(procedure_id) is not None:
            raise ProcedureExecutionError("Для услуги уже существует выполнение", 409)

        execution = ProcedureExecution(
            care_procedure_id=procedure_id, **data.model_dump()
        )
        self.repository.add(execution)
        procedure.status = CareProcedureStatus.COMPLETED
        await self.commit()
        return await self.get(procedure_id)

    async def update(
        self, procedure_id: int, changes: ProcedureExecutionUpdate,
    ) -> ProcedureExecution:
        execution = await self.get(procedure_id, for_update=True)
        for field, value in changes.model_dump(exclude_unset=True).items():
            setattr(execution, field, value)
        await self.commit()
        return await self.get(procedure_id)
