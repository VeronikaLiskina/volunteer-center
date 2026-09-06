from collections.abc import AsyncIterator
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.session import get_session
from app.main import app
from app.repositories.seed import seed_dictionaries


@pytest.fixture
async def db_connection() -> AsyncIterator[AsyncConnection]:
    """Migrate a unique transactional schema; rollback removes only this test's data."""
    test_engine = create_async_engine(settings.database_url, poolclass=NullPool,
                                      connect_args={"timeout": 3})
    try:
        async with test_engine.connect() as connection:
            transaction = await connection.begin()
            schema = "lapka_test_" + uuid4().hex
            try:
                await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
                await connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))

                def migrate(sync_connection: Connection) -> None:
                    config = Config("alembic.ini")
                    config.attributes["connection"] = sync_connection
                    command.upgrade(config, "head")

                await connection.run_sync(migrate)
                yield connection
            finally:
                await transaction.rollback()
    finally:
        await test_engine.dispose()


@pytest.fixture
async def session(db_connection) -> AsyncIterator[AsyncSession]:
    async with AsyncSession(bind=db_connection, expire_on_commit=False,
                            join_transaction_mode="create_savepoint") as session:
        await seed_dictionaries(session)
        await session.commit()
        yield session


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.pop(get_session, None)


@pytest.fixture
async def animal_data(client: AsyncClient) -> dict:
    types = (await client.get("/api/v1/animal-types")).json()
    cat_id = next(item["id"] for item in types if item["name"] == "Кошка")
    breeds = (await client.get("/api/v1/breeds", params={"animal_type_id": cat_id})).json()
    return {"name": "Барсик", "animal_type_id": cat_id, "breed_id": breeds[0]["id"],
            "weight": "4.25", "birth_year": 2021, "owner_name": "Иванов Иван",
            "owner_phone": "+7 (999) 123-45-67", "note": "Нужен осмотр"}
