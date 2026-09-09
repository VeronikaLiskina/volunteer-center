import { request } from "./client";
import type {
  CareProcedure, CareProcedureCreate, CareProcedureFilters,
  CareProcedureSummary, CareProcedureUpdate,
} from "../types/careProcedure";

export const CARE_PROCEDURES_PAGE_SIZE = 20;

export function getCareProcedures(filters: CareProcedureFilters, signal?: AbortSignal) {
  const params = new URLSearchParams({
    limit: String(CARE_PROCEDURES_PAGE_SIZE + 1), offset: String(filters.offset),
  });
  for (const key of ["status", "animal_id", "volunteer_id", "procedure_type_id", "date_from", "date_to"] as const) {
    if (filters[key]) params.set(key, String(filters[key]));
  }
  return request<CareProcedure[]>(`/care-procedures?${params}`, { signal });
}

export function getTodayCareProcedures(today: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ date_from: today, date_to: today, limit: "100", offset: "0" });
  return request<CareProcedure[]>(`/care-procedures?${params}`, { signal });
}

export const getCareProcedureSummary = (signal?: AbortSignal) =>
  request<CareProcedureSummary>("/care-procedures/summary", { signal });
export const getCareProcedure = (id: number, signal?: AbortSignal) =>
  request<CareProcedure>(`/care-procedures/${id}`, { signal });
export const createCareProcedure = (data: CareProcedureCreate) =>
  request<CareProcedure>("/care-procedures", { method: "POST", body: JSON.stringify(data) });
export const updateCareProcedure = (id: number, data: CareProcedureUpdate) =>
  request<CareProcedure>(`/care-procedures/${id}`, { method: "PATCH", body: JSON.stringify(data) });
