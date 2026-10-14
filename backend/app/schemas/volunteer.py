import re
from datetime import time
from typing import Annotated, Self

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.volunteer import VolunteerStatus


def normalize_full_name(value: str) -> str:
    return " ".join(value.split())


def normalize_phone(value: str) -> str:
    if not re.fullmatch(r"[+0-9()\s-]+", value):
        raise ValueError("Используйте формат +7 (999) 123-45-67")
    digits = re.sub(r"\D", "", value)
    if len(digits) != 11 or digits[0] not in "78":
        raise ValueError("Используйте формат +7 (999) 123-45-67")
    if "+" in value and (not value.startswith("+7") or value.count("+") != 1):
        raise ValueError("Используйте формат +7 (999) 123-45-67")
    return "+7" + digits[1:]


FullName = Annotated[str, Field(min_length=1, max_length=100), AfterValidator(normalize_full_name)]
Phone = Annotated[str, Field(max_length=32), AfterValidator(normalize_phone)]
Note = Annotated[str, Field(max_length=255)]


class VolunteerInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    available_from: time | None = None
    available_to: time | None = None

    @model_validator(mode="after")
    def validate_availability(self) -> Self:
        if any(value is not None and value.tzinfo is not None for value in (self.available_from, self.available_to)):
            raise ValueError("Укажите местное время без часового пояса")
        if self.available_from is not None and self.available_to is not None and self.available_from >= self.available_to:
            raise ValueError("Начало доступности должно быть раньше окончания")
        return self

    @field_validator("note", mode="before", check_fields=False)
    @classmethod
    def empty_note_to_none(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value


class VolunteerCreate(VolunteerInput):
    full_name: FullName
    phone: Phone
    note: Note | None = None


class VolunteerUpdate(VolunteerInput):
    full_name: FullName | None = None
    phone: Phone | None = None
    note: Note | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field in ("full_name", "phone"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"Поле {field} не может быть null")
        return self


class VolunteerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    status: VolunteerStatus
    note: str | None
    available_from: time | None = None
    available_to: time | None = None


class VolunteerSummaryResponse(BaseModel):
    total: int
    active: int
    inactive: int


class Reassignment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    procedure_id: int = Field(gt=0)
    volunteer_id: int = Field(gt=0)


class VolunteerDeactivate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reassignments: list[Reassignment] = Field(default_factory=list)
