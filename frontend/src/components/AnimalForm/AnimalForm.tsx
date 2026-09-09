import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { AnimalStatus, animalStatusLabels, type Animal, type AnimalCreate, type AnimalType, type Breed,
  type AnimalField, type AnimalFieldErrors } from "../../types/animal";
import { FormField } from "../FormField/FormField";
import { initialValues, toPayload, validateAnimal } from "./validation";
import "./AnimalForm.scss";

interface AnimalFormProps {
  animal: Animal | null;
  types: AnimalType[];
  breeds: Breed[];
  onSave: (data: AnimalCreate, addAnother: boolean) => Promise<Animal>;
  onClear: () => void;
}

export function AnimalForm({ animal, types, breeds, onSave, onClear }: AnimalFormProps) {
  const [values, setValues] = useState(() => initialValues(animal));
  const [errors, setErrors] = useState<AnimalFieldErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const archived = animal?.status === AnimalStatus.Archived;
  const availableBreeds = breeds.filter((breed) => breed.animal_type_id === Number(values.animal_type_id));

  function change(name: AnimalField, value: string) {
    setValues((current) => ({ ...current, [name]: value,
      ...(name === "animal_type_id" ? { breed_id: "" } : {}) }));
    setErrors((current) => ({ ...current, [name]: undefined,
      ...(name === "animal_type_id" ? { breed_id: undefined } : {}) }));
    setError("");
  }

  function reset() {
    setValues(initialValues(null)); setErrors({}); setError(""); onClear();
  }

  function fieldProps(name: AnimalField) {
    return { id: `animal-${name}`, name, value: values[name],
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `animal-${name}-error` : undefined,
      className: `animal-form__input${errors[name] ? " animal-form__input--error" : ""}` };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || archived) return;
    const fieldErrors = validateAnimal(values);
    setErrors(fieldErrors); setError("");
    if (Object.keys(fieldErrors).length) {
      const first = Object.keys(fieldErrors)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const addAnother = submitter?.value === "add-another";
    submitting.current = true; setSaving(true);
    try {
      const saved = await onSave(toPayload(values), addAnother);
      setValues(initialValues(addAnother ? null : saved));
    } catch (cause) {
      if (cause instanceof ApiError) { setErrors(cause.fields); setError(cause.message); }
      else setError("Не удалось сохранить карточку. Повторите попытку.");
    } finally { submitting.current = false; setSaving(false); }
  }

  return <section className="animal-form" aria-labelledby="animal-form-title">
    <div className="animal-form__heading">
      <div>
        <h2 className="animal-form__title" id="animal-form-title" tabIndex={-1}>
          {archived ? "Архивная карточка" : animal ? "Редактирование карточки" : "Карточка животного"}
        </h2>
        <p className="animal-form__hint">{archived ? "Карточка доступна только для просмотра." : "* Обязательные поля"}</p>
      </div>
      <span className={`animal-form__status animal-form__status--${animal?.status ?? AnimalStatus.InCare}`}>
        {animal ? animalStatusLabels[animal.status] : "Новая карточка"}
      </span>
    </div>
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={saving}>
      {error && <p className="animal-form__error" role="alert">{error}</p>}
      <fieldset className="animal-form__fieldset" disabled={saving || archived}>
        <div className="animal-form__grid">
          <FormField name="name" label="Кличка" required error={errors.name}>
            <input {...fieldProps("name")} required maxLength={50} placeholder="Введите кличку"
              onChange={(e) => change("name", e.target.value)} />
          </FormField>
          <FormField name="animal_type_id" label="Тип животного" required error={errors.animal_type_id}>
            <select {...fieldProps("animal_type_id")} required onChange={(e) => change("animal_type_id", e.target.value)}>
              <option value="">Выберите тип</option>
              {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </FormField>
          <FormField name="breed_id" label="Порода" required error={errors.breed_id}>
            <select {...fieldProps("breed_id")} required disabled={!values.animal_type_id}
              onChange={(e) => change("breed_id", e.target.value)}>
              <option value="">{!values.animal_type_id ? "Сначала выберите тип" : availableBreeds.length ? "Выберите породу" : "Для этого типа нет пород"}</option>
              {availableBreeds.map((breed) => <option key={breed.id} value={breed.id}>{breed.name}</option>)}
            </select>
          </FormField>
          <FormField name="weight" label="Вес, кг" required error={errors.weight}>
            <input {...fieldProps("weight")} required inputMode="decimal" placeholder="Например, 4,25"
              onChange={(e) => change("weight", e.target.value)} />
          </FormField>
          <FormField name="birth_year" label="Год рождения" required error={errors.birth_year}>
            <input {...fieldProps("birth_year")} required inputMode="numeric" maxLength={4} placeholder="ГГГГ"
              onChange={(e) => change("birth_year", e.target.value)} />
          </FormField>
          <FormField name="owner_name" label="ФИО хозяина / ответственного лица" error={errors.owner_name}>
            <input {...fieldProps("owner_name")} maxLength={100} placeholder="Введите ФИО"
              onChange={(e) => change("owner_name", e.target.value)} />
          </FormField>
          <FormField name="owner_phone" label="Телефон хозяина" error={errors.owner_phone}>
            <input {...fieldProps("owner_phone")} type="tel" maxLength={32} placeholder="+7 (999) 123-45-67"
              onChange={(e) => change("owner_phone", e.target.value)} />
          </FormField>
          <FormField name="note" label="Примечание" error={errors.note}>
            <textarea {...fieldProps("note")} rows={3} maxLength={255} placeholder="Дополнительная информация"
              onChange={(e) => change("note", e.target.value)} />
          </FormField>
        </div>
      </fieldset>
      <div className="animal-form__actions">
        <button className="animal-form__button" type="button" disabled={saving} onClick={reset}>
          {animal ? "Новая карточка" : "Очистить"}
        </button>
        {!archived && <>
          <button className="animal-form__button animal-form__button--primary" type="submit" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button className="animal-form__button animal-form__button--secondary" type="submit" value="add-another" disabled={saving}>
            Сохранить и добавить ещё
          </button>
        </>}
      </div>
    </form>
  </section>;
}
