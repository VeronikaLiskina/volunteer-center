from urllib.parse import parse_qs

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import settings
from app.services.sms import SmsDeliveryError, SmsSender


@pytest.mark.parametrize("result,accepted", [
    ({"status": "OK", "sms": {"79990000001": {"status": "OK"}}}, True),
    ({"status": "ERROR", "status_text": "secret provider detail"}, False),
    ({"status": "OK", "sms": {"79990000001": {"status": "ERROR"}}}, False),
    ({"status": "OK"}, False),
    ([], False),
])
async def test_sms_provider_contract(monkeypatch, result, accepted):
    monkeypatch.setattr(settings, "sms_ru_api_id", SecretStr("private-api-key"))
    monkeypatch.setattr(settings, "sms_ru_sender", "Lapka")

    def handler(request):
        assert str(request.url) == "https://sms.ru/sms/send"
        assert request.method == "POST"
        data = parse_qs(request.content.decode())
        assert data["api_id"] == ["private-api-key"]
        assert data["to"] == ["79990000001"]
        assert data["from"] == ["Lapka"]
        assert "123456" in data["msg"][0]
        return httpx.Response(200, json=result)

    client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: client(transport=httpx.MockTransport(handler), **kwargs))
    if accepted:
        await SmsSender().send_code("+79990000001", "123456")
    else:
        with pytest.raises(SmsDeliveryError, match="^$"):
            await SmsSender().send_code("+79990000001", "123456")


async def test_sms_timeout_is_sanitized(monkeypatch):
    monkeypatch.setattr(settings, "sms_ru_api_id", SecretStr("private-api-key"))

    def handler(request):
        raise httpx.ReadTimeout("private provider details", request=request)

    client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: client(transport=httpx.MockTransport(handler), **kwargs))
    with pytest.raises(SmsDeliveryError, match="^$"):
        await SmsSender().send_code("+79990000001", "123456")
