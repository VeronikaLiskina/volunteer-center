import { normalizePhone } from "../../utils/phone";
import type { Animal, AnimalCreate, AnimalFieldErrors } from "../../types/animal";

export type AnimalFormValues = Record<keyof AnimalCreate, string>;

export function initialValues(animal: Animal | null): AnimalFormValues {
  return {
    name: animal?.name ?? "", animal_type_id: animal ? String(animal.animal_type_id) : "",
    breed_id: animal ? String(animal.breed_id) : "", weight: animal?.weight ?? "",
    birth_year: animal ? String(animal.birth_year) : "", owner_name: animal?.owner_name ?? "",
    owner_phone: animal?.owner_phone ?? "", note: animal?.note ?? "",
  };
}

export function validateAnimal(values: AnimalFormValues): AnimalFieldErrors {
  const errors: AnimalFieldErrors = {};
  if (!values.name.trim()) errors.name = "Введите кличку";
  else if (values.name.trim().length > 50) errors.name = "Не более 50 символов";
  if (!values.animal_type_id) errors.animal_type_id = "Выберите тип животного";
  if (!values.breed_id) errors.breed_id = "Выберите породу";
  const weight = values.weight.replace(",", ".");
  if (!weight) errors.weight = "Введите вес";
  else if (!/^\d+(\.\d{1,2})?$/.test(weight) || Number(weight) <= 0 || Number(weight) > 9999.99)
    errors.weight = "Вес должен быть больше 0, до 9999,99 кг и не более двух знаков после запятой";
  const year = Number(values.birth_year);
  if (!/^\d{4}$/.test(values.birth_year) || year < 1900 || year > new Date().getFullYear())
    errors.birth_year = `Укажите год от 1900 до ${new Date().getFullYear()}`;
  if (values.owner_name.trim().length > 100) errors.owner_name = "Не более 100 символов";
  if (values.note.trim().length > 255) errors.note = "Не более 255 символов";
  const phone = values.owner_phone.trim();
  if (phone && (!/^[+\d()\s-]+$/.test(phone) || !/^[78]\d{10}$/.test(phone.replace(/\D/g, ""))
    || (phone.includes("+") && (!phone.startsWith("+7") || phone.split("+").length !== 2))))
    errors.owner_phone = "Используйте формат +7 (999) 123-45-67";
  return errors;
}

export function toPayload(values: AnimalFormValues): AnimalCreate {
  return {
    name: values.name.trim(), animal_type_id: Number(values.animal_type_id), breed_id: Number(values.breed_id),
    weight: values.weight.replace(",", "."), birth_year: Number(values.birth_year),
    owner_name: values.owner_name.trim() || null, owner_phone: normalizePhone(values.owner_phone.trim()) || null,
    note: values.note.trim() || null,
  };
}
