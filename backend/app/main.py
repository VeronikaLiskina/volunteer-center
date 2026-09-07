from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import AnimalError, VolunteerError
from app.db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)


@app.exception_handler(AnimalError)
async def animal_error_handler(_: Request, error: AnimalError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": {"message": error.message, "field": error.field}},
    )


@app.exception_handler(VolunteerError)
async def volunteer_error_handler(_: Request, error: VolunteerError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": {"message": error.message, "field": error.field}},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.api_v1_prefix)
