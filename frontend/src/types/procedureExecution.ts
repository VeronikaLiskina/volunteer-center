export interface ProcedureExecutionCreate {
  execution_date: string;
  execution_time: string;
  result: string;
  is_completed?: boolean;
  failure_reason?: string | null;
  comment: string | null;
}

export type ProcedureExecutionUpdate = Partial<ProcedureExecutionCreate>;

export interface ProcedureExecution extends ProcedureExecutionCreate {
  id: number;
  care_procedure_id: number;
  created_at: string;
}

export type ProcedureExecutionField = Exclude<keyof ProcedureExecutionCreate, "is_completed">;
export type ProcedureExecutionFieldErrors = Partial<
  Record<ProcedureExecutionField, string>
>;
