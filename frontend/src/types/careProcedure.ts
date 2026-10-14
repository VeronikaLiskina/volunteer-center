export const CareProcedureStatus = {
  Assigned: "assigned",
  Completed: "completed",
  Cancelled: "cancelled",
  Overdue: "overdue",
} as const;

export type CareProcedureStatus =
  (typeof CareProcedureStatus)[keyof typeof CareProcedureStatus];

export const careProcedureStatusLabels: Record<CareProcedureStatus, string> = {
  assigned: "Назначена",
  completed: "Выполнена",
  cancelled: "Отменена",
  overdue: "Просрочена",
};

export interface CareProcedureType { id: number; name: string }
export interface CareProcedureAnimal { id: number; name: string }
export interface CareProcedureVolunteer { id: number; full_name: string; status?: "active" | "inactive"; note?: string | null; available_from?: string | null; available_to?: string | null }

export interface CareProcedureCreate {
  animal_id: number;
  procedure_type_id: number;
  planned_date: string;
  planned_time: string;
  duration_minutes: number;
  volunteer_id: number;
  comment: string | null;
}

export type CareProcedureEditableStatus = Exclude<
  CareProcedureStatus, typeof CareProcedureStatus.Completed
>;

export type CareProcedureUpdate = Partial<CareProcedureCreate> & {
  status?: CareProcedureEditableStatus;
};

export interface CareProcedure extends CareProcedureCreate {
  suspended_by_archive?: boolean;
  id: number;
  status: CareProcedureStatus;
  animal: CareProcedureAnimal;
  procedure_type: CareProcedureType;
  volunteer: CareProcedureVolunteer;
}

export interface CareProcedureFilters {
  status: CareProcedureStatus | "";
  animal_id: string;
  volunteer_id: string;
  procedure_type_id: string;
  date_from: string;
  date_to: string;
  offset: number;
}

export interface CareProcedureSummary {
  today_total: number;
  today_completed: number;
}

export type CareProcedureField = keyof CareProcedureCreate;
export type CareProcedureFieldErrors = Partial<Record<CareProcedureField, string>>;
