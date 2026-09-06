from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.animal_type import AnimalType
from app.repositories.animal_type import list_animal_types
from app.schemas.animal_type import AnimalTypeResponse

router = APIRouter(prefix="/animal-types", tags=["dictionaries"])


@router.get("", response_model=list[AnimalTypeResponse])
async def get_types(session: Annotated[AsyncSession, Depends(get_session)]) -> list[AnimalType]:
    return await list_animal_types(session)
