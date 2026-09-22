import { useEffect, useRef, useState, type FormEvent } from "react";
import { getAssignableAnimals } from "../../api/animals";
import { getCareProcedureTypes } from "../../api/careProcedureTypes";
import { ApiError } from "../../api/client";
import { getActiveVolunteers } from "../../api/volunteers";
import type { Animal } from "../../types/animal";
import {
  CareProcedureStatus, careProcedureStatusLabels, type CareProcedure,
  type CareProcedureCreate, type CareProcedureFieldErrors, type CareProcedureType,
} from "../../types/careProcedure";
import type { Volunteer } from "../../types/volunteer";
import { FormField } from "../FormField/FormField";
import "./CareProcedureForm.scss";

interface Props {
  procedure: CareProcedure | null;
  onSave: (data: CareProcedureCreate, addAnother: boolean) => Promise<void>;
}

type FormValues = Record<keyof CareProcedureCreate, string>;

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function initialValues(procedure: CareProcedure | null): FormValues {
  return {
    animal_id: procedure ? String(procedure.animal_id) : "",
    procedure_type_id: procedure ? String(procedure.procedure_type_id) : "",
    planned_date: procedure?.planned_date ?? localToday(),
    planned_time: procedure?.planned_time.slice(0, 5) ?? "",
    duration_minutes: procedure ? String(procedure.duration_minutes) : "30",
    volunteer_id: procedure ? String(procedure.volunteer_id) : "",
    comment: procedure?.comment ?? "",
  };
}

function validate(values: FormValues) {
  const errors: CareProcedureFieldErrors = {};
  for (const field of ["animal_id", "procedure_type_id", "planned_date", "planned_time", "volunteer_id"] as const) {
    if (!values[field]) errors[field] = "Обязательное поле";
  }
  if (values.planned_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.planned_time))
    errors.planned_time = "Введите время в формате ЧЧ:ММ, от 00:00 до 23:59";
  if (!values.duration_minutes) errors.duration_minutes = "Обязательное поле";
  else if (!/^\d+$/.test(values.duration_minutes) || Number(values.duration_minutes) <= 0)
    errors.duration_minutes = "Введите целое число больше нуля";
  else if (Number(values.duration_minutes) > 1440)
    errors.duration_minutes = "Продолжительность не должна превышать 1440 минут";
  if (values.comment.length > 255) errors.comment = "Не более 255 символов";
  return errors;
}

export function CareProcedureForm({ procedure, onSave }: Props) {
  const [values, setValues] = useState(() => initialValues(procedure));
  const [errors, setErrors] = useState<CareProcedureFieldErrors>({});
  const [options, setOptions] = useState<{ animals: Animal[]; volunteers: Volunteer[]; types: CareProcedureType[] } | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getAssignableAnimals(controller.signal), getActiveVolunteers(controller.signal),
      getCareProcedureTypes(controller.signal),
    ]).then(([animals, volunteers, types]) => {
      if (!controller.signal.aborted) setOptions({ animals, volunteers, types });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setOptionsError(cause instanceof Error ? cause.message : "Не удалось загрузить справочники");
    });
    return () => controller.abort();
  }, []);

  function change(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError("");
  }

  function inputProps(name: keyof FormValues) {
    return {
      id: `care-procedure-${name}`, name, value: values[name],
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `care-procedure-${name}-error` : undefined,
      className: `care-procedure-form__input${errors[name] ? " care-procedure-form__input--error" : ""}`,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const shouldAddAnother = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "another";
    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    setError("");
    if (Object.keys(fieldErrors).length) {
      formRef.current?.querySelector<HTMLElement>(`[name="${Object.keys(fieldErrors)[0]}"]`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave({
        animal_id: Number(values.animal_id), procedure_type_id: Number(values.procedure_type_id),
        planned_date: values.planned_date, planned_time: `${values.planned_time}:00`,
        duration_minutes: Number(values.duration_minutes), volunteer_id: Number(values.volunteer_id),
        comment: values.comment.trim() || null,
      }, shouldAddAnother);
      if (shouldAddAnother && !procedure) {
        setValues(initialValues(null));
        setErrors({});
        setError("");
        formRef.current?.querySelector<HTMLElement>("select")?.focus();
      }
    } catch (cause) {
      if (cause instanceof ApiError) { setErrors(cause.fields); setError(cause.message); }
      else setError("Не удалось сохранить услугу. Повторите попытку.");
    } finally {
      setSaving(false);
    }
  }

  if (!options && !optionsError) return <p className="care-procedure-form__state" role="status">Загружаем данные формы…</p>;
  if (optionsError || !options) return <p className="care-procedure-form__error" role="alert">{optionsError}</p>;

  const animals: { id: number; name: string }[] = options.animals.map(({ id, name }) => ({ id, name }));
  if (procedure && !animals.some((item) => item.id === procedure.animal_id))
    animals.push(procedure.animal);
  const volunteers: { id: number; full_name: string }[] = options.volunteers.map(
    ({ id, full_name }) => ({ id, full_name }),
  );
  if (procedure && !volunteers.some((item) => item.id === procedure.volunteer_id))
    volunteers.push(procedure.volunteer);
  const displayedStatus = procedure?.status ?? CareProcedureStatus.Assigned;

  return <section className="care-procedure-form" aria-labelledby="care-procedure-form-title">
    <div className="care-procedure-form__heading">
      <div><h2 id="care-procedure-form-title">{procedure ? "Редактирование назначения" : "Новое назначение"}</h2>
        <p>Поля со звёздочкой обязательны. Доступны только животные под опекой и активные волонтёры.</p></div>
    </div>
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={saving}>
      {error && <p className="care-procedure-form__error" role="alert">{error}</p>}
      <div className="care-procedure-form__grid">
        <FormField name="animal_id" idPrefix="care-procedure" label="Животное" required error={errors.animal_id}>
          <select {...inputProps("animal_id")} required onChange={(event) => change("animal_id", event.target.value)}>
            <option value="">Выберите животное</option>
            {animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.name}</option>)}
          </select>
        </FormField>
        <FormField name="procedure_type_id" idPrefix="care-procedure" label="Тип услуги" required error={errors.procedure_type_id}>
          <select {...inputProps("procedure_type_id")} required onChange={(event) => change("procedure_type_id", event.target.value)}>
            <option value="">Выберите тип</option>
            {options.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </FormField>
        <FormField name="planned_date" idPrefix="care-procedure" label="Плановая дата" required error={errors.planned_date}>
          <input {...inputProps("planned_date")} type="date" required onChange={(event) => change("planned_date", event.target.value)} />
        </FormField>
        <FormField name="planned_time" idPrefix="care-procedure" label="Плановое время" required error={errors.planned_time}>
          <input {...inputProps("planned_time")} type="text" placeholder="ЧЧ:ММ" maxLength={5} required
            onChange={(event) => change("planned_time", event.target.value)} />
        </FormField>
        <FormField name="duration_minutes" idPrefix="care-procedure" label="Продолжительность, мин" required error={errors.duration_minutes}>
          <input {...inputProps("duration_minutes")} type="number" min="1" max="1440" step="1" required
            onChange={(event) => change("duration_minutes", event.target.value)} />
        </FormField>
        <FormField name="volunteer_id" idPrefix="care-procedure" label="Волонтёр" required error={errors.volunteer_id}>
          <select {...inputProps("volunteer_id")} required onChange={(event) => change("volunteer_id", event.target.value)}>
            <option value="">Выберите волонтёра</option>
            {volunteers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
          </select>
        </FormField>
        <div className="care-procedure-form__status-field">
          <span>Статус:</span> <strong>{careProcedureStatusLabels[displayedStatus]}</strong>
        </div>
        <div className="care-procedure-form__comment">
          <FormField name="comment" idPrefix="care-procedure" label="Комментарий" error={errors.comment}>
            <textarea {...inputProps("comment")} rows={4} maxLength={255} placeholder="Дополнительные указания"
              onChange={(event) => change("comment", event.target.value)} />
          </FormField>
        </div>
      </div>
      <div className="care-procedure-form__actions">
        {!procedure && <button className="care-procedure-form__button care-procedure-form__button--secondary"
          type="submit" name="save_mode" value="another" disabled={saving}>Сохранить и добавить ещё</button>}
        <button className="care-procedure-form__button care-procedure-form__button--primary" type="submit"
          name="save_mode" value="close" disabled={saving}>
          {saving ? "Сохранение…" : procedure ? "Сохранить изменения" : "Назначить услугу"}
        </button>
      </div>
    </form>
  </section>;
}
