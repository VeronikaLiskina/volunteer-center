import pytest
from sqlalchemy import text


@pytest.mark.parametrize("endpoint", ["request", "confirm"])
async def test_sms_recovery_endpoints_are_unavailable(client, endpoint):
    client.headers.pop("Authorization", None)
    response = await client.post(f"/api/v1/auth/password-reset/{endpoint}", json={})
    assert response.status_code == 404


async def test_sms_recovery_tables_are_removed(session):
    tables = (await session.execute(text(
        "SELECT tablename FROM pg_tables WHERE schemaname = current_schema()"
    ))).scalars().all()
    assert "users" in tables
    assert "password_resets" not in tables
    assert "password_reset_limits" not in tables
