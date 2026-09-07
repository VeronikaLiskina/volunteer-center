export const VolunteerStatus = { Active: "active", Inactive: "inactive" } as const;
export type VolunteerStatus = (typeof VolunteerStatus)[keyof typeof VolunteerStatus];

export const volunteerStatusLabels: Record<VolunteerStatus, string> = {
  active: "Активен",
  inactive: "Неактивен",
};

export interface VolunteerCreate {
  full_name: string;
  phone: string;
  note: string | null;
}

export type VolunteerUpdate = Partial<VolunteerCreate>;

export interface Volunteer extends VolunteerCreate {
  id: number;
  status: VolunteerStatus;
}

export interface VolunteerFilters {
  search: string;
  status: VolunteerStatus | "";
  offset: number;
}

export type VolunteerField = keyof VolunteerCreate;
export type VolunteerFieldErrors = Partial<Record<VolunteerField, string>>;

export interface VolunteerSummary {
  total: number;
  active: number;
  inactive: number;
}
