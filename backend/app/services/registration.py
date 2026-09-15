import asyncio
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole, RegistrationStatus
from app.models.volunteer import Volunteer, VolunteerStatus
from app.schemas.auth import RegisterRequest
from app.services.auth import hash_password
from app.services.volunteer import volunteer_duplicate_key


class RegistrationService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def commit(self):
        try:
            await self.session.commit()
        except IntegrityError as error:
            await self.session.rollback()
            raise HTTPException(409, "Данные уже используются другой учётной записью. Обновите список и проверьте заявку.") from error

    async def register(self, data: RegisterRequest):
        if await self.session.scalar(select(User.id).where(User.phone == data.phone)):
            raise HTTPException(409, "Этот номер телефона уже зарегистрирован. Войдите или обратитесь к координатору.")
        user = User(full_name=data.full_name, phone=data.phone,
                    password_hash=await asyncio.to_thread(hash_password, data.password),
                    role=None, is_active=False, registration_status=RegistrationStatus.PENDING)
        self.session.add(user)
        await self.commit()

    async def list(self, status: RegistrationStatus, limit: int, offset: int):
        return list(await self.session.scalars(select(User).where(User.registration_status == status)
                    .order_by(User.created_at, User.id).limit(limit).offset(offset)))

    async def review(self, user_id: int, reviewer_id: int, role: UserRole | None):
        user = await self.session.scalar(select(User).where(User.id == user_id)
                    .execution_options(populate_existing=True).with_for_update())
        if user is None:
            raise HTTPException(404, "Заявка не найдена")
        if user.registration_status != RegistrationStatus.PENDING:
            raise HTTPException(409, "Заявка уже рассмотрена. Обновите список.")
        if role == UserRole.VOLUNTEER:
            key = volunteer_duplicate_key(user.full_name, user.phone)
            volunteer = await self.session.scalar(select(Volunteer).where(Volunteer.duplicate_key == key).with_for_update())
            if volunteer:
                if volunteer.status != VolunteerStatus.ACTIVE:
                    raise HTTPException(409, "Карточка волонтёра неактивна. Сначала активируйте её в разделе «Волонтёры».")
                if await self.session.scalar(select(User.id).where(User.volunteer_id == volunteer.id)):
                    raise HTTPException(409, "Карточка волонтёра уже связана с другой учётной записью.")
            else:
                volunteer = Volunteer(full_name=user.full_name, phone=user.phone, duplicate_key=key,
                                      status=VolunteerStatus.ACTIVE)
                self.session.add(volunteer)
                try:
                    await self.session.flush()
                except IntegrityError as error:
                    await self.session.rollback()
                    raise HTTPException(409, "Карточка волонтёра уже появилась. Обновите список и повторите подтверждение.") from error
            user.volunteer_id = volunteer.id
        user.role = role
        user.is_active = role is not None
        user.registration_status = RegistrationStatus.APPROVED if role else RegistrationStatus.REJECTED
        user.reviewed_by = reviewer_id
        user.reviewed_at = datetime.now(timezone.utc)
        await self.commit()
        return user
