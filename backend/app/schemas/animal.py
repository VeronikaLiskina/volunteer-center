import re
from datetime import date
from decimal import Decimal
from typing import Annotated, Self

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.animal import AnimalStatus
from app.schemas.animal_type import AnimalTypeResponse
from app.schemas.breed import BreedResponse


def validate_birth_year(value: int) -> int:
    if value > date.today().year:
        raise ValueError("Год рождения не может быть больше текущего")
    return value


def normalize_phone(value: str) -> str:
    if not re.fullmatch(r"[+0-9()\s-]+", value):
        raise ValueError("Используйте формат +7 (999) 123-45-67")
    digits = re.sub(r"\D", "", value)
    if len(digits) != 11 or digits[0] not in "78":
        raise ValueError("Используйте формат +7 (999) 123-45-67")
    if "+" in value and (not value.startswith("+7") or value.count("+") != 1):
        raise ValueError("Используйте формат +7 (999) 123-45-67")
    return "+7" + digits[1:]


AnimalName = Annotated[str, Field(min_length=1, max_length=50)]
PositiveId = Annotated[int, Field(gt=0)]
Weight = Annotated[Decimal, Field(gt=0, max_digits=6, decimal_places=2, allow_inf_nan=False)]
BirthYear = Annotated[int, Field(ge=1900), AfterValidator(validate_birth_year)]
OwnerName = Annotated[str, Field(max_length=100)]
Phone = Annotated[str, Field(max_length=32), AfterValidator(normalize_phone)]
Note = Annotated[str, Field(max_length=255)]


class AnimalInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("owner_name", "owner_phone", "note", mode="before", check_fields=False)
    @classmethod
    def empty_to_none(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value


class AnimalCreate(AnimalInput):
    name: AnimalName
    animal_type_id: PositiveId
    breed_id: PositiveId
    weight: Weight
    birth_year: BirthYear
    owner_name: OwnerName | None = None
    owner_phone: Phone | None = None
    note: Note | None = None


class AnimalUpdate(AnimalInput):
    name: AnimalName | None = None
    animal_type_id: PositiveId | None = None
    breed_id: PositiveId | None = None
    weight: Weight | None = None
    birth_year: BirthYear | None = None
    owner_name: OwnerName | None = None
    owner_phone: Phone | None = None
    note: Note | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field in ("name", "animal_type_id", "breed_id", "weight", "birth_year"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"Поле {field} не может быть null")
        return self


class AnimalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    animal_type_id: int
    breed_id: int
    weight: Decimal
    birth_year: int
    owner_name: str | None
    owner_phone: str | None
    note: str | None
    status: AnimalStatus
    animal_type: AnimalTypeResponse
    breed: BreedResponse


class AnimalSummaryResponse(BaseModel):
    total: int
    in_care: int
    archived: int
