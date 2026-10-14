import { normalizePhone } from "../../utils/phone";
import type { VolunteerCreate, VolunteerFieldErrors } from "../../types/volunteer";

export interface VolunteerFormValues {
  full_name: string;
  phone: string;
  note: string;
  available_from: string;
  available_to: string;
}

export function initialVolunteerValues(volunteer: VolunteerCreate | null): VolunteerFormValues {
  return {
    full_name: volunteer?.full_name ?? "",
    phone: volunteer?.phone ?? "",
    note: volunteer?.note ?? "",
    available_from: volunteer?.available_from?.slice(0, 5) ?? "",
    available_to: volunteer?.available_to?.slice(0, 5) ?? "",
  };
}

export function validateVolunteer(values: VolunteerFormValues): VolunteerFieldErrors {
  const errors: VolunteerFieldErrors = {};
  const fullName = values.full_name.trim();
  if (!fullName) errors.full_name = "Введите ФИО";
  else if (fullName.length > 100) errors.full_name = "Не более 100 символов";

  const phone = values.phone.trim();
  const digits = phone.replace(/\D/g, "");
  if (!phone) errors.phone = "Введите телефон";
  else if (!/^[+0-9()\s-]+$/.test(phone) || digits.length !== 11 || !/^[78]/.test(digits)
    || (phone.includes("+") && (!phone.startsWith("+7") || phone.split("+").length !== 2))) {
    errors.phone = "Используйте формат +7 (999) 123-45-67";
  }
  if (values.note.trim().length > 255) errors.note = "Не более 255 символов";
  if (values.available_from && values.available_to && values.available_from >= values.available_to) errors.available_to = "Окончание должно быть позже начала";
  return errors;
}

export function toVolunteerPayload(values: VolunteerFormValues): VolunteerCreate {
  return {
    full_name: values.full_name.trim().replace(/\s+/g, " "),
    phone: normalizePhone(values.phone.trim()),
    note: values.note.trim() || null,
    available_from: values.available_from || null,
    available_to: values.available_to || null,
  };
}
