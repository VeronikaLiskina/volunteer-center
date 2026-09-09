from datetime import date
from io import BytesIO
from zipfile import ZipFile


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
        assert [metric["key"] for metric in result["metrics"]] == expected_keys

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
