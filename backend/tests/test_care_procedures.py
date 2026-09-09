from datetime import date

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.models import CareProcedureType
from app.repositories.seed import INITIAL_CARE_PROCEDURE_TYPES, seed_care_procedure_types

API = "/api/v1/care-procedures"


async def create_animal(client, animal_data, *, name="Барсик", archived=False):
    response = await client.post("/api/v1/animals", json=animal_data | {"name": name})
    assert response.status_code == 201, response.text
    animal = response.json()
    if archived:
        animal = (await client.post(f"/api/v1/animals/{animal['id']}/archive")).json()
    return animal


async def create_volunteer(client, *, full_name="Иванова Анна", phone="89991234567", inactive=False):
    response = await client.post("/api/v1/volunteers", json={"full_name": full_name, "phone": phone})
    assert response.status_code == 201, response.text
    volunteer = response.json()
    if inactive:
        volunteer = (await client.post(f"/api/v1/volunteers/{volunteer['id']}/deactivate")).json()
    return volunteer


async def procedure_data(client, animal_data, **changes):
    animal = await create_animal(client, animal_data)
    volunteer = await create_volunteer(client)
    procedure_type = (await client.get("/api/v1/care-procedure-types")).json()[0]
    return {
        "animal_id": animal["id"],
        "procedure_type_id": procedure_type["id"],
        "planned_date": "2026-09-10",
        "planned_time": "10:30:00",
        "duration_minutes": 30,
        "volunteer_id": volunteer["id"],
        "status": "assigned",
        "comment": "После прогулки",
    } | changes


async def test_create_and_get_with_references(client, animal_data):
    payload = await procedure_data(client, animal_data)
    response = await client.post(API, json=payload)
    assert response.status_code == 201, response.text
    procedure = response.json()
    assert procedure["animal"] == {"id": payload["animal_id"], "name": "Барсик"}
    assert procedure["volunteer"]["full_name"] == "Иванова Анна"
    assert procedure["procedure_type"]["name"] in INITIAL_CARE_PROCEDURE_TYPES
    assert (await client.get(f"{API}/{procedure['id']}")).json() == procedure


@pytest.mark.parametrize(
    "reference,kind,expected_status",
    [
        ("archived_animal", "animal_id", 409),
        ("inactive_volunteer", "volunteer_id", 409),
        ("missing_animal", "animal_id", 422),
        ("missing_volunteer", "volunteer_id", 422),
        ("missing_type", "procedure_type_id", 422),
    ],
)
async def test_reference_business_rules(client, animal_data, reference, kind, expected_status):
    payload = await procedure_data(client, animal_data)
    if reference == "archived_animal":
        payload[kind] = (await create_animal(client, animal_data, name="Арчи", archived=True))["id"]
    elif reference == "inactive_volunteer":
        payload[kind] = (await create_volunteer(
            client, full_name="Петров Пётр", phone="89001234567", inactive=True
        ))["id"]
    else:
        payload[kind] = 999999
    response = await client.post(API, json=payload)
    assert response.status_code == expected_status
    assert response.json()["detail"]["field"] == kind


@pytest.mark.parametrize("duration", [0, -1])
async def test_duration_must_be_positive(client, animal_data, duration):
    payload = await procedure_data(client, animal_data)
    assert (await client.post(API, json=payload | {"duration_minutes": duration})).status_code == 422


async def test_patch_and_null_required_field(client, animal_data):
    payload = await procedure_data(client, animal_data)
    procedure = (await client.post(API, json=payload)).json()
    response = await client.patch(f"{API}/{procedure['id']}", json={
        "planned_time": "12:15:00", "status": "cancelled", "comment": "",
    })
    assert response.status_code == 200, response.text
    assert response.json()["planned_time"] == "12:15:00"
    assert response.json()["status"] == "cancelled"
    assert response.json()["comment"] is None
    assert (await client.patch(f"{API}/{procedure['id']}", json={"animal_id": None})).status_code == 422


async def test_patch_revalidates_animal_and_volunteer(client, animal_data):
    payload = await procedure_data(client, animal_data)
    procedure = (await client.post(API, json=payload)).json()
    archived = await create_animal(client, animal_data, name="Арчи", archived=True)
    inactive = await create_volunteer(
        client, full_name="Петров Пётр", phone="89001234567", inactive=True
    )
    assert (await client.patch(
        f"{API}/{procedure['id']}", json={"animal_id": archived["id"]}
    )).status_code == 409
    assert (await client.patch(
        f"{API}/{procedure['id']}", json={"volunteer_id": inactive["id"]}
    )).status_code == 409


async def test_filters_sorting_and_pagination(client, animal_data):
    first_data = await procedure_data(client, animal_data)
    first = (await client.post(API, json=first_data | {
        "planned_date": "2026-09-11", "planned_time": "14:00:00", "status": "completed",
    })).json()
    second = (await client.post(API, json=first_data | {
        "planned_date": "2026-09-10", "planned_time": "09:00:00", "status": "assigned",
    })).json()
    assert [item["id"] for item in (await client.get(API)).json()] == [second["id"], first["id"]]
    filters = {
        "status": "completed", "animal_id": first_data["animal_id"],
        "volunteer_id": first_data["volunteer_id"],
        "procedure_type_id": first_data["procedure_type_id"],
        "date_from": "2026-09-11", "date_to": "2026-09-11",
    }
    assert [item["id"] for item in (await client.get(API, params=filters)).json()] == [first["id"]]
    assert [item["id"] for item in (await client.get(API, params={"limit": 1, "offset": 1})).json()] == [first["id"]]
    assert (await client.get(API, params={"date_from": "2026-09-12", "date_to": "2026-09-10"})).status_code == 422


async def test_summary_uses_backend_current_date(client, animal_data):
    payload = await procedure_data(client, animal_data)
    today = date.today().isoformat()
    await client.post(API, json=payload | {"planned_date": today, "status": "assigned"})
    await client.post(API, json=payload | {"planned_date": today, "status": "completed"})
    await client.post(API, json=payload | {"planned_date": "2099-01-01", "status": "completed"})
    assert (await client.get(f"{API}/summary")).json() == {
        "today_total": 2, "today_completed": 1,
    }


async def test_not_found_and_invalid_status(client):
    assert (await client.get(f"{API}/999999")).status_code == 404
    assert (await client.patch(f"{API}/999999", json={"comment": "x"})).status_code == 404
    assert (await client.get(API, params={"status": "unknown"})).status_code == 422


async def test_database_constraints(client, animal_data, session):
    payload = await procedure_data(client, animal_data)
    procedure = (await client.post(API, json=payload)).json()
    statements = [
        "UPDATE care_procedures SET duration_minutes = 0 WHERE id = :id",
        "UPDATE care_procedures SET status = 'unknown' WHERE id = :id",
        "UPDATE care_procedures SET comment = repeat('x', 256) WHERE id = :id",
        "UPDATE care_procedures SET animal_id = 999999 WHERE id = :id",
    ]
    for statement in statements:
        with pytest.raises(DBAPIError):
            async with session.begin_nested():
                await session.execute(text(statement), {"id": procedure["id"]})


async def test_seed_is_complete_and_idempotent(session):
    await seed_care_procedure_types(session)
    await seed_care_procedure_types(session)
    await session.commit()
    names = list(await session.scalars(select(CareProcedureType.name).order_by(CareProcedureType.name)))
    assert names == sorted(INITIAL_CARE_PROCEDURE_TYPES)
    assert await session.scalar(select(func.count(CareProcedureType.id))) == 4


async def test_care_procedure_migration_downgrade_upgrade(db_connection):
    def cycle(connection):
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.downgrade(config, "0003_volunteer_duplicate_key")
        assert connection.scalar(text("SELECT to_regclass('care_procedures')")) is None
        assert connection.scalar(text("SELECT to_regclass('volunteers')")) == "volunteers"
        command.upgrade(config, "head")
        assert connection.scalar(text("SELECT to_regclass('care_procedures')")) == "care_procedures"

    await db_connection.run_sync(cycle)
