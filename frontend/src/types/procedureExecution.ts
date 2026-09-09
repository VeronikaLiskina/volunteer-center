export interface ProcedureExecutionCreate {
  execution_date: string;
  execution_time: string;
  result: string;
  comment: string | null;
}

export type ProcedureExecutionUpdate = Partial<ProcedureExecutionCreate>;

export interface ProcedureExecution extends ProcedureExecutionCreate {
  id: number;
  care_procedure_id: number;
  created_at: string;
}

export type ProcedureExecutionField = keyof ProcedureExecutionCreate;
export type ProcedureExecutionFieldErrors = Partial<
  Record<ProcedureExecutionField, string>
>;
