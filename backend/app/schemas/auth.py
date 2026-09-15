from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.volunteer import Phone, FullName

from app.models.user import UserRole


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
