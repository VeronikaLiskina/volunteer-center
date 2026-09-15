from fastapi import APIRouter, Depends
from app.api.dependencies import coordinator
from app.api.routes import auth, notifications, registrations

from app.api.routes import (
    analytics, animal_types, animals, breeds, care_procedure_types, care_procedures, health,
    procedure_executions, volunteers,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(registrations.router)
api_router.include_router(notifications.router)
api_router.include_router(animal_types.router, dependencies=[Depends(coordinator)])
api_router.include_router(breeds.router, dependencies=[Depends(coordinator)])
api_router.include_router(animals.router, dependencies=[Depends(coordinator)])
api_router.include_router(volunteers.router, dependencies=[Depends(coordinator)])
api_router.include_router(care_procedure_types.router, dependencies=[Depends(coordinator)])
api_router.include_router(care_procedures.router)
api_router.include_router(procedure_executions.router)
api_router.include_router(analytics.router, dependencies=[Depends(coordinator)])
