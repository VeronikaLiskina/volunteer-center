import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.models import Volunteer, VolunteerStatus
from app.services.volunteer import volunteer_duplicate_key

API = "/api/v1/volunteers"


@pytest.fixture
def volunteer_data() -> dict:
    return {
        "full_name": "Иванов Иван Иванович",
        "phone": "+7 (999) 123-45-67",
        "note": "Помогает по выходным",
    }


async def test_create_normalizes_phone_and_gets_card(client, volunteer_data):
    response = await client.post(API, json=volunteer_data)
    assert response.status_code == 201, response.text
    volunteer = response.json()
    assert volunteer == {
        "id": volunteer["id"],
        "full_name": "Иванов Иван Иванович",
        "phone": "+79991234567",
        "status": "active",
        "available_from": None, "available_to": None,
        "note": "Помогает по выходным",
    }
    assert "duplicate_key" not in volunteer
    assert (await client.get(f"{API}/{volunteer['id']}")).json() == volunteer


@pytest.mark.parametrize("changes", [
    {"full_name": ""}, {"full_name": "   "}, {"full_name": "я" * 101},
    {"phone": "123"}, {"phone": "+89991234567"}, {"phone": "phone"},
    {"note": "я" * 256}, {"status": "inactive"}, {"id": 3},
])
async def test_invalid_create(client, volunteer_data, changes):
    assert (await client.post(API, json=volunteer_data | changes)).status_code == 422


async def test_duplicate_uses_normalized_contacts(client, volunteer_data):
    assert (await client.post(API, json=volunteer_data)).status_code == 201
    duplicate = volunteer_data | {"full_name": "  иВАНОВ   иВАН иВАНОВИЧ ", "phone": "89991234567"}
    response = await client.post(API, json=duplicate)
    assert response.status_code == 409
    assert response.json()["detail"]["message"] == "Волонтёр с такими ФИО и телефоном уже существует"
    assert (await client.post(API, json=volunteer_data | {"phone": "89001234567"})).status_code == 201


async def test_patch_preserves_fields_and_forbids_status(client, volunteer_data):
    volunteer = (await client.post(API, json=volunteer_data)).json()
    response = await client.patch(f"{API}/{volunteer['id']}", json={"full_name": "Петров Пётр", "note": ""})
    assert response.status_code == 200
    assert response.json()["full_name"] == "Петров Пётр"
    assert response.json()["phone"] == "+79991234567"
    assert response.json()["note"] is None
    assert (await client.patch(f"{API}/{volunteer['id']}", json={"status": "inactive"})).status_code == 422
    assert (await client.patch(f"{API}/{volunteer['id']}", json={"phone": None})).status_code == 422


async def test_not_found(client):
    assert (await client.get(f"{API}/999999")).status_code == 404
    assert (await client.patch(f"{API}/999999", json={"full_name": "Иванов Иван"})).status_code == 404
    assert (await client.post(f"{API}/999999/deactivate")).status_code == 404
    assert (await client.post(f"{API}/999999/activate")).status_code == 404


async def test_deactivate_activate_are_idempotent_and_active_endpoint(client, volunteer_data):
    volunteer = (await client.post(API, json=volunteer_data)).json()
    url = f"{API}/{volunteer['id']}"
    for _ in range(2):
        response = await client.post(f"{url}/deactivate")
        assert response.status_code == 200
        assert response.json()["status"] == "inactive"
    assert (await client.get(f"{API}/active")).json() == []
    for _ in range(2):
        response = await client.post(f"{url}/activate")
        assert response.status_code == 200
        assert response.json()["status"] == "active"
    assert [item["id"] for item in (await client.get(f"{API}/active")).json()] == [volunteer["id"]]
    assert (await client.delete(url)).status_code == 405


async def test_search_status_filters_and_pagination(client, volunteer_data):
    first = (await client.post(API, json=volunteer_data)).json()
    await client.post(API, json=volunteer_data | {"full_name": "Петрова Анна", "phone": "89001234567"})
    await client.post(f"{API}/{first['id']}/deactivate")
    assert len((await client.get(API, params={"search": "ИВАНОВ"})).json()) == 1
    assert len((await client.get(API, params={"status": "inactive"})).json()) == 1
    assert len((await client.get(API, params={"status": "active"})).json()) == 1
    assert len((await client.get(API, params={"limit": 1, "offset": 1})).json()) == 1
    assert (await client.get(API, params={"search": "%"})).json() == []
    assert (await client.get(API, params={"status": "unknown"})).status_code == 422


async def test_summary(client, volunteer_data):
    assert (await client.get(f"{API}/summary")).json() == {"total": 0, "active": 0, "inactive": 0}
    first = (await client.post(API, json=volunteer_data)).json()
    await client.post(API, json=volunteer_data | {"full_name": "Петрова Анна", "phone": "89001234567"})
    await client.post(f"{API}/{first['id']}/deactivate")
    assert (await client.get(f"{API}/summary")).json() == {"total": 2, "active": 1, "inactive": 1}


@pytest.mark.parametrize("column,value", [
    ("full_name", "''"), ("phone", "'123'"), ("status", "'unknown'"),
])
async def test_database_constraints(client, volunteer_data, session, column, value):
    volunteer = (await client.post(API, json=volunteer_data)).json()
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            await session.execute(text(f"UPDATE volunteers SET {column} = {value} WHERE id = :id"),
                                  {"id": volunteer["id"]})


async def test_database_unique_contact_constraint(client, volunteer_data, session):
    volunteer = (await client.post(API, json=volunteer_data)).json()
    original = await session.scalar(select(Volunteer).where(Volunteer.id == volunteer["id"]))
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            duplicate_name = original.full_name.swapcase()
            session.add(Volunteer(full_name=duplicate_name, phone=original.phone,
                                  status=VolunteerStatus.ACTIVE,
                                  duplicate_key=volunteer_duplicate_key(duplicate_name, original.phone)))
            await session.flush()


async def test_volunteer_migration_downgrade_upgrade(db_connection):
    def cycle(connection):
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.downgrade(config, "0001_animal_registry")
        assert connection.scalar(text("SELECT to_regclass('volunteers')")) is None
        assert connection.scalar(text("SELECT to_regclass('animals')")) == "animals"
        command.upgrade(config, "head")
        assert connection.scalar(text("SELECT to_regclass('volunteers')")) == "volunteers"

    await db_connection.run_sync(cycle)
