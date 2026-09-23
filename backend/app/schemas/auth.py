from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.volunteer import Phone, FullName

from app.models.user import UserRole, RegistrationStatus
from datetime import datetime


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    phone: Phone
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("phone", mode="before")
    @classmethod
    def strip_phone(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class UserProfile(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    phone: Phone
    full_name: FullName

    @field_validator("full_name")
    @classmethod
    def require_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Укажите ФИО")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    phone: str | None
    full_name: str
    role: UserRole
    is_active: bool
    volunteer_id: int | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterRequest(LoginRequest):
    full_name: FullName
    password: str = Field(min_length=12, max_length=1024)

    @field_validator("full_name")
    @classmethod
    def require_name(cls, value: str) -> str:
        if not value:
            raise ValueError("Укажите ФИО")
        return value


class RegistrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    phone: str | None
    registration_status: RegistrationStatus
    role: UserRole | None
    created_at: datetime
    reviewed_at: datetime | None
    reviewed_by: int | None
    volunteer_id: int | None


class ApproveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: UserRole


class PasswordResetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    phone: Phone


class PasswordResetResponse(BaseModel):
    request_id: str
    message: str = "Если этот номер зарегистрирован, на него придёт SMS с кодом."
    resend_after: int = 60
    expires_in: int = 300


class PasswordResetConfirm(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request_id: str = Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    code: str = Field(pattern=r"^[0-9]{6}$")
    password: str = Field(min_length=12, max_length=1024)
