import { request } from "./client";
import type { CareProcedureType } from "../types/careProcedure";

export const getCareProcedureTypes = (signal?: AbortSignal) =>
  request<CareProcedureType[]>("/care-procedure-types", { signal });
