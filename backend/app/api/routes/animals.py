from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.animal import Animal, AnimalStatus
from app.repositories.animal import AnimalRepository
from app.schemas.animal import AnimalCreate, AnimalResponse, AnimalSummaryResponse, AnimalUpdate
from app.services.animal import AnimalService

router = APIRouter(prefix="/animals", tags=["animals"])
Session = Annotated[AsyncSession, Depends(get_session)]
AnimalId = Annotated[int, Path(gt=0)]


def get_animal_service(session: Session) -> AnimalService:
    return AnimalService(session)


Service = Annotated[AnimalService, Depends(get_animal_service)]


@router.get("", response_model=list[AnimalResponse])
async def list_animals(
    session: Session,
    search: Annotated[str | None, Query(max_length=50)] = None,
    animal_type_id: Annotated[int | None, Query(gt=0)] = None,
    status: AnimalStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Animal]:
    return await AnimalRepository(session).list(search, animal_type_id, status, limit, offset)


@router.get("/summary", response_model=AnimalSummaryResponse)
async def get_summary(session: Session) -> AnimalSummaryResponse:
    total, in_care, archived = await AnimalRepository(session).summary()
    return AnimalSummaryResponse(total=total, in_care=in_care, archived=archived)


@router.get("/{animal_id}", response_model=AnimalResponse)
async def get_animal(animal_id: AnimalId, service: Service) -> Animal:
    return await service.get(animal_id)


@router.post("", response_model=AnimalResponse, status_code=201)
async def create_animal(data: AnimalCreate, service: Service) -> Animal:
    return await service.create(data)


@router.patch("/{animal_id}", response_model=AnimalResponse)
async def update_animal(animal_id: AnimalId, data: AnimalUpdate, service: Service) -> Animal:
    return await service.update(animal_id, data)


@router.post("/{animal_id}/archive", response_model=AnimalResponse)
async def archive_animal(animal_id: AnimalId, service: Service) -> Animal:
    return await service.archive(animal_id)
