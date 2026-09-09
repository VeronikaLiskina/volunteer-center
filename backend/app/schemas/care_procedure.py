from datetime import date, time
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.care_procedure import CareProcedureStatus
from app.schemas.care_procedure_type import CareProcedureTypeResponse

PositiveId = Annotated[int, Field(gt=0)]
Duration = Annotated[int, Field(gt=0, le=1440)]
Comment = Annotated[str, Field(max_length=255)]


class AnimalReference(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class VolunteerReference(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str


class CareProcedureInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("comment", mode="before", check_fields=False)
    @classmethod
    def empty_comment_to_none(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value


class CareProcedureCreate(CareProcedureInput):
    animal_id: PositiveId
    procedure_type_id: PositiveId
    planned_date: date
    planned_time: time
    duration_minutes: Duration
    volunteer_id: PositiveId
    comment: Comment | None = None


class CareProcedureUpdate(CareProcedureInput):
    animal_id: PositiveId | None = None
    procedure_type_id: PositiveId | None = None
    planned_date: date | None = None
    planned_time: time | None = None
    duration_minutes: Duration | None = None
    volunteer_id: PositiveId | None = None
    status: CareProcedureStatus | None = None
    comment: Comment | None = None

    @field_validator("status")
    @classmethod
    def reject_completed_status(
        cls, value: CareProcedureStatus | None,
    ) -> CareProcedureStatus | None:
        if value == CareProcedureStatus.COMPLETED:
            raise ValueError(
                "Статус «Выполнена» можно установить только через учёт выполнения"
            )
        return value

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field in ("animal_id", "procedure_type_id", "planned_date", "planned_time",
                      "duration_minutes", "volunteer_id", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"Поле {field} не может быть null")
        return self


class CareProcedureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    animal_id: int
    procedure_type_id: int
    planned_date: date
    planned_time: time
    duration_minutes: int
    volunteer_id: int
    status: CareProcedureStatus
    comment: str | None
    animal: AnimalReference
    procedure_type: CareProcedureTypeResponse
    volunteer: VolunteerReference


class CareProcedureSummaryResponse(BaseModel):
    today_total: int
    today_completed: int
