from fastapi import APIRouter

from app.api.routes import animal_types, animals, breeds, care_procedure_types, care_procedures, health, volunteers

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(animal_types.router)
api_router.include_router(breeds.router)
api_router.include_router(animals.router)
api_router.include_router(volunteers.router)
api_router.include_router(care_procedure_types.router)
api_router.include_router(care_procedures.router)
