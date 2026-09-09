import { request } from "./client";
import type {
  ProcedureExecution, ProcedureExecutionCreate, ProcedureExecutionUpdate,
} from "../types/procedureExecution";

export const getProcedureExecution = (procedureId: number, signal?: AbortSignal) =>
  request<ProcedureExecution>(`/care-procedures/${procedureId}/execution`, { signal });

export const executeProcedure = (procedureId: number, data: ProcedureExecutionCreate) =>
  request<ProcedureExecution>(`/care-procedures/${procedureId}/execute`, {
    method: "POST", body: JSON.stringify(data),
  });

export const updateProcedureExecution = (
  procedureId: number, data: ProcedureExecutionUpdate,
) => request<ProcedureExecution>(`/care-procedures/${procedureId}/execution`, {
  method: "PATCH", body: JSON.stringify(data),
});
