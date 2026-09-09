from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.care_procedure_type import CareProcedureType
from app.repositories.care_procedure_type import list_care_procedure_types
from app.schemas.care_procedure_type import CareProcedureTypeResponse

router = APIRouter(prefix="/care-procedure-types", tags=["care procedures"])


@router.get("", response_model=list[CareProcedureTypeResponse])
async def get_types(session: Annotated[AsyncSession, Depends(get_session)]) -> list[CareProcedureType]:
    return await list_care_procedure_types(session)
