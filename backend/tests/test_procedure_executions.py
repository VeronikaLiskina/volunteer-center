from datetime import date, time

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import ProcedureExecution

API = "/api/v1/care-procedures"


@pytest.fixture
async def planned_procedure(client, animal_data) -> dict:
    animal = (await client.post("/api/v1/animals", json=animal_data)).json()
    volunteer_response = await client.post("/api/v1/volunteers", json={
        "full_name": "Иванова Анна",
        "phone": "89991234567",
    })
    assert volunteer_response.status_code == 201, volunteer_response.text
    volunteer = volunteer_response.json()
    procedure_type = (await client.get("/api/v1/care-procedure-types")).json()[0]
    response = await client.post(API, json={
        "animal_id": animal["id"],
        "procedure_type_id": procedure_type["id"],
        "planned_date": "2026-09-10",
        "planned_time": "10:30:00",
        "duration_minutes": 30,
        "volunteer_id": volunteer["id"],
        "comment": None,
    })
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def execution_data() -> dict:
    return {
        "execution_date": "2026-09-10",
        "execution_time": "10:40:00",
        "result": "Животное накормлено, состояние спокойное",
        "comment": "Без особенностей",
    }


async def test_execute_assigned_procedure(client, planned_procedure, execution_data):
    procedure_id = planned_procedure["id"]
    response = await client.post(f"{API}/{procedure_id}/execute", json=execution_data)
    assert response.status_code == 201, response.text
    execution = response.json()
    assert execution["care_procedure_id"] == procedure_id
    assert execution["result"] == execution_data["result"]
    assert execution["created_at"]
    assert (await client.get(f"{API}/{procedure_id}")).json()["status"] == "completed"


async def test_execute_overdue_procedure(client, planned_procedure, execution_data):
    procedure_id = planned_procedure["id"]
    changed = await client.patch(f"{API}/{procedure_id}", json={"status": "overdue"})
    assert changed.status_code == 200
    response = await client.post(f"{API}/{procedure_id}/execute", json=execution_data)
    assert response.status_code == 201, response.text
    assert (await client.get(f"{API}/{procedure_id}")).json()["status"] == "completed"


async def test_completed_procedure_cannot_be_executed(
    client, planned_procedure, execution_data, session,
):
    await session.execute(text(
        "UPDATE care_procedures SET status = 'completed' WHERE id = :id"
    ), {"id": planned_procedure["id"]})
    await session.commit()
    response = await client.post(
        f"{API}/{planned_procedure['id']}/execute", json=execution_data
    )
    assert response.status_code == 409
    assert response.json()["detail"]["message"] == "Услуга уже выполнена"


async def test_cancelled_procedure_leaves_no_execution(
    client, planned_procedure, execution_data, session,
):
    procedure_id = planned_procedure["id"]
    await client.patch(f"{API}/{procedure_id}", json={"status": "cancelled"})
    response = await client.post(f"{API}/{procedure_id}/execute", json=execution_data)
    assert response.status_code == 409
    assert await session.scalar(select(func.count(ProcedureExecution.id))) == 0
    assert (await client.get(f"{API}/{procedure_id}")).json()["status"] == "cancelled"


async def test_repeated_execution_is_forbidden(
    client, planned_procedure, execution_data, session,
):
    procedure_id = planned_procedure["id"]
    assert (await client.post(f"{API}/{procedure_id}/execute", json=execution_data)).status_code == 201
    response = await client.post(f"{API}/{procedure_id}/execute", json=execution_data)
    assert response.status_code == 409
    assert await session.scalar(select(func.count(ProcedureExecution.id))) == 1


async def test_execute_missing_procedure(client, execution_data):
    response = await client.post(f"{API}/999999/execute", json=execution_data)
    assert response.status_code == 404


async def test_get_and_patch_execution(client, planned_procedure, execution_data):
    procedure_id = planned_procedure["id"]
    assert (await client.get(f"{API}/{procedure_id}/execution")).status_code == 404
    created = (await client.post(f"{API}/{procedure_id}/execute", json=execution_data)).json()
    assert (await client.get(f"{API}/{procedure_id}/execution")).json() == created
    response = await client.patch(f"{API}/{procedure_id}/execution", json={
        "execution_time": "11:00:00",
        "result": "Результат уточнён",
        "comment": "",
    })
    assert response.status_code == 200, response.text
    assert response.json()["execution_time"] == "11:00:00"
    assert response.json()["result"] == "Результат уточнён"
    assert response.json()["comment"] is None


@pytest.mark.parametrize("changes", [
    {"execution_date": None}, {"execution_time": None}, {"result": None},
    {"result": "   "}, {"comment": "я" * 256}, {"care_procedure_id": 1},
])
async def test_invalid_execution_body(client, planned_procedure, execution_data, changes):
    response = await client.post(
        f"{API}/{planned_procedure['id']}/execute", json=execution_data | changes
    )
    assert response.status_code == 422


async def test_database_allows_only_one_execution(
    client, planned_procedure, execution_data, session,
):
    procedure_id = planned_procedure["id"]
    await client.post(f"{API}/{procedure_id}/execute", json=execution_data)
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            session.add(ProcedureExecution(
                care_procedure_id=procedure_id,
                execution_date=date(2026, 9, 10),
                execution_time=time(10, 40),
                result="Повтор",
                comment=None,
            ))
            await session.flush()


async def test_procedure_execution_migration_downgrade_upgrade(db_connection):
    def cycle(connection):
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.downgrade(config, "0004_care_procedures")
        assert connection.scalar(text("SELECT to_regclass('procedure_executions')")) is None
        assert connection.scalar(text("SELECT to_regclass('care_procedures')")) == "care_procedures"
        command.upgrade(config, "head")
        assert connection.scalar(text("SELECT to_regclass('procedure_executions')")) == "procedure_executions"

    await db_connection.run_sync(cycle)
