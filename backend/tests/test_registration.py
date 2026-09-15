from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select, func
from app.models.user import User, AuthSession
from app.models.volunteer import Volunteer
from app.services.auth import token_digest, verify_password

API = "/api/v1"
DATA = {"full_name": "Лискина Вероника Ивановна", "phone": "8 (902) 578-12-90", "password": " registration-password "}


async def register(client, session, **changes):
    data = DATA | changes
    response = await client.post(f"{API}/auth/register", json=data)
    assert response.status_code == 201, response.text
    assert "password" not in response.text and "access_token" not in response.text
    return await session.scalar(select(User).where(User.full_name == data["full_name"]).order_by(User.id.desc()))


async def test_registration_approval_login_and_scope(client, session):
    coordinator = client.headers.pop("Authorization")
    user = await register(client, session)
    assert user.phone == "+79025781290" and user.full_name == DATA["full_name"]
    assert user.role is None and not user.is_active and user.registration_status == "pending"
    assert verify_password(DATA["password"], user.password_hash)
    password_hash = user.password_hash
    credentials = {"phone": user.phone, "password": DATA["password"]}
    pending = await client.post(f"{API}/auth/login", json=credentials)
    assert pending.status_code == 403 and "ожидает" in pending.text
    assert "access_token" not in pending.json()
    assert (await client.post(f"{API}/auth/login", json=credentials | {"password": "wrong"})).status_code == 401
    assert (await client.get(f"{API}/registrations")).status_code == 401
    assert (await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "COORDINATOR"})).status_code == 401
    # Even a pre-existing token cannot bypass approval status checks.
    session.add(AuthSession(user_id=user.id, token_hash=token_digest("pending-token"), expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
    await session.commit()
    client.headers["Authorization"] = "Bearer pending-token"
    for path in ("auth/me", "care-procedures", "notifications", "animals", "reports", "registrations"):
        assert (await client.get(f"{API}/{path}")).status_code == 401
    client.headers["Authorization"] = coordinator
    rows = (await client.get(f"{API}/registrations")).json()
    assert rows[0]["id"] == user.id and "password_hash" not in rows[0]
    approved = await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "VOLUNTEER"})
    assert approved.status_code == 200, approved.text
    result = approved.json()
    assert result["role"] == "VOLUNTEER" and result["reviewed_by"] is not None and result["reviewed_at"]
    volunteer = await session.get(Volunteer, result["volunteer_id"])
    assert volunteer.full_name == DATA["full_name"] and volunteer.phone == user.phone
    assert user.password_hash == password_hash
    assert (await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "COORDINATOR"})).status_code == 409
    token = (await client.post(f"{API}/auth/login", json=credentials)).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get(f"{API}/care-procedures")).json() == []
    assert (await client.get(f"{API}/registrations")).status_code == 403
    assert (await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "COORDINATOR"})).status_code == 403
    assert (await client.post(f"{API}/registrations/{user.id}/reject")).status_code == 403


@pytest.mark.parametrize("changes", [{"role": "COORDINATOR"}, {"is_active": True}, {"registration_status": "approved"},
    {"volunteer_id": 1}, {"password": "short"}, {"full_name": "  "}, {"phone": "123"}])
async def test_registration_rejects_privilege_fields_and_invalid_input(client, changes):
    assert (await client.post(f"{API}/auth/register", json=DATA | changes)).status_code == 422


async def test_duplicate_phone_and_rejection(client, session):
    user = await register(client, session)
    duplicate = await client.post(f"{API}/auth/register", json=DATA | {"phone": "+79025781290", "full_name": "Другое ФИО"})
    assert duplicate.status_code == 409
    assert (await client.post(f"{API}/registrations/{user.id}/reject")).status_code == 200
    denied = await client.post(f"{API}/auth/login", json={"phone": user.phone, "password": DATA["password"]})
    assert denied.status_code == 403 and "отклонена" in denied.text
    assert user.role is None and user.volunteer_id is None and not user.is_active
    assert (await client.get(f"{API}/registrations")).json() == []
    assert (await client.get(f"{API}/registrations?status=rejected")).json()[0]["id"] == user.id


async def test_coordinator_approval_does_not_create_volunteer(client, session):
    user = await register(client, session)
    assert (await client.post(f"{API}/registrations/{user.id}/approve", json={})).status_code == 422
    assert (await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "ADMIN"})).status_code == 422
    response = await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "COORDINATOR"})
    assert response.status_code == 200 and response.json()["volunteer_id"] is None
    token = (await client.post(f"{API}/auth/login", json={"phone": user.phone, "password": DATA["password"]})).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    assert (await client.get(f"{API}/registrations")).status_code == 200


async def test_existing_volunteer_is_reused_and_inactive_requires_activation(client, session):
    volunteer = (await client.post(f"{API}/volunteers", json={"full_name": DATA["full_name"].lower(), "phone": DATA["phone"]})).json()
    user = await register(client, session)
    record = await session.get(Volunteer, volunteer["id"])
    record.status = "inactive"
    await session.commit()
    assert (await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "VOLUNTEER"})).status_code == 409
    assert user.role is None and user.registration_status == "pending"
    record.status = "active"
    await session.commit()
    approved = await client.post(f"{API}/registrations/{user.id}/approve", json={"role": "VOLUNTEER"})
    assert approved.status_code == 200 and approved.json()["volunteer_id"] == volunteer["id"]
    assert await session.scalar(select(func.count()).select_from(Volunteer)) == 1
