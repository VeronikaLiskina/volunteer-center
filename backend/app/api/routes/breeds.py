from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.breed import Breed
from app.repositories.breed import list_breeds
from app.schemas.breed import BreedResponse

router = APIRouter(prefix="/breeds", tags=["dictionaries"])


@router.get("", response_model=list[BreedResponse])
async def get_breeds(
    session: Annotated[AsyncSession, Depends(get_session)],
    animal_type_id: Annotated[int | None, Query(gt=0)] = None,
) -> list[Breed]:
    return await list_breeds(session, animal_type_id)
