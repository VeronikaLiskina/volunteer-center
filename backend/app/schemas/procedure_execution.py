from datetime import date, datetime, time
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Result = Annotated[str, Field(min_length=1)]
Comment = Annotated[str, Field(max_length=255)]


class ProcedureExecutionInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("comment", mode="before", check_fields=False)
    @classmethod
    def empty_comment_to_none(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value


class ProcedureExecutionCreate(ProcedureExecutionInput):
    execution_date: date
    execution_time: time
    result: Result
    comment: Comment | None = None


class ProcedureExecutionUpdate(ProcedureExecutionInput):
    execution_date: date | None = None
    execution_time: time | None = None
    result: Result | None = None
    comment: Comment | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> Self:
        for field in ("execution_date", "execution_time", "result"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"Поле {field} не может быть null")
        return self


class ProcedureExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    care_procedure_id: int
    execution_date: date
    execution_time: time
    result: str
    comment: str | None
    created_at: datetime
