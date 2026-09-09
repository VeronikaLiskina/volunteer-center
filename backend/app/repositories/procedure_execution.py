from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.procedure_execution import ProcedureExecution


class ProcedureExecutionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_procedure(
        self, procedure_id: int, *, for_update: bool = False,
    ) -> ProcedureExecution | None:
        query = (
            select(ProcedureExecution)
            .where(ProcedureExecution.care_procedure_id == procedure_id)
            .execution_options(populate_existing=True)
        )
        if for_update:
            query = query.with_for_update()
        return await self.session.scalar(query)

    async def count_on_date(self, execution_date: date) -> int:
        return await self.session.scalar(
            select(func.count(ProcedureExecution.id)).where(
                ProcedureExecution.execution_date == execution_date
            )
        ) or 0

    def add(self, execution: ProcedureExecution) -> None:
        self.session.add(execution)
