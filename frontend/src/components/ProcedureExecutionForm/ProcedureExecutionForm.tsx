import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import type {
  ProcedureExecutionCreate, ProcedureExecutionField,
  ProcedureExecutionFieldErrors,
} from "../../types/procedureExecution";
import { FormField } from "../FormField/FormField";
import "./ProcedureExecutionForm.scss";

interface Props {
  onSave: (data: ProcedureExecutionCreate) => Promise<void>;
}

type FormValues = Record<ProcedureExecutionField, string>;

function currentValues(): FormValues {
  const now = new Date();
  return {
    execution_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    execution_time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    result: "",
    comment: "",
  };
}

function validate(values: FormValues): ProcedureExecutionFieldErrors {
  const errors: ProcedureExecutionFieldErrors = {};
  if (!values.execution_date) errors.execution_date = "Укажите дату выполнения";
  if (!values.execution_time) errors.execution_time = "Укажите время выполнения";
  if (!values.result.trim()) errors.result = "Опишите результат выполнения";
  if (values.comment.length > 255) errors.comment = "Не более 255 символов";
  return errors;
}

export function ProcedureExecutionForm({ onSave }: Props) {
  const [values, setValues] = useState(currentValues);
  const [errors, setErrors] = useState<ProcedureExecutionFieldErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function change(name: ProcedureExecutionField, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError("");
  }

  function fieldProps(name: ProcedureExecutionField) {
    return {
      id: `procedure-execution-${name}`,
      name,
      value: values[name],
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `procedure-execution-${name}-error` : undefined,
      className: `procedure-execution-form__input${errors[name] ? " procedure-execution-form__input--error" : ""}`,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        execution_date: values.execution_date,
        execution_time: `${values.execution_time}:00`,
        result: values.result.trim(),
        comment: values.comment.trim() || null,
      });
    } catch (cause) {
      if (cause instanceof ApiError) {
        setErrors(cause.fields);
        setError(cause.message);
      } else setError("Не удалось сохранить выполнение. Повторите попытку.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="procedure-execution-form" aria-labelledby="procedure-execution-form-title">
    <div className="procedure-execution-form__heading">
      <h2 id="procedure-execution-form-title">Результат выполнения</h2>
      <p>Зафиксируйте фактические данные. После сохранения процедура будет закрыта.</p>
    </div>
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={saving}>
      {error && <p className="procedure-execution-form__error" role="alert">{error}</p>}
      <div className="procedure-execution-form__grid">
        <div className="procedure-execution-form__field">
          <FormField name="execution_date" idPrefix="procedure-execution" label="Дата выполнения" required error={errors.execution_date}>
            <input {...fieldProps("execution_date")} type="date" required
              onChange={(event) => change("execution_date", event.target.value)} />
          </FormField>
        </div>
        <div className="procedure-execution-form__field">
          <FormField name="execution_time" idPrefix="procedure-execution" label="Время выполнения" required error={errors.execution_time}>
            <input {...fieldProps("execution_time")} type="time" required
              onChange={(event) => change("execution_time", event.target.value)} />
          </FormField>
        </div>
        <div className="procedure-execution-form__field procedure-execution-form__field--wide">
          <FormField name="result" idPrefix="procedure-execution" label="Результат" required error={errors.result}>
            <textarea {...fieldProps("result")} className={`procedure-execution-form__textarea${errors.result ? " procedure-execution-form__textarea--error" : ""}`}
              rows={6} required placeholder="Что было сделано и как чувствует себя животное"
              onChange={(event) => change("result", event.target.value)} />
          </FormField>
        </div>
        <div className="procedure-execution-form__field procedure-execution-form__field--wide">
          <FormField name="comment" idPrefix="procedure-execution" label="Комментарий" error={errors.comment}>
            <textarea {...fieldProps("comment")} className={`procedure-execution-form__textarea${errors.comment ? " procedure-execution-form__textarea--error" : ""}`}
              rows={4} maxLength={255} placeholder="Дополнительная информация"
              onChange={(event) => change("comment", event.target.value)} />
          </FormField>
        </div>
      </div>
      <div className="procedure-execution-form__actions">
        <button type="submit" disabled={saving}>{saving ? "Сохранение…" : "Сохранить выполнение"}</button>
      </div>
    </form>
  </section>;
}
