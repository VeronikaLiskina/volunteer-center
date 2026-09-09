from typing import Annotated

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.procedure_execution import ProcedureExecution
from app.schemas.procedure_execution import (
    ProcedureExecutionCreate,
    ProcedureExecutionResponse,
    ProcedureExecutionUpdate,
)
from app.services.procedure_execution import ProcedureExecutionService

router = APIRouter(prefix="/care-procedures", tags=["procedure executions"])
Session = Annotated[AsyncSession, Depends(get_session)]
ProcedureId = Annotated[int, Path(gt=0)]


def get_service(session: Session) -> ProcedureExecutionService:
    return ProcedureExecutionService(session)


Service = Annotated[ProcedureExecutionService, Depends(get_service)]


@router.get("/{procedure_id}/execution", response_model=ProcedureExecutionResponse)
async def get_execution(
    procedure_id: ProcedureId, service: Service,
) -> ProcedureExecution:
    return await service.get(procedure_id)


@router.post(
    "/{procedure_id}/execute",
    response_model=ProcedureExecutionResponse,
    status_code=201,
)
async def execute_procedure(
    procedure_id: ProcedureId,
    data: ProcedureExecutionCreate,
    service: Service,
) -> ProcedureExecution:
    return await service.execute(procedure_id, data)


@router.patch("/{procedure_id}/execution", response_model=ProcedureExecutionResponse)
async def update_execution(
    procedure_id: ProcedureId,
    data: ProcedureExecutionUpdate,
    service: Service,
) -> ProcedureExecution:
    return await service.update(procedure_id, data)
