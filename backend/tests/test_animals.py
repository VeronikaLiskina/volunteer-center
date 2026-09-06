from datetime import date
from unittest.mock import AsyncMock

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Animal, AnimalStatus, AnimalType, Breed
from app.repositories.seed import seed_dictionaries

API = "/api/v1/animals"


async def test_create_read_and_health(client, animal_data):
    response = await client.post(API, json=animal_data)
    assert response.status_code == 201, response.text
    animal = response.json()
    assert animal["status"] == "in_care"
    assert animal["weight"] == "4.25"
    assert animal["owner_phone"] == "+79991234567"
    assert animal["breed"]["animal_type_id"] == animal["animal_type_id"]
    assert "duplicate_key" not in animal
    assert (await client.get(f"{API}/{animal['id']}")).json() == animal
    health = await client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "database": "connected"}


async def test_dashboard_summary_counts_and_archive(client, animal_data):
    assert (await client.get(f"{API}/summary")).json() == {"total": 0, "in_care": 0, "archived": 0}
    first = (await client.post(API, json=animal_data)).json()
    await client.post(API, json=animal_data | {"name": "Мурка"})
    assert (await client.get(f"{API}/summary")).json() == {"total": 2, "in_care": 2, "archived": 0}
    await client.post(f"{API}/{first['id']}/archive")
    assert (await client.get(f"{API}/summary")).json() == {"total": 2, "in_care": 1, "archived": 1}


async def test_wrong_breed(client, animal_data):
    breeds = (await client.get("/api/v1/breeds")).json()
    other = next(b for b in breeds if b["animal_type_id"] != animal_data["animal_type_id"])
    response = await client.post(API, json=animal_data | {"breed_id": other["id"]})
    assert response.status_code == 422
    assert response.json()["detail"]["field"] == "breed_id"


@pytest.mark.parametrize("changes", [
    {"weight": "0"}, {"weight": "-1"}, {"weight": "0.001"}, {"weight": "NaN"},
    {"weight": "10000"}, {"birth_year": date.today().year + 1}, {"birth_year": 1899},
    {"name": "   "}, {"name": "я" * 51}, {"owner_name": "я" * 101}, {"note": "я" * 256},
    {"owner_phone": "123"}, {"owner_phone": "hello79991234567"},
    {"status": "archived"}, {"id": 42}, {"duplicate_key": "injected"},
])
async def test_invalid_create(client, animal_data, changes):
    assert (await client.post(API, json=animal_data | changes)).status_code == 422


@pytest.mark.parametrize("field", ["animal_type_id", "breed_id"])
async def test_missing_reference(client, animal_data, field):
    response = await client.post(API, json=animal_data | {field: 999999})
    assert response.status_code == 422
    assert response.json()["detail"]["field"] == field


async def test_not_found(client):
    assert (await client.get(f"{API}/999999")).status_code == 404
    assert (await client.patch(f"{API}/999999", json={"name": "Рекс"})).status_code == 404
    assert (await client.post(f"{API}/999999/archive")).status_code == 404


async def test_duplicate_normalization_and_distinct_owner(client, animal_data):
    assert (await client.post(API, json=animal_data)).status_code == 201
    duplicate = animal_data | {"name": "  бАРСИК ", "owner_name": "иванов   иван",
                               "owner_phone": "89991234567", "weight": "4.5", "note": "Новое"}
    assert (await client.post(API, json=duplicate)).status_code == 409
    assert (await client.post(API, json=animal_data | {"owner_name": "Другой хозяин"})).status_code == 201


async def test_patch_validates_merged_references_and_preserves_fields(client, animal_data):
    animal = (await client.post(API, json=animal_data)).json()
    url = f"{API}/{animal['id']}"
    changed = await client.patch(url, json={"weight": "5.50", "owner_phone": None})
    assert changed.status_code == 200
    assert changed.json()["weight"] == "5.50"
    assert changed.json()["owner_phone"] is None
    assert changed.json()["name"] == animal_data["name"]
    types = (await client.get("/api/v1/animal-types")).json()
    other = next(t for t in types if t["id"] != animal_data["animal_type_id"])
    assert (await client.patch(url, json={"animal_type_id": other["id"]})).status_code == 422
    breeds = (await client.get("/api/v1/breeds", params={"animal_type_id": other["id"]})).json()
    response = await client.patch(url, json={"animal_type_id": other["id"], "breed_id": breeds[0]["id"]})
    assert response.status_code == 200
    assert response.json()["animal_type"]["id"] == other["id"]
    assert response.json()["breed"]["id"] == breeds[0]["id"]


@pytest.mark.parametrize("patch", [{"name": None}, {"weight": None}, {"weight": "0"},
                                   {"birth_year": date.today().year + 1}, {"status": "in_care"}])
async def test_invalid_patch(client, animal_data, patch):
    animal = (await client.post(API, json=animal_data)).json()
    assert (await client.patch(f"{API}/{animal['id']}", json=patch)).status_code == 422


async def test_duplicate_on_update(client, animal_data):
    await client.post(API, json=animal_data)
    second = (await client.post(API, json=animal_data | {"name": "Мурка"})).json()
    assert (await client.patch(f"{API}/{second['id']}", json={"name": "Барсик"})).status_code == 409
    assert (await client.get(f"{API}/{second['id']}")).json()["name"] == "Мурка"


async def test_archive_is_idempotent_and_keeps_row(client, animal_data, session):
    animal = (await client.post(API, json=animal_data)).json()
    url = f"{API}/{animal['id']}"
    for _ in range(2):
        response = await client.post(f"{url}/archive")
        assert response.status_code == 200
        assert response.json()["status"] == "archived"
    assert (await session.get(Animal, animal["id"])).status == AnimalStatus.ARCHIVED
    assert (await client.get(url)).status_code == 200
    assert (await client.patch(url, json={"name": "Новое"})).status_code == 409
    assert (await client.delete(url)).status_code == 405
    assert (await client.post(API, json=animal_data)).status_code == 409


async def test_search_filters_and_paging(client, animal_data):
    first = (await client.post(API, json=animal_data)).json()
    await client.post(API, json=animal_data | {"name": "Мурка"})
    await client.post(f"{API}/{first['id']}/archive")
    assert len((await client.get(API, params={"search": "БАР"})).json()) == 1
    assert len((await client.get(API, params={"status": "archived"})).json()) == 1
    assert len((await client.get(API, params={"status": "in_care", "animal_type_id": animal_data["animal_type_id"]})).json()) == 1
    assert (await client.get(API, params={"search": "%"})).json() == []
    assert (await client.get(API, params={"animal_type_id": 999999})).json() == []
    assert len((await client.get(API, params={"limit": 1, "offset": 1})).json()) == 1
    assert (await client.get(API, params={"status": "bad"})).status_code == 422


async def test_seed_is_idempotent(session):
    before = (await session.scalar(select(func.count()).select_from(AnimalType)),
              await session.scalar(select(func.count()).select_from(Breed)))
    await seed_dictionaries(session)
    await seed_dictionaries(session)
    assert before == (await session.scalar(select(func.count()).select_from(AnimalType)),
                      await session.scalar(select(func.count()).select_from(Breed)))
    assert before == (4, 10)


@pytest.mark.parametrize("field,value", [("weight", "0"), ("birth_year", "1800"),
                                         ("status", "'unknown'")])
async def test_database_constraints(client, animal_data, session, field, value):
    animal = (await client.post(API, json=animal_data)).json()
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            await session.execute(text(f"UPDATE animals SET {field} = {value} WHERE id = :id"),
                                  {"id": animal["id"]})


async def test_database_blocks_duplicate_even_without_service(client, animal_data, session):
    animal = (await client.post(API, json=animal_data)).json()
    original = await session.get(Animal, animal["id"])
    columns = ("name", "animal_type_id", "breed_id", "weight", "birth_year", "duplicate_key")
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(Animal(**{column: getattr(original, column) for column in columns}))
            await session.flush()


async def test_database_rejects_mismatched_breed(client, animal_data, session):
    animal = (await client.post(API, json=animal_data)).json()
    other_type = await session.scalar(select(AnimalType.id).where(AnimalType.id != animal["animal_type_id"]))
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            await session.execute(text("UPDATE animals SET animal_type_id = :type_id WHERE id = :id"),
                                  {"type_id": other_type, "id": animal["id"]})


async def test_dictionary_unique_constraints(session):
    cat = await session.scalar(select(AnimalType).where(AnimalType.name == "Кошка"))
    cat_id = cat.id
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(AnimalType(name="Кошка"))
            await session.flush()
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(Breed(animal_type_id=cat_id, name="Сиамская"))
            await session.flush()


async def test_health_reports_database_outage(client, session, monkeypatch):
    monkeypatch.setattr(session, "execute", AsyncMock(side_effect=OSError("Database unavailable")))
    response = await client.get("/api/v1/health")
    assert response.status_code == 503
    assert response.json() == {"status": "error", "database": "unavailable"}


async def test_migration_downgrade_upgrade(db_connection):
    def cycle(connection):
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
        assert connection.scalar(text("SELECT to_regclass('animals')")) is None
        command.upgrade(config, "head")
        assert connection.scalar(text("SELECT to_regclass('animals')")) == "animals"

    await db_connection.run_sync(cycle)
