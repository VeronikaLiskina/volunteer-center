from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.care_procedure_type import CareProcedureType


async def list_care_procedure_types(session: AsyncSession) -> list[CareProcedureType]:
    return list(await session.scalars(select(CareProcedureType).order_by(CareProcedureType.name)))


async def get_care_procedure_type(session: AsyncSession, type_id: int) -> CareProcedureType | None:
    return await session.get(CareProcedureType, type_id)
