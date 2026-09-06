export const AnimalStatus = { InCare: "in_care", Archived: "archived" } as const;
export type AnimalStatus = (typeof AnimalStatus)[keyof typeof AnimalStatus];

export const animalStatusLabels: Record<AnimalStatus, string> = {
  in_care: "Под опекой", archived: "В архиве",
};

export interface AnimalType { id: number; name: string }
export interface Breed {
  id: number;
  animal_type_id: number;
  name: string;
  min_weight: string | null;
  max_weight: string | null;
}

export interface AnimalCreate {
  name: string;
  animal_type_id: number;
  breed_id: number;
  weight: string;
  birth_year: number;
  owner_name: string | null;
  owner_phone: string | null;
  note: string | null;
}

export type AnimalUpdate = Partial<AnimalCreate>;

export interface Animal extends AnimalCreate {
  id: number;
  status: AnimalStatus;
  animal_type: AnimalType;
  breed: Breed;
}

export interface AnimalFilters {
  search: string;
  animal_type_id: string;
  status: AnimalStatus | "";
  offset: number;
}

export type AnimalField = keyof AnimalCreate;
export type AnimalFieldErrors = Partial<Record<AnimalField, string>>;

export interface AnimalSummary { total: number; in_care: number; archived: number }
