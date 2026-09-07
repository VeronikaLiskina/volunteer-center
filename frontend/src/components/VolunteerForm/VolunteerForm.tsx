import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import type { Volunteer, VolunteerCreate, VolunteerField, VolunteerFieldErrors } from "../../types/volunteer";
import { FormField } from "../FormField/FormField";
import { initialVolunteerValues, toVolunteerPayload, validateVolunteer } from "./validation";
import "./VolunteerForm.scss";

interface VolunteerFormProps {
  volunteer: Volunteer | null;
  onSave: (data: VolunteerCreate) => Promise<void>;
}

export function VolunteerForm({ volunteer, onSave }: VolunteerFormProps) {
  const [values, setValues] = useState(() => initialVolunteerValues(volunteer));
  const [errors, setErrors] = useState<VolunteerFieldErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  function change(name: VolunteerField, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError("");
  }

  function fieldProps(name: VolunteerField) {
    return {
      id: `volunteer-${name}`,
      name,
      value: values[name] ?? "",
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `volunteer-${name}-error` : undefined,
      className: `volunteer-form__input${errors[name] ? " volunteer-form__input--error" : ""}`,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fieldErrors = validateVolunteer(values);
    setErrors(fieldErrors);
    setError("");
    if (Object.keys(fieldErrors).length) {
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(fieldErrors)[0]}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      await onSave(toVolunteerPayload(values));
    } catch (cause) {
      if (cause instanceof ApiError) { setErrors(cause.fields); setError(cause.message); }
      else setError("Не удалось сохранить карточку. Повторите попытку.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return <section className="volunteer-form" aria-labelledby="volunteer-form-title">
    <div className="volunteer-form__heading">
      <div>
        <h2 className="volunteer-form__title" id="volunteer-form-title">
          {volunteer ? "Редактирование карточки" : "Новый волонтёр"}
        </h2>
        <p className="volunteer-form__hint">Новая карточка автоматически получает статус «Активен».</p>
      </div>
      {volunteer && <span className={`volunteer-form__status volunteer-form__status--${volunteer.status}`}>
        {volunteer.status === "active" ? "Активен" : "Неактивен"}
      </span>}
    </div>
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={saving}>
      {error && <p className="volunteer-form__error" role="alert">{error}</p>}
      <div className="volunteer-form__grid">
        <FormField name="full_name" idPrefix="volunteer" label="ФИО" required error={errors.full_name}>
          <input {...fieldProps("full_name")} required maxLength={100} autoComplete="name"
            placeholder="Например, Иванова Анна Сергеевна" onChange={(event) => change("full_name", event.target.value)} />
        </FormField>
        <FormField name="phone" idPrefix="volunteer" label="Телефон" required error={errors.phone}>
          <input {...fieldProps("phone")} required type="tel" maxLength={32} autoComplete="tel"
            placeholder="+7 (999) 123-45-67" onChange={(event) => change("phone", event.target.value)} />
        </FormField>
        <div className="volunteer-form__note">
          <FormField name="note" idPrefix="volunteer" label="Примечание" error={errors.note}>
            <textarea {...fieldProps("note")} rows={5} maxLength={255}
              placeholder="Дополнительная информация" onChange={(event) => change("note", event.target.value)} />
          </FormField>
        </div>
      </div>
      <div className="volunteer-form__actions">
        <button className="volunteer-form__button volunteer-form__button--primary" type="submit" disabled={saving}>
          {saving ? "Сохранение…" : volunteer ? "Сохранить изменения" : "Добавить волонтёра"}
        </button>
      </div>
    </form>
  </section>;
}
