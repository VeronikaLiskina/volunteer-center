from datetime import date
from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from datetime import timedelta


async def create_analytics_data(client, animal_data):
    animal = (await client.post("/api/v1/animals", json=animal_data)).json()
    volunteer = (await client.post("/api/v1/volunteers", json={
        "full_name": "Иванова Анна", "phone": "89991234567",
    })).json()
    procedure_types = (await client.get("/api/v1/care-procedure-types")).json()
    today = date.today().isoformat()
    base = {
        "animal_id": animal["id"], "planned_date": today,
        "duration_minutes": 30, "volunteer_id": volunteer["id"], "comment": None,
    }
    completed = (await client.post("/api/v1/care-procedures", json=base | {
        "procedure_type_id": procedure_types[0]["id"], "planned_time": "10:00:00",
    })).json()
    cancelled = (await client.post("/api/v1/care-procedures", json=base | {
        "procedure_type_id": procedure_types[1]["id"], "planned_time": "12:00:00",
    })).json()
    execution = {
        "execution_date": today, "execution_time": "10:20:00",
        "result": "Выполнено", "comment": None,
    }
    assert (await client.post(
        f"/api/v1/care-procedures/{completed['id']}/execute", json=execution,
    )).status_code == 201
    assert (await client.patch(
        f"/api/v1/care-procedures/{cancelled['id']}", json={"status": "cancelled"},
    )).status_code == 200
    return today


async def test_analytics_uses_real_aggregates(client, animal_data):
    today = await create_analytics_data(client, animal_data)
    response = await client.get("/api/v1/analytics")
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["animals"] == {"total": 1, "in_care": 1, "archived": 0}
    assert result["volunteers"] == {"total": 1, "active": 1, "inactive": 0}
    assert result["procedures"] == {
        "total": 2, "assigned": 0, "completed": 1, "cancelled": 1, "overdue": 0,
    }
    assert len(result["executions_by_month"]) == 6
    current_month = today[:7]
    assert next(item for item in result["executions_by_month"] if item["month"] == current_month)["completed"] == 1
    assert sum(item["count"] for item in result["procedure_types"]) == 2
    assert sum(item["percentage"] for item in result["procedure_types"]) == 100
    assert result["volunteer_activity"][0]["full_name"] == "Иванова Анна"
    assert result["volunteer_activity"][0]["completed_count"] == 1


async def test_reports_by_type_and_period_validation(client, animal_data):
    today = await create_analytics_data(client, animal_data)
    for report_type, expected_keys in (
        ("animal_care", ["animals", "total", "completed"]),
        ("volunteer_activity", ["volunteers", "total", "completed"]),
        ("procedure_execution", ["total", "completed", "cancelled", "overdue"]),
    ):
        response = await client.get("/api/v1/reports", params={
            "report_type": report_type, "date_from": today, "date_to": today,
        })
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["report_type"] == report_type
        assert set(expected_keys) <= {metric["key"] for metric in result["metrics"]}
        assert len(result["metrics"]) == 7

    invalid = await client.get("/api/v1/reports", params={
        "report_type": "procedure_execution",
        "date_from": "2026-09-30", "date_to": "2026-09-01",
    })
    assert invalid.status_code == 422
    assert invalid.json()["detail"]["field"] == "date_to"
    assert (await client.get("/api/v1/reports", params={
        "report_type": "unknown", "date_from": today, "date_to": today,
    })).status_code == 422


async def test_empty_analytics_is_stable(client):
    response = await client.get("/api/v1/analytics")
    assert response.status_code == 200
    result = response.json()
    assert result["procedures"]["total"] == 0
    assert result["procedure_types"] == []
    assert result["volunteer_activity"] == []
    assert [item["completed"] for item in result["executions_by_month"]] == [0] * 6


async def test_report_can_be_exported_as_real_xlsx(client, animal_data):
    today = await create_analytics_data(client, animal_data)
    response = await client.get("/api/v1/reports/export.xlsx", params={
        "report_type": "procedure_execution", "date_from": today, "date_to": today,
    })
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.headers["content-disposition"].endswith(f'{today}-{today}.xlsx"')
    with ZipFile(BytesIO(response.content)) as workbook:
        assert "xl/workbook.xml" in workbook.namelist()
        assert "xl/worksheets/sheet1.xml" in workbook.namelist()
        sheet = workbook.read("xl/worksheets/sheet1.xml").decode("utf-8")
        assert "Выполнение процедур" in sheet
        assert "Всего процедур" in sheet


async def test_period_service_filters_and_export_agree(client, animal_data):
    today = await create_analytics_data(client, animal_data)
    procedures = (await client.get("/api/v1/care-procedures")).json()
    completed = next(p for p in procedures if p["status"] == "completed")
    # An execution date outside the planned period still belongs to its selected assignment.
    await client.patch(f"/api/v1/care-procedures/{completed['id']}/execution", json={"execution_date": "2020-01-01"})
    base = {k: completed[k] for k in ("animal_id", "volunteer_id", "procedure_type_id", "planned_time", "duration_minutes")}
    for day in (date.today() - timedelta(days=1), date.today() + timedelta(days=1)):
        assert (await client.post("/api/v1/care-procedures", json=base | {"planned_date": day.isoformat()})).status_code == 201
    filters = {"report_type": "procedure_execution", "date_from": today, "date_to": today,
               "procedure_type_id": completed["procedure_type_id"]}
    report = (await client.get("/api/v1/reports", params=filters)).json()
    values = {m["key"]: m["value"] for m in report["metrics"]}
    assert values == {"total": 1, "completed": 1, "assigned": 0, "cancelled": 0, "overdue": 0, "animals": 1, "volunteers": 1}
    assert sum(r["completed"] for r in report["executions_by_month"]) == 1
    assert sum(r["count"] for r in report["procedure_types"]) == 1
    assert sum(r["completed_count"] for r in report["volunteer_activity"]) == 1
    assert len(report["executions_by_month"]) == 1
    assert len(report["procedure_types"]) == 1
    analytics = (await client.get("/api/v1/analytics", params=filters)).json()
    assert {k: v for k, v in analytics.items() if k not in ("report_id", "generated_at")} == {
        k: v for k, v in report.items() if k not in ("report_id", "generated_at")}
    exported = await client.get("/api/v1/reports/export.xlsx", params=filters | {"report_id": report["report_id"]})
    with ZipFile(BytesIO(exported.content)) as workbook:
        root = ET.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
        ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        assert report["procedure_type_name"] in "".join(root.itertext())
        for row, metric in enumerate(report["metrics"], 5):
            assert root.find(f".//s:c[@r='B{row}']/s:v", ns).text == str(metric["value"])
        assert root.find("s:pageSetup", ns).get("fitToWidth") == "1"
    empty = (await client.get("/api/v1/reports", params=filters | {"date_from": "2019-01-01", "date_to": "2019-12-31"})).json()
    assert all(m["value"] == 0 for m in empty["metrics"])
    assert len(empty["executions_by_month"]) == 12
    assert empty["volunteer_activity"] == []
    for endpoint in ("reports", "reports/export.xlsx", "analytics"):
        assert (await client.get(f"/api/v1/{endpoint}", params=filters | {"procedure_type_id": 999999})).status_code == 422
        assert (await client.get(f"/api/v1/{endpoint}", params=filters | {"date_from": "2099-01-01"})).status_code == 422


async def test_generated_export_survives_changes_and_checks_ownership(client, session, animal_data):
    from app.models.user import UserRole
    from app.services.auth import AuthService
    from app.models.report_snapshot import ReportSnapshot
    from datetime import datetime, timezone
    from sqlalchemy import select

    today = await create_analytics_data(client, animal_data)
    filters = {"report_type": "procedure_execution", "date_from": today, "date_to": today}
    report = (await client.get("/api/v1/reports", params=filters)).json()
    filters["report_id"] = report["report_id"]
    initial = await client.get("/api/v1/reports/export.xlsx", params=filters)
    procedure = (await client.get("/api/v1/care-procedures")).json()[0]
    base = {k: procedure[k] for k in ("animal_id", "volunteer_id", "procedure_type_id", "planned_date", "planned_time", "duration_minutes")}
    assert (await client.post("/api/v1/care-procedures", json=base)).status_code == 201
    after = await client.get("/api/v1/reports/export.xlsx", params=filters)
    with ZipFile(BytesIO(initial.content)) as before_zip, ZipFile(BytesIO(after.content)) as after_zip:
        assert before_zip.read("xl/worksheets/sheet1.xml") == after_zip.read("xl/worksheets/sheet1.xml")
    assert (await client.get("/api/v1/reports/export.xlsx", params=filters | {"date_to": "2099-01-01"})).status_code == 422
    coordinator_token = client.headers["Authorization"]
    await AuthService(session).create_user("+79990000004", "other-password-123", UserRole.COORDINATOR, None, full_name="Test User")
    token = (await client.post("/api/v1/auth/login", json={"phone": "+79990000004", "password": "other-password-123"})).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get("/api/v1/reports/export.xlsx", params=filters)).status_code == 404
    client.headers["Authorization"] = coordinator_token
    snapshot = await session.scalar(select(ReportSnapshot).where(ReportSnapshot.id == report["report_id"]))
    snapshot.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await session.commit()
    assert (await client.get("/api/v1/reports/export.xlsx", params=filters)).status_code == 404
