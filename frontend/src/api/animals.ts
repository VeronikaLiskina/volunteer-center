import { request } from "./client";
import type { Animal, AnimalCreate, AnimalFilters, AnimalSummary, AnimalUpdate } from "../types/animal";

export const PAGE_SIZE = 20;

export const getAnimalSummary = (signal?: AbortSignal) => request<AnimalSummary>("/animals/summary", { signal });

export function getAnimals(filters: AnimalFilters, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE + 1), offset: String(filters.offset) });
  if (filters.search) params.set("search", filters.search);
  if (filters.animal_type_id) params.set("animal_type_id", filters.animal_type_id);
  if (filters.status) params.set("status", filters.status);
  return request<Animal[]>(`/animals?${params}`, { signal });
}

export const getAssignableAnimals = (signal?: AbortSignal) =>
  request<Animal[]>("/animals?status=in_care&limit=100&offset=0", { signal });

export const getAnimalOptions = (signal?: AbortSignal) =>
  request<Animal[]>("/animals?limit=100&offset=0", { signal });

export const getAnimal = (id: number) => request<Animal>(`/animals/${id}`);
export const createAnimal = (data: AnimalCreate) =>
  request<Animal>("/animals", { method: "POST", body: JSON.stringify(data) });
export const updateAnimal = (id: number, data: AnimalUpdate) =>
  request<Animal>(`/animals/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const archiveAnimal = (id: number) =>
  request<Animal>(`/animals/${id}/archive`, { method: "POST" });
