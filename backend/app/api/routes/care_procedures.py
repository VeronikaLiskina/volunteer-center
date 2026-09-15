from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.api.dependencies import CurrentUser, coordinator
from app.models.care_procedure import CareProcedure, CareProcedureStatus
from app.schemas.care_procedure import CareProcedureCreate, CareProcedureResponse, CareProcedureSummaryResponse, CareProcedureUpdate
from app.services.care_procedure import CareProcedureService

router = APIRouter(prefix="/care-procedures", tags=["care procedures"])
Session = Annotated[AsyncSession, Depends(get_session)]
ProcedureId = Annotated[int, Path(gt=0)]


def get_service(session: Session, user: CurrentUser) -> CareProcedureService:
    return CareProcedureService(session, user)


Service = Annotated[CareProcedureService, Depends(get_service)]


@router.get("", response_model=list[CareProcedureResponse])
async def list_procedures(service: Service, status: CareProcedureStatus | None = None,
    animal_id: Annotated[int | None, Query(gt=0)] = None,
    volunteer_id: Annotated[int | None, Query(gt=0)] = None,
    procedure_type_id: Annotated[int | None, Query(gt=0)] = None,
    date_from: date | None = None, date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0) -> list[CareProcedure]:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail={"message": "Дата начала не может быть позже даты окончания", "field": "date_to"})
    return await service.list(status=status, animal_id=animal_id,
        volunteer_id=volunteer_id, procedure_type_id=procedure_type_id, date_from=date_from,
        date_to=date_to, limit=limit, offset=offset)


@router.get("/summary", response_model=CareProcedureSummaryResponse)
async def summary(service: Service) -> CareProcedureSummaryResponse:
    return await service.summary()


@router.get("/{procedure_id}", response_model=CareProcedureResponse)
async def get_procedure(procedure_id: ProcedureId, service: Service) -> CareProcedure:
    return await service.get(procedure_id)


@router.post("", response_model=CareProcedureResponse, status_code=201, dependencies=[Depends(coordinator)])
async def create_procedure(data: CareProcedureCreate, service: Service) -> CareProcedure:
    return await service.create(data)


@router.patch("/{procedure_id}", response_model=CareProcedureResponse, dependencies=[Depends(coordinator)])
async def update_procedure(procedure_id: ProcedureId, data: CareProcedureUpdate, service: Service) -> CareProcedure:
    return await service.update(procedure_id, data)
