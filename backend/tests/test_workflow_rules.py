from datetime import date, timedelta
from io import BytesIO
from zipfile import ZipFile

import pytest
from sqlalchemy import select, func, text
from sqlalchemy.exc import IntegrityError
from alembic import command
from alembic.config import Config

from app.models.care_procedure import CareProcedure
from app.models.procedure_execution import ProcedureExecution
from app.services.notification import NotificationService

API = "/api/v1/care-procedures"


@pytest.fixture
async def world(client, animal_data):
    animal = (await client.post("/api/v1/animals", json=animal_data)).json()
    volunteers = []
    for number in range(3):
        response = await client.post("/api/v1/volunteers", json={
            "full_name": f"Волонтёр {number}", "phone": f"+7999000010{number}",
            "note": "Работаю только после 14:00" if number == 1 else None,
        })
        assert response.status_code == 201, response.text
        volunteers.append(response.json())
    types = (await client.get("/api/v1/care-procedure-types")).json()
    return {"animal_id": animal["id"], "procedure_type_id": types[0]["id"],
            "planned_date": "2099-10-10", "planned_time": "14:00:00", "duration_minutes": 60,
            "volunteer_id": volunteers[0]["id"], "comment": "Нужен осмотр"}, volunteers


async def create(client, payload, **changes):
    response = await client.post(API, json=payload | changes)
    assert response.status_code == 201, response.text
    return response.json()


def outcome(**changes):
    return {"execution_date": date.today().isoformat(), "execution_time": "14:00:00",
            "result": "Сделано", "is_completed": True} | changes


@pytest.mark.parametrize("changes", [
    {"is_completed": False}, {"is_completed": False, "failure_reason": " "},
    {"is_completed": True, "failure_reason": "Причина"}, {"is_completed": None},
    {"is_completed": "false"}, {"is_completed": True, "result": " "},
])
async def test_invalid_outcome_cannot_be_sent_directly(client, world, session, changes):
    procedure = await create(client, world[0])
    assert (await client.post(f"{API}/{procedure['id']}/execute", json=outcome(**changes))).status_code == 422
    assert await session.scalar(select(func.count(ProcedureExecution.id))) == 0
    assert (await client.get(f"{API}/{procedure['id']}")).json()["status"] == "assigned"


async def test_failure_is_terminal_and_not_counted_as_completed(client, world):
    procedure = await create(client, world[0])
    path = f"{API}/{procedure['id']}"
    response = await client.post(path + "/execute", json=outcome(is_completed=False, failure_reason="Нет корма", result=""))
    assert response.status_code == 201, response.text
    assert response.json()["failure_reason"] == "Нет корма"
    assert (await client.get(path)).json()["status"] == "cancelled"
    assert (await client.get(API + "/summary")).json()["today_completed"] == 0
    assert (await client.patch(path, json={"status": "assigned"})).status_code == 409
    assert (await client.patch(path + "/execution", json={"failure_reason": None})).status_code == 422
    assert (await client.patch(path + "/execution", json={"is_completed": True})).status_code == 422
    assert (await client.patch(path + "/execution", json={"failure_reason": "Нет доступа"})).status_code == 200
    assert (await client.post(path + "/execute", json=outcome())).status_code == 409


async def test_success_and_database_outcome_constraint(client, world, session):
    procedure = await create(client, world[0])
    response = await client.post(f"{API}/{procedure['id']}/execute", json=outcome())
    assert response.status_code == 201
    assert response.json()["is_completed"] is True
    with pytest.raises(IntegrityError):
        async with session.begin_nested():
            await session.execute(text("UPDATE procedure_executions SET is_completed = false, failure_reason = NULL"))


@pytest.mark.parametrize("start,duration,expected", [("13:00", 60, 409), ("14:00", 60, 201), ("16:30", 60, 409), ("16:00", 60, 201)])
async def test_availability_whole_interval(client, world, start, duration, expected):
    payload, volunteers = world
    volunteer_id = volunteers[1]["id"]
    assert (await client.patch(f"/api/v1/volunteers/{volunteer_id}", json={"available_from": "14:00", "available_to": "17:00"})).status_code == 200
    response = await client.post(API, json=payload | {"volunteer_id": volunteer_id, "planned_time": start, "duration_minutes": duration})
    assert response.status_code == expected, response.text
    if expected == 201:
        assert response.json()["volunteer"]["note"] == "Работаю только после 14:00"


async def test_note_is_not_parsed_and_availability_update_validates_pending(client, world):
    payload, volunteers = world
    volunteer_id = volunteers[1]["id"]
    await create(client, payload, volunteer_id=volunteer_id, planned_time="13:00")
    path = f"/api/v1/volunteers/{volunteer_id}"
    assert (await client.patch(path, json={"available_from": "14:00"})).status_code == 409
    assert (await client.get(path)).json()["available_from"] is None
    assert (await client.patch(path, json={"available_from": "15:00", "available_to": "14:00"})).status_code == 422
    assert (await client.patch(path, json={"available_to": "18:00"})).status_code == 200
    assert (await client.patch(path, json={"available_from": "19:00"})).status_code == 422


async def test_overlap_and_midnight_and_adjacent_intervals(client, world):
    payload, _ = world
    first = await create(client, payload, planned_time="23:30")
    assert (await client.post(API, json=payload | {"planned_date": "2099-10-11", "planned_time": "00:00"})).status_code == 409
    second = await create(client, payload, planned_date="2099-10-11", planned_time="00:30")
    assert (await client.patch(f"{API}/{second['id']}", json={"planned_time": "00:20"})).status_code == 409
    assert (await client.patch(f"{API}/{first['id']}", json={"comment": "Без изменений времени"})).status_code == 200


@pytest.mark.parametrize("count", [0, 1, 3])
async def test_deactivation_reassigns_all_and_is_idempotent(client, world, count):
    payload, volunteers = world
    procedures = [await create(client, payload, planned_time=f"{14 + index}:00") for index in range(count)]
    path = f"/api/v1/volunteers/{volunteers[0]['id']}"
    preview = (await client.get(path + "/deactivation-assignments")).json()
    assert len(preview) == count
    for item in preview:
        assert {v["id"] for v in item["candidates"]} == {v["id"] for v in volunteers[1:]}
        assert item["procedure"]["comment"] == "Нужен осмотр"
    replacements = [{"procedure_id": p["id"], "volunteer_id": volunteers[1]["id"]} for p in procedures]
    response = await client.post(path + "/deactivate", json={"reassignments": replacements})
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "inactive"
    assert (await client.post(path + "/deactivate", json={"reassignments": replacements})).status_code == 200
    for procedure in procedures:
        assert (await client.get(f"{API}/{procedure['id']}")).json()["volunteer_id"] == volunteers[1]["id"]
    assert (await client.post(API, json=payload | {"planned_time": "20:00"})).status_code == 409


async def test_deactivation_filters_busy_inactive_and_unavailable_candidates(client, world):
    payload, volunteers = world
    await create(client, payload)
    await create(client, payload, volunteer_id=volunteers[1]["id"])
    path = f"/api/v1/volunteers/{volunteers[0]['id']}"
    other = f"/api/v1/volunteers/{volunteers[2]['id']}"
    await client.patch(other, json={"available_from": "15:00"})
    assert (await client.get(path + "/deactivation-assignments")).json()[0]["candidates"] == []
    assert (await client.post(path + "/deactivate")).status_code == 409
    await client.patch(other, json={"available_from": None})
    await client.post(other + "/deactivate")
    assert (await client.get(path + "/deactivation-assignments")).json()[0]["candidates"] == []


async def test_mass_reassignment_rolls_back_first_change_on_second_conflict(client, world):
    payload, volunteers = world
    first = await create(client, payload)
    second = await create(client, payload, planned_time="15:00")
    await create(client, payload, volunteer_id=volunteers[1]["id"], planned_time="15:00")
    path = f"/api/v1/volunteers/{volunteers[0]['id']}"
    response = await client.post(path + "/deactivate", json={"reassignments": [
        {"procedure_id": p["id"], "volunteer_id": volunteers[1]["id"]} for p in [first, second]]})
    assert response.status_code == 409
    assert (await client.get(path)).json()["status"] == "active"
    for procedure in [first, second]:
        assert (await client.get(f"{API}/{procedure['id']}")).json()["volunteer_id"] == volunteers[0]["id"]


async def test_reassignment_rolls_back_on_notification_error(client, world, monkeypatch):
    payload, volunteers = world
    procedure = await create(client, payload)
    async def fail(*args, **kwargs):
        raise RuntimeError("Injected notification failure")
    monkeypatch.setattr(NotificationService, "event", fail)
    with pytest.raises(RuntimeError):
        await client.post(f"/api/v1/volunteers/{volunteers[0]['id']}/deactivate", json={"reassignments": [
            {"procedure_id": procedure["id"], "volunteer_id": volunteers[1]["id"]}]})
    assert (await client.get(f"{API}/{procedure['id']}")).json()["volunteer_id"] == volunteers[0]["id"]
    assert (await client.get(f"/api/v1/volunteers/{volunteers[0]['id']}")).json()["status"] == "active"


async def test_archive_restore_preserves_only_affected_assignments_and_history(client, world, session):
    payload, _ = world
    assigned = await create(client, payload)
    cancelled = await create(client, payload, planned_time="15:00")
    completed = await create(client, payload, planned_time="16:00")
    overdue = await create(client, payload, planned_date=(date.today() - timedelta(days=1)).isoformat())
    await client.patch(f"{API}/{cancelled['id']}", json={"status": "cancelled"})
    await client.post(f"{API}/{completed['id']}/execute", json=outcome())
    path = f"/api/v1/animals/{payload['animal_id']}"
    for _ in range(2):
        assert (await client.post(path + "/archive")).status_code == 200
        assert (await client.post(path + "/archive")).status_code == 200
        assert {p['id'] for p in (await client.get(API)).json()} == {cancelled['id'], completed['id']}
        assert await session.scalar(select(func.count(CareProcedure.id))) == 4
        assert (await client.post(f"{API}/{assigned['id']}/execute", json=outcome())).status_code == 409
        assert (await client.post(API, json=payload | {"planned_time": "20:00"})).status_code == 409
        assert (await client.post(path + "/restore")).status_code == 200
        assert (await client.post(path + "/restore")).status_code == 200
        restored = (await client.get(f"{API}/{assigned['id']}")).json()
        assert restored == assigned
        assert (await client.get(f"{API}/{overdue['id']}")).json()["status"] == "overdue"
        assert (await client.get(f"{API}/{cancelled['id']}")).json()["status"] == "cancelled"
        assert (await client.get(f"{API}/{completed['id']}/execution")).json()["result"] == "Сделано"


async def test_archive_without_assignments_and_independent_cancellation(client, world):
    payload, _ = world
    path = f"/api/v1/animals/{payload['animal_id']}"
    assert (await client.post(path + "/archive")).status_code == 200
    assert (await client.post(path + "/restore")).status_code == 200
    procedure = await create(client, payload)
    await client.post(path + "/archive")
    assert (await client.patch(f"{API}/{procedure['id']}", json={"status": "cancelled"})).status_code == 200
    await client.post(path + "/restore")
    assert (await client.get(f"{API}/{procedure['id']}")).json()["status"] == "cancelled"


async def test_restore_conflict_rolls_back_and_can_be_retried(client, world, animal_data):
    payload, _ = world
    first = await create(client, payload)
    second = await create(client, payload, planned_time="15:00")
    path = f"/api/v1/animals/{payload['animal_id']}"
    await client.post(path + "/archive")
    other = (await client.post("/api/v1/animals", json=animal_data | {"name": "Мурка"})).json()
    conflicting = await create(client, payload, animal_id=other['id'], planned_time="15:00")
    assert (await client.post(path + "/restore")).status_code == 409
    assert (await client.get(path)).json()["status"] == "archived"
    for item in [first, second]:
        assert (await client.get(f"{API}/{item['id']}")).json()["suspended_by_archive"] is True
    await client.patch(f"{API}/{conflicting['id']}", json={"status": "cancelled"})
    assert (await client.post(path + "/restore")).status_code == 200


async def test_overdue_consistent_in_list_filters_reports_and_notifications(client, world):
    payload, _ = world
    day = (date.today() - timedelta(days=1)).isoformat()
    procedure = await create(client, payload, planned_date=day)
    assert procedure['status'] == 'overdue'
    assert (await client.get(API, params={"status": "overdue"})).json()[0]['id'] == procedure['id']
    assert (await client.get(API, params={"status": "assigned"})).json() == []
    params = {"report_type": "procedure_execution", "date_from": day, "date_to": day}
    report = (await client.get('/api/v1/reports', params=params)).json()
    assert next(m['value'] for m in report['metrics'] if m['key'] == 'overdue') == 1
    notifications = (await client.get('/api/v1/notifications')).json()['items']
    assert any(n['kind'] == 'overdue' for n in notifications)
    await client.post(f"/api/v1/animals/{payload['animal_id']}/archive")
    assert (await client.get(API, params={"status": "overdue"})).json() == []
    report = (await client.get('/api/v1/reports', params=params)).json()
    assert all(m['value'] == 0 for m in report['metrics'])


async def test_report_types_distinct_filtered_and_exported(client, world):
    payload, _ = world
    success = await create(client, payload)
    failed = await create(client, payload, planned_time="15:00")
    await create(client, payload, planned_date="2099-10-11")
    await client.post(f"{API}/{success['id']}/execute", json=outcome())
    await client.post(f"{API}/{failed['id']}/execute", json=outcome(is_completed=False, failure_reason="Причина"))
    metrics = []
    for kind in ['animal_care', 'volunteer_activity', 'procedure_execution']:
        params = dict(report_type=kind, date_from='2099-10-10', date_to='2099-10-10', procedure_type_id=payload['procedure_type_id'])
        response = await client.get('/api/v1/reports', params=params)
        assert response.status_code == 200, response.text
        report = response.json()
        values = {m['key']: m['value'] for m in report['metrics']}
        assert values['total'] == 2 and values['completed'] == 1
        metrics.append(set(values))
        if kind == 'animal_care':
            assert report['animal_activity'][0]['total'] == 2
            assert report['volunteer_workload'] == []
        elif kind == 'volunteer_activity':
            assert report['volunteer_workload'][0]['completed_minutes'] == 60
            assert report['procedure_types'] == []
        else:
            assert values['failed'] == 1 and values['cancelled'] == 0
        export = await client.get('/api/v1/reports/export.xlsx', params=params | {'report_id': report['report_id']})
        with ZipFile(BytesIO(export.content)) as workbook:
            content = workbook.read('xl/worksheets/sheet1.xml').decode()
            assert '10.10.2099' in content
            assert all(m['label'] in content for m in report['metrics'])
    assert len({frozenset(m) for m in metrics}) == 3


async def test_migration_backfills_archived_pending_without_changing_history(client, world, db_connection):
    payload, _ = world
    pending = await create(client, payload)
    completed = await create(client, payload, planned_time="15:00")
    await client.post(f"{API}/{completed['id']}/execute", json=outcome())

    def cycle(connection):
        config = Config("alembic.ini")
        config.attributes["connection"] = connection
        command.downgrade(config, "0011_remove_sms_recovery")
        connection.execute(text("UPDATE animals SET status = 'archived' WHERE id = :id"), {"id": payload['animal_id']})
        command.upgrade(config, "head")
        assert connection.scalar(text("SELECT suspended_by_archive FROM care_procedures WHERE id = :id"), {"id": pending['id']}) is True
        assert connection.scalar(text("SELECT suspended_by_archive FROM care_procedures WHERE id = :id"), {"id": completed['id']}) is False
        assert connection.scalar(text("SELECT is_completed FROM procedure_executions WHERE care_procedure_id = :id"), {"id": completed['id']}) is True

    await db_connection.run_sync(cycle)


async def test_legacy_overlapping_assignments_cannot_share_replacement(client, world, session):
    payload, volunteers = world
    first = await create(client, payload)
    second = await create(client, payload, planned_time="15:00")
    # Simulate overlapping records created before overlap checks existed.
    await session.execute(text("UPDATE care_procedures SET planned_time = '14:00' WHERE id = :id"), {"id": second['id']})
    await session.commit()
    response = await client.post(f"/api/v1/volunteers/{volunteers[0]['id']}/deactivate", json={"reassignments": [
        {"procedure_id": p['id'], "volunteer_id": volunteers[1]['id']} for p in [first, second]]})
    assert response.status_code == 409
    for item in [first, second]:
        assert (await client.get(f"{API}/{item['id']}")).json()['volunteer_id'] == volunteers[0]['id']
