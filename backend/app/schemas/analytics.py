from datetime import date, datetime
from uuid import UUID
from enum import StrEnum

from pydantic import BaseModel


class AnimalAnalytics(BaseModel):
    total: int
    in_care: int
    archived: int


class VolunteerAnalytics(BaseModel):
    total: int
    active: int
    inactive: int


class ProcedureAnalytics(BaseModel):
    total: int
    assigned: int
    completed: int
    cancelled: int
    overdue: int


class MonthlyExecution(BaseModel):
    month: str
    label: str
    completed: int


class ProcedureTypeShare(BaseModel):
    procedure_type_id: int
    name: str
    count: int
    percentage: float


class VolunteerActivity(BaseModel):
    volunteer_id: int
    full_name: str
    completed_count: int


class AnalyticsResponse(BaseModel):
    animals: AnimalAnalytics
    volunteers: VolunteerAnalytics
    procedures: ProcedureAnalytics
    executions_by_month: list[MonthlyExecution]
    procedure_types: list[ProcedureTypeShare]
    volunteer_activity: list[VolunteerActivity]


class ReportType(StrEnum):
    ANIMAL_CARE = "animal_care"
    VOLUNTEER_ACTIVITY = "volunteer_activity"
    PROCEDURE_EXECUTION = "procedure_execution"


class ReportMetric(BaseModel):
    key: str
    label: str
    value: int


class AnimalActivity(BaseModel):
    animal_id: int
    name: str
    total: int
    completed: int


class VolunteerWorkload(BaseModel):
    volunteer_id: int
    full_name: str
    total: int
    completed: int
    completed_minutes: int


class ReportResponse(BaseModel):
    report_type: ReportType
    title: str
    date_from: date
    date_to: date
    metrics: list[ReportMetric]
    procedure_type_id: int | None = None
    procedure_type_name: str = "Все услуги"
    executions_by_month: list[MonthlyExecution] = []
    procedure_types: list[ProcedureTypeShare] = []
    volunteer_activity: list[VolunteerActivity] = []
    report_id: UUID | None = None
    generated_at: datetime | None = None
    animal_activity: list[AnimalActivity] = []
    volunteer_workload: list[VolunteerWorkload] = []
