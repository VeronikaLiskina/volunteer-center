import { request } from "./client";
import type { Volunteer, VolunteerCreate, VolunteerFilters, VolunteerSummary, VolunteerUpdate } from "../types/volunteer";

export const VOLUNTEERS_PAGE_SIZE = 20;

export const getVolunteerSummary = (signal?: AbortSignal) =>
  request<VolunteerSummary>("/volunteers/summary", { signal });

export const getActiveVolunteers = (signal?: AbortSignal) =>
  request<Volunteer[]>("/volunteers/active", { signal });

export function getVolunteers(filters: VolunteerFilters, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: String(VOLUNTEERS_PAGE_SIZE + 1), offset: String(filters.offset) });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  return request<Volunteer[]>(`/volunteers?${params}`, { signal });
}

export const getVolunteer = (id: number) => request<Volunteer>(`/volunteers/${id}`);
export const createVolunteer = (data: VolunteerCreate) =>
  request<Volunteer>("/volunteers", { method: "POST", body: JSON.stringify(data) });
export const updateVolunteer = (id: number, data: VolunteerUpdate) =>
  request<Volunteer>(`/volunteers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deactivateVolunteer = (id: number) =>
  request<Volunteer>(`/volunteers/${id}/deactivate`, { method: "POST" });
export const activateVolunteer = (id: number) =>
  request<Volunteer>(`/volunteers/${id}/activate`, { method: "POST" });
