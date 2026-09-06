import { request } from "./client";
import type { AnimalType, Breed } from "../types/animal";

export const getAnimalTypes = (signal?: AbortSignal) => request<AnimalType[]>("/animal-types", { signal });
export const getBreeds = (animalTypeId?: number, signal?: AbortSignal) =>
  request<Breed[]>(`/breeds${animalTypeId ? `?animal_type_id=${animalTypeId}` : ""}`, { signal });
