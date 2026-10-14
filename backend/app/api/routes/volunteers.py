from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.volunteer import Volunteer, VolunteerStatus
from app.repositories.volunteer import VolunteerRepository
from app.schemas.volunteer import (
    VolunteerCreate,
    VolunteerResponse,
    VolunteerSummaryResponse,
    VolunteerUpdate,
    VolunteerDeactivate,
)
from app.schemas.care_procedure import DeactivationAssignment
from app.services.volunteer import VolunteerService

router = APIRouter(prefix="/volunteers", tags=["volunteers"])
Session = Annotated[AsyncSession, Depends(get_session)]
VolunteerId = Annotated[int, Path(gt=0)]


def get_volunteer_service(session: Session) -> VolunteerService:
    return VolunteerService(session)


Service = Annotated[VolunteerService, Depends(get_volunteer_service)]


@router.get("", response_model=list[VolunteerResponse])
async def list_volunteers(
    session: Session,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: VolunteerStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Volunteer]:
    return await VolunteerRepository(session).list(search, status, limit, offset)


@router.get("/active", response_model=list[VolunteerResponse])
async def list_active_volunteers(session: Session) -> list[Volunteer]:
    return await VolunteerRepository(session).list_active()


@router.get("/summary", response_model=VolunteerSummaryResponse)
async def get_volunteer_summary(session: Session) -> VolunteerSummaryResponse:
    total, active, inactive = await VolunteerRepository(session).summary()
    return VolunteerSummaryResponse(total=total, active=active, inactive=inactive)


@router.get("/{volunteer_id}", response_model=VolunteerResponse)
async def get_volunteer(volunteer_id: VolunteerId, service: Service) -> Volunteer:
    return await service.get(volunteer_id)


@router.post("", response_model=VolunteerResponse, status_code=201)
async def create_volunteer(data: VolunteerCreate, service: Service) -> Volunteer:
    return await service.create(data)


@router.patch("/{volunteer_id}", response_model=VolunteerResponse)
async def update_volunteer(volunteer_id: VolunteerId, data: VolunteerUpdate, service: Service) -> Volunteer:
    return await service.update(volunteer_id, data)


@router.post("/{volunteer_id}/deactivate", response_model=VolunteerResponse)
async def deactivate_volunteer(volunteer_id: VolunteerId, service: Service, data: VolunteerDeactivate | None = None) -> Volunteer:
    return await service.deactivate(volunteer_id, data or VolunteerDeactivate())


@router.get("/{volunteer_id}/deactivation-assignments", response_model=list[DeactivationAssignment])
async def deactivation_assignments(volunteer_id: VolunteerId, service: Service):
    return await service.deactivation_assignments(volunteer_id)


@router.post("/{volunteer_id}/activate", response_model=VolunteerResponse)
async def activate_volunteer(volunteer_id: VolunteerId, service: Service) -> Volunteer:
    return await service.set_status(volunteer_id, VolunteerStatus.ACTIVE)
