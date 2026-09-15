import { useEffect, useState, type FormEvent } from "react";
import { getCareProcedureTypes } from "../../api/careProcedureTypes";
import type { CareProcedureType } from "../../types/careProcedure";
import { ReportType, type ReportFiltersValue } from "../../types/analytics";
import "./ReportFilters.scss";

const options = [
  { value: ReportType.AnimalCare, title: "Уход за животными", description: "Животные и назначенный уход" },
  { value: ReportType.VolunteerActivity, title: "Работа волонтёров", description: "Участие команды в процедурах" },
  { value: ReportType.ProcedureExecution, title: "Выполнение процедур", description: "Статусы назначений за период" },
];

export function ReportFilters({ initialValue, loading, onSubmit }: {
  initialValue: ReportFiltersValue; loading: boolean; onSubmit: (filters: ReportFiltersValue) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [types, setTypes] = useState<CareProcedureType[]>([]);
  const [typesError, setTypesError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    getCareProcedureTypes(controller.signal).then((items) => {
      if (!controller.signal.aborted) { setTypes(items); setTypesError(""); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setTypesError(cause instanceof Error ? cause.message : "Не удалось загрузить услуги");
    });
    return () => controller.abort();
  }, [revision]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.date_from || !value.date_to) { setError("Укажите начало и конец периода"); return; }
    if (value.date_from > value.date_to) { setError("Дата начала не может быть позже даты окончания"); return; }
    setError(""); void onSubmit(value);
  }

  return <form className="report-filters" onSubmit={submit} aria-labelledby="report-filters-title">
    <h2 className="report-filters__title" id="report-filters-title">Параметры отчёта</h2>
    <fieldset className="report-filters__fieldset" disabled={loading}>
      <legend>Выберите период</legend>
      <div className="report-filters__dates">
        <label>Дата начала<input type="date" value={value.date_from} onChange={(event) => setValue({ ...value, date_from: event.target.value })} /></label>
        <span aria-hidden="true">—</span>
        <label>Дата окончания<input type="date" value={value.date_to} onChange={(event) => setValue({ ...value, date_to: event.target.value })} /></label>
      </div>
    </fieldset>
    <fieldset className="report-filters__fieldset" disabled={loading}>
      <legend>Тип услуги</legend>
      <label className="report-filters__service">Услуга<select value={value.procedure_type_id ?? ""}
        onChange={(event) => setValue({ ...value, procedure_type_id: event.target.value ? Number(event.target.value) : null })}>
        <option value="">Все услуги</option>
        {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select></label>
      {typesError && <p role="alert">{typesError} <button type="button" onClick={() => setRevision((n) => n + 1)}>Повторить</button></p>}
    </fieldset>
    <fieldset className="report-filters__fieldset" disabled={loading}>
      <legend>Тип отчёта</legend>
      <div className="report-filters__types">
        {options.map((option) => <label className="report-filters__type" key={option.value}>
          <input type="radio" name="report-type" value={option.value} checked={value.report_type === option.value}
            onChange={() => setValue({ ...value, report_type: option.value })} />
          <span><strong>{option.title}</strong><small>{option.description}</small></span>
        </label>)}
      </div>
    </fieldset>
    {error && <p className="report-filters__error" role="alert">{error}</p>}
    <button className="report-filters__submit" type="submit" disabled={loading}>{loading ? "Формируем…" : "Сформировать отчёт"}</button>
  </form>;
}
