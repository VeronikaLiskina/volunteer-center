from datetime import datetime, timedelta, timezone

from sqlalchemy import select
import pytest

from app.models.user import AuthSession, UserRole
from app.services.auth import AuthService, hash_password, verify_password
from test_care_procedures import procedure_data, create_volunteer

API = "/api/v1"


def test_password_hashes_are_salted_and_verified():
    first = hash_password("long-test-password")
    assert first != hash_password("long-test-password")
    assert verify_password("long-test-password", first)
    assert not verify_password("wrong", first)
    assert not verify_password("wrong", "invalid")


async def test_password_reset_preserves_account_and_revokes_sessions(client, session):
    service = AuthService(session)
    user = await service.repository.by_phone("+79990000001")
    original_id = user.id
    original_hash = user.password_hash
    for password in ("short", "x" * 1025):
        with pytest.raises(ValueError):
            await service.reset_password(user.phone, password)
    assert user.password_hash == original_hash
    with pytest.raises(ValueError):
        await service.reset_password("+79990000999", "new-long-password")
    updated = await service.reset_password(" 8 (999) 000-00-01 ", "new-long-password")
    assert updated.id == original_id
    assert updated.role == UserRole.COORDINATOR and updated.is_active
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    assert (await client.post(f"{API}/auth/login", json={"phone": user.phone, "password": "test-password-123"})).status_code == 401
    response = await client.post(f"{API}/auth/login", json={"phone": user.phone, "password": "new-long-password"})
    assert response.status_code == 200
    assert response.json()["user"]["id"] == original_id


@pytest.mark.parametrize("phone", ["+79990000001", "89990000001", "8 (999) 000-00-01", "  +7 (999) 000-00-01  "])
async def test_login_normalizes_phone(client, phone):
    response = await client.post(f"{API}/auth/login", json={"phone": phone, "password": "test-password-123"})
    assert response.status_code == 200, response.text
    assert response.json()["user"]["phone"] == "+79990000001"
    assert "login" not in response.json()["user"]


async def test_full_names_preserve_case_and_can_repeat_but_phones_are_unique(client, session):
    service = AuthService(session)
    name = "Ёлкина Анна-Мария Ивановна"
    first = await service.create_user("8 (999) 000-00-02", "test-password-123", UserRole.COORDINATOR, None, full_name=name)
    second = await service.create_user("+79990000003", "test-password-123", UserRole.COORDINATOR, None, full_name=name)
    assert first.id != second.id and first.full_name == second.full_name == name
    with pytest.raises(ValueError):
        await service.create_user("+7 (999) 000-00-02", "test-password-123", UserRole.COORDINATOR, None, full_name="Другое ФИО")
    response = await client.post(f"{API}/auth/login", json={"phone": first.phone, "password": "test-password-123"})
    assert response.status_code == 200
    assert response.json()["user"]["full_name"] == name
    for phone in ("Лискина Вероника Ивановна", "123", "+19990000001", ""):
        assert (await client.post(f"{API}/auth/login", json={"phone": phone, "password": "test-password-123"})).status_code == 422
    assert (await client.post(f"{API}/auth/login", json={"login": name, "password": "test-password-123"})).status_code == 422


async def test_profile_update_preserves_password_and_role(client, session):
    service = AuthService(session)
    user = await service.repository.by_phone("+79990000001")
    original_hash = user.password_hash
    updated = await service.update_profile(user.id, "8 (999) 000-00-05", "Лискина Вероника Ивановна")
    assert updated.password_hash == original_hash
    assert updated.role == UserRole.COORDINATOR
    assert updated.full_name == "Лискина Вероника Ивановна"
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    assert (await client.post(f"{API}/auth/login", json={"phone": "+79990000001", "password": "test-password-123"})).status_code == 401
    response = await client.post(f"{API}/auth/login", json={"phone": "89990000005", "password": "test-password-123"})
    assert response.status_code == 200 and response.json()["user"]["id"] == user.id


async def test_login_expiry_logout_inactive_and_unauthenticated(client, session):
    original = client.headers.pop("Authorization")
    assert (await client.get(f"{API}/animals")).status_code == 401
    assert (await client.get(f"{API}/care-procedures")).status_code == 401
    for login, password in [("+79990000998", "bad"), ("+79990000001", "bad")]:
        assert (await client.post(f"{API}/auth/login", json={"phone": login, "password": password})).status_code == 401
    client.headers["Authorization"] = original
    me = (await client.get(f"{API}/auth/me")).json()
    assert me["role"] == "COORDINATOR" and "password_hash" not in me
    assert (await client.post(f"{API}/auth/logout")).status_code == 204
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    token = (await client.post(f"{API}/auth/login", json={"phone": "8 (999) 000-00-01", "password": "test-password-123"})).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    record = await session.scalar(select(AuthSession))
    record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await session.commit()
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    user = await AuthService(session).repository.by_phone("+79990000001")
    user.is_active = False
    await session.commit()
    assert (await client.post(f"{API}/auth/login", json={"phone": "+79990000001", "password": "test-password-123"})).status_code == 401


async def test_volunteer_scope_and_notifications(client, session, animal_data):
    data = await procedure_data(client, animal_data)
    await AuthService(session).create_user("+79990000002", "volunteer-password", UserRole.VOLUNTEER, data["volunteer_id"], full_name="Test User")
    tomorrow = datetime.now() + timedelta(hours=2)
    own = (await client.post(f"{API}/care-procedures", json=data | {
        "planned_date": tomorrow.date().isoformat(), "planned_time": tomorrow.time().isoformat(),
    })).json()
    other_volunteer = await create_volunteer(client, full_name="Другой Волонтёр", phone="89990000001")
    other = (await client.post(f"{API}/care-procedures", json=data | {"volunteer_id": other_volunteer["id"]})).json()
    coordinator_header = client.headers["Authorization"]
    token = (await client.post(f"{API}/auth/login", json={"phone": "+79990000002", "password": "volunteer-password"})).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    for path in ("animals", "volunteers", "animal-types", "breeds", "care-procedure-types", "analytics", "reports"):
        assert (await client.get(f"{API}/{path}")).status_code == 403
    procedures = (await client.get(f"{API}/care-procedures", params={"volunteer_id": other_volunteer["id"]})).json()
    assert [p["id"] for p in procedures] == [own["id"]]
    assert (await client.get(f"{API}/care-procedures/{other['id']}")).status_code == 404
    assert (await client.get(f"{API}/care-procedures/{other['id']}/execution")).status_code == 404
    assert (await client.post(f"{API}/care-procedures", json=data)).status_code == 403
    assert (await client.patch(f"{API}/care-procedures/{own['id']}", json={"comment": "edit"})).status_code == 403
    notices = (await client.get(f"{API}/notifications")).json()
    assert {item["kind"] for item in notices["items"]} == {"assigned", "upcoming"}
    assert (await client.get(f"{API}/notifications")).json() == notices
    assert (await client.patch(f"{API}/notifications/{notices['items'][0]['id']}/read")).status_code == 204
    assert (await client.get(f"{API}/notifications")).json()["unread_count"] == 1
    execution = {"execution_date": datetime.now().date().isoformat(), "execution_time": "12:00:00", "result": "Готово"}
    assert (await client.post(f"{API}/care-procedures/{other['id']}/execute", json=execution)).status_code == 404
    assert (await client.post(f"{API}/care-procedures/{own['id']}/execute", json=execution)).status_code == 201
    assert (await client.post(f"{API}/care-procedures/{own['id']}/execute", json=execution)).status_code == 409
    client.headers["Authorization"] = coordinator_header
    coordinator_notice = (await client.get(f"{API}/notifications")).json()["items"][0]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.patch(f"{API}/notifications/{coordinator_notice['id']}/read")).status_code == 404


async def test_notification_changes_cancellation_reassignment_overdue(client, session, animal_data):
    data = await procedure_data(client, animal_data)
    await AuthService(session).create_user("+79990000002", "volunteer-password", UserRole.VOLUNTEER, data["volunteer_id"], full_name="Test User")
    other_volunteer = await create_volunteer(client, full_name="Другой Волонтёр", phone="89990000001")
    await AuthService(session).create_user("+79990000003", "volunteer-password", UserRole.VOLUNTEER, other_volunteer["id"], full_name="Test User")
    past = (datetime.now() - timedelta(days=1)).date().isoformat()
    procedure = (await client.post(f"{API}/care-procedures", json=data | {"planned_date": past})).json()
    url = f"{API}/care-procedures/{procedure['id']}"
    initial = (await client.get(f"{API}/notifications")).json()
    assert {n["kind"] for n in initial["items"]} == {"assigned", "overdue"}
    assert (await client.patch(url, json={"comment": "Новое примечание"})).status_code == 200
    assert (await client.patch(url, json={"volunteer_id": other_volunteer["id"]})).status_code == 200
    assert (await client.patch(url, json={"status": "cancelled"})).status_code == 200
    notices = (await client.get(f"{API}/notifications")).json()["items"]
    assert {n["kind"] for n in notices} == {"assigned", "overdue", "changed", "cancelled"}
    token = (await client.post(f"{API}/auth/login", json={"phone": "+79990000002", "password": "volunteer-password"})).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert "reassigned" in {n["kind"] for n in (await client.get(f"{API}/notifications")).json()["items"]}
    assert (await client.get(url)).status_code == 404
