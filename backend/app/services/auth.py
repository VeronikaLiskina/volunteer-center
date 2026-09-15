import asyncio
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.user import AuthSession, User, UserRole
from app.repositories.auth import AuthRepository
from app.repositories.volunteer import VolunteerRepository
from app.schemas.auth import TokenResponse, UserResponse, UserProfile
from app.schemas.volunteer import normalize_phone


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**17, r=8, p=1, maxmem=256*1024*1024)
    return f"scrypt${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt, _ = stored.split("$")
        return algorithm == "scrypt" and hmac.compare_digest(hash_password(password, salt), stored)
    except (ValueError, TypeError):
        return False


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = AuthRepository(session)

    async def login(self, phone: str, password: str) -> TokenResponse:
        user = await self.repository.by_phone(normalize_phone(phone.strip()))
        # Equal password work for unknown logins avoids an account enumeration shortcut.
        stored = user.password_hash if user else "scrypt$" + "00"*16 + "$" + "00"*64
        valid = await asyncio.to_thread(verify_password, password, stored)
        if not valid or user is None or not user.is_active:
            raise HTTPException(401, "Неверный номер телефона или пароль", headers={"WWW-Authenticate": "Bearer"})
        token = secrets.token_urlsafe(32)
        self.repository.add(AuthSession(user_id=user.id, token_hash=token_digest(token),
                                        expires_at=datetime.now(timezone.utc) + timedelta(hours=8)))
        await self.session.commit()
        return TokenResponse(access_token=token, user=UserResponse.model_validate(user))

    async def authenticate(self, token: str) -> User:
        user = await self.repository.by_token(token_digest(token))
        if user is None:
            raise HTTPException(401, "Сессия истекла. Войдите снова", headers={"WWW-Authenticate": "Bearer"})
        return user

    async def logout(self, token: str) -> None:
        await self.repository.revoke(token_digest(token))
        await self.session.commit()

    async def reset_password(self, phone: str, password: str) -> User:
        if not 12 <= len(password) <= 1024:
            raise ValueError("Пароль должен содержать от 12 до 1024 символов")
        user = await self.repository.by_phone(normalize_phone(phone.strip()))
        if user is None:
            raise ValueError("Пользователь с таким номером телефона не найден")
        user.password_hash = await asyncio.to_thread(hash_password, password)
        await self.repository.revoke_user_sessions(user.id)
        await self.session.commit()
        return user

    async def save_profile(self) -> None:
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise ValueError("Не удалось сохранить учётную запись: номер телефона уже занят или данные изменились") from error

    async def update_profile(self, user_id: int, phone: str, full_name: str) -> User:
        profile = UserProfile(phone=phone, full_name=full_name)
        user = await self.repository.get(user_id)
        if user is None:
            raise ValueError("Пользователь не найден")
        existing = await self.repository.by_phone(profile.phone)
        if existing is not None and existing.id != user.id:
            raise ValueError("Номер телефона уже используется другой учётной записью")
        if user.phone != profile.phone:
            await self.repository.revoke_user_sessions(user.id)
        user.phone = profile.phone
        user.full_name = profile.full_name
        await self.save_profile()
        return user

    async def create_user(self, phone: str, password: str, role: UserRole, volunteer_id: int | None,
                          *, full_name: str) -> User:
        profile = UserProfile(phone=phone, full_name=full_name)
        if not 12 <= len(password) <= 1024:
            raise ValueError("Пароль должен содержать от 12 до 1024 символов")
        if await self.repository.by_phone(profile.phone):
            raise ValueError("Номер телефона уже используется другой учётной записью")
        if role == UserRole.VOLUNTEER and volunteer_id is None:
            raise ValueError("Укажите ID волонтёра")
        if volunteer_id is not None and await VolunteerRepository(self.session).get(volunteer_id) is None:
            raise ValueError("Волонтёр не найден")
        user = User(phone=profile.phone, full_name=profile.full_name, password_hash=await asyncio.to_thread(hash_password, password),
                    role=role, volunteer_id=volunteer_id)
        self.repository.add(user)
        await self.save_profile()
        return user
