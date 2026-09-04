from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.health import is_database_available
from app.schemas.health import HealthResponse


async def get_health_status(session: AsyncSession) -> HealthResponse:
    if await is_database_available(session):
        return HealthResponse(status="ok", database="connected")
    return HealthResponse(status="error", database="unavailable")

