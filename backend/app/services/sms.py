import httpx

from app.core.config import settings


class SmsDeliveryError(Exception):
    pass


class SmsSender:
    def ensure_configured(self) -> None:
        if not settings.sms_ru_api_id or not settings.sms_ru_api_id.get_secret_value().strip():
            raise SmsDeliveryError()

    async def send_code(self, phone: str, code: str) -> None:
        self.ensure_configured()
        recipient = phone.removeprefix("+")
        data = {
            "api_id": settings.sms_ru_api_id.get_secret_value(),
            "to": recipient,
            "msg": f"Лапка: код смены пароля {code}. Действует 5 минут.",
            "json": "1",
        }
        if settings.sms_ru_sender:
            data["from"] = settings.sms_ru_sender
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post("https://sms.ru/sms/send", data=data)
                response.raise_for_status()
                result = response.json()
            if result.get("status") != "OK" or result.get("sms", {}).get(recipient, {}).get("status") != "OK":
                raise SmsDeliveryError()
        except (httpx.HTTPError, ValueError, TypeError, AttributeError):
            # Do not expose provider responses, phone numbers, API keys or codes.
            raise SmsDeliveryError() from None
