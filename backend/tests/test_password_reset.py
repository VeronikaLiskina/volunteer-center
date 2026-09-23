from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from pydantic import SecretStr
from sqlalchemy import select, update

from app.core.config import settings
from app.models.password_reset import PasswordReset, PasswordResetLimit
from app.models.user import User
from app.services.auth import AuthService, token_digest, verify_password
from app.services.sms import SmsDeliveryError, SmsSender

API = "/api/v1/auth/password-reset"
PHONE = "+79990000001"
PASSWORD = "new-password-12345"


@pytest.fixture(autouse=True)
def sms(monkeypatch):
    monkeypatch.setattr(settings, "sms_ru_api_id", SecretStr("test-api-key"))
    monkeypatch.setattr(settings, "password_reset_secret", SecretStr("test-secret-" * 4))
    sender = AsyncMock()
    monkeypatch.setattr(SmsSender, "send_code", sender)
    return sender


async def request_code(client, sms, phone=PHONE):
    response = await client.post(f"{API}/request", json={"phone": phone})
    assert response.status_code == 200, response.text
    return response.json()["request_id"], sms.call_args.args[1]


async def confirm(client, request_id, code, password=PASSWORD):
    return await client.post(f"{API}/confirm", json={"request_id": request_id, "code": code, "password": password})


async def test_recovery_is_public_single_use_and_revokes_sessions(client, session, sms):
    old_token = client.headers.pop("Authorization")
    request_id, code = await request_code(client, sms, " 8 (999) 000-00-01 ")
    sms.assert_awaited_once_with(PHONE, code)
    record = await session.get(PasswordReset, request_id)
    assert len(code) == 6 and len(record.code_hash) == 64
    assert record.code_hash != token_digest(code)
    user = await session.get(User, record.user_id)
    identity = (user.id, user.role, user.volunteer_id, user.is_active, user.registration_status)
    assert (await confirm(client, request_id, code)).status_code == 204
    assert verify_password(PASSWORD, user.password_hash)
    assert identity == (user.id, user.role, user.volunteer_id, user.is_active, user.registration_status)
    assert (await confirm(client, request_id, code)).status_code == 400
    assert (await client.get("/api/v1/auth/me", headers={"Authorization": old_token})).status_code == 401
    assert (await client.post("/api/v1/auth/login", json={"phone": PHONE, "password": "test-password-123"})).status_code == 401
    assert (await client.post("/api/v1/auth/login", json={"phone": PHONE, "password": PASSWORD})).status_code == 200


async def test_unknown_number_has_same_response_without_sms(client, session, sms):
    known = await client.post(f"{API}/request", json={"phone": PHONE})
    sms.reset_mock()
    unknown = await client.post(f"{API}/request", json={"phone": "+79990000999"})
    assert unknown.status_code == known.status_code == 200
    a, b = known.json(), unknown.json()
    assert a.pop("request_id") != b.pop("request_id")
    assert a == b
    sms.assert_not_awaited()
    assert (await confirm(client, unknown.json()["request_id"], "000000")).status_code == 400


async def test_code_expires_and_five_wrong_attempts_lock_it(client, session, sms):
    request_id, code = await request_code(client, sms)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert (await confirm(client, request_id, wrong)).status_code == 400
    assert (await confirm(client, request_id, code)).status_code == 400
    record = await session.get(PasswordReset, request_id)
    assert record.attempts == 5 and record.used_at is not None


async def test_expired_code_does_not_change_password(client, session, sms):
    request_id, code = await request_code(client, sms)
    record = await session.get(PasswordReset, request_id)
    record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await session.commit()
    assert (await confirm(client, request_id, code)).status_code == 400
    user = await session.get(User, record.user_id)
    assert verify_password("test-password-123", user.password_hash)


async def test_normalized_phone_cooldown_and_resend_invalidates_old_code(client, session, sms):
    request_id, code = await request_code(client, sms)
    retry = await client.post(f"{API}/request", json={"phone": "8 (999) 000-00-01"})
    assert retry.status_code == 429
    assert 1 <= int(retry.headers["Retry-After"]) <= 60
    assert sms.await_count == 1
    await session.execute(update(PasswordResetLimit).where(
        PasswordResetLimit.key == token_digest(f"send:phone:minute:{PHONE}"),
    ).values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
    await session.commit()
    new_id, new_code = await request_code(client, sms)
    assert new_id != request_id
    assert (await confirm(client, request_id, code)).status_code == 400
    assert (await confirm(client, new_id, new_code)).status_code == 204


@pytest.mark.parametrize("scope,maximum", [("send:global:day", 200), ("send:ip:127.0.0.1", 20),
                                           (f"send:phone:hour:{PHONE}", 5)])
async def test_shared_limits_prevent_sms(client, session, sms, scope, maximum):
    session.add(PasswordResetLimit(key=token_digest(scope), count=maximum,
                                 expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
    await session.commit()
    assert (await client.post(f"{API}/request", json={"phone": PHONE})).status_code == 429
    sms.assert_not_awaited()


async def test_provider_failure_invalidates_code_and_keeps_cooldown(client, session, sms):
    sms.side_effect = SmsDeliveryError()
    response = await client.post(f"{API}/request", json={"phone": PHONE})
    assert response.status_code == 503
    record = await session.scalar(select(PasswordReset))
    assert record.used_at is not None
    assert (await confirm(client, record.id, sms.call_args.args[1])).status_code == 400
    assert (await client.post(f"{API}/request", json={"phone": PHONE})).status_code == 429


@pytest.mark.parametrize("setting", ["sms_ru_api_id", "password_reset_secret"])
async def test_missing_configuration_fails_without_sms(client, sms, monkeypatch, setting):
    monkeypatch.setattr(settings, setting, None)
    for phone in (PHONE, "+79990000999"):
        assert (await client.post(f"{API}/request", json={"phone": phone})).status_code == 503
    sms.assert_not_awaited()


async def test_admin_password_change_invalidates_issued_code(client, session, sms):
    request_id, code = await request_code(client, sms)
    await AuthService(session).reset_password(PHONE, "admin-reset-password")
    assert (await confirm(client, request_id, code)).status_code == 400


async def test_phone_change_invalidates_issued_code(client, session, sms):
    request_id, code = await request_code(client, sms)
    record = await session.get(PasswordReset, request_id)
    await AuthService(session).update_profile(record.user_id, "+79990000002", "Test User")
    assert (await confirm(client, request_id, code)).status_code == 400


async def test_recovery_does_not_approve_pending_registration(client, session, sms):
    phone = "+79990000002"
    await client.post("/api/v1/auth/register", json={"phone": phone, "full_name": "Новый Пользователь", "password": PASSWORD})
    request_id, code = await request_code(client, sms, phone)
    assert (await confirm(client, request_id, code)).status_code == 204
    assert (await client.post("/api/v1/auth/login", json={"phone": phone, "password": PASSWORD})).status_code == 403


async def test_invalid_inputs_and_weak_password_do_not_consume_valid_code(client, sms):
    assert (await client.post(f"{API}/request", json={"phone": "invalid"})).status_code == 422
    request_id, code = await request_code(client, sms)
    assert (await confirm(client, request_id, code, "short")).status_code == 422
    assert (await confirm(client, request_id, "123")).status_code == 422
    assert (await confirm(client, request_id, code)).status_code == 204
