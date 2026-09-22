import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCareProcedure } from "../../api/careProcedures";
import { executeProcedure } from "../../api/procedureExecutions";
import { ProcedureExecutionForm } from "../../components/ProcedureExecutionForm/ProcedureExecutionForm";
import { CareProcedureStatus, careProcedureStatusLabels, type CareProcedure } from "../../types/careProcedure";
import type { ProcedureExecutionCreate } from "../../types/procedureExecution";
import "./ProcedureExecutionPage.scss";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function ProcedureExecutionPage() {
  const { procedureId } = useParams();
  const navigate = useNavigate();
  const id = Number(procedureId);
  const validId = Number.isInteger(id) && id > 0;
  const [resource, setResource] = useState<{ procedure: CareProcedure | null; error: string; loaded: boolean }>({
    procedure: null, error: "", loaded: false,
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const request = validId
      ? getCareProcedure(id, controller.signal)
      : Promise.reject(new Error("Некорректный номер услуги"));
    request.then((procedure) => {
      if (!controller.signal.aborted) setResource({ procedure, error: "", loaded: true });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setResource({ procedure: null,
        error: cause instanceof Error ? cause.message : "Не удалось открыть услугу", loaded: true });
    });
    return () => controller.abort();
  }, [id, revision, validId]);

  async function save(data: ProcedureExecutionCreate) {
    await executeProcedure(id, data);
    navigate("/procedures", { state: { notice: "Услуга выполнена" } });
  }

  const procedure = resource.procedure;
  const executable = procedure && (
    procedure.status === CareProcedureStatus.Assigned
    || procedure.status === CareProcedureStatus.Overdue
  );

  return <div className="procedure-execution-page">
    <header className="procedure-execution-page__header"><div>
      <p className="procedure-execution-page__eyebrow">Фактическое выполнение</p>
      <h1>Выполнение услуги</h1>
      <p>Заполните результат работы — после сохранения услуга получит статус «Выполнена».</p>
    </div><Link className="procedure-execution-page__close" to="/procedures" aria-label="Закрыть и вернуться к списку услуг">
      <span aria-hidden="true">×</span> Закрыть</Link></header>
    {!resource.loaded ? <p className="procedure-execution-page__state" role="status">Загружаем услугу…</p>
      : resource.error || !procedure ? <p className="procedure-execution-page__error" role="alert">{resource.error}
        <button type="button" onClick={() => { setResource({ procedure: null, error: "", loaded: false }); setRevision((value) => value + 1); }}>Повторить</button></p>
      : <>
        <section className="procedure-execution-page__procedure" aria-labelledby="execution-procedure-title">
          <div className="procedure-execution-page__procedure-heading">
            <div><p>Назначенная услуга</p><h2 id="execution-procedure-title">{procedure.procedure_type.name} для {procedure.animal.name}</h2></div>
            <span className={`procedure-execution-page__status procedure-execution-page__status--${procedure.status}`}>
              {careProcedureStatusLabels[procedure.status]}</span>
          </div>
          <dl className="procedure-execution-page__details">
            <div><dt>Животное</dt><dd>{procedure.animal.name}</dd></div>
            <div><dt>Тип услуги</dt><dd>{procedure.procedure_type.name}</dd></div>
            <div><dt>Дата планирования</dt><dd>{formatDate(procedure.planned_date)} · {procedure.planned_time.slice(0, 5)}</dd></div>
            <div><dt>Волонтёр</dt><dd>{procedure.volunteer.full_name}</dd></div>
            <div><dt>Длительность</dt><dd>{procedure.duration_minutes} мин</dd></div>
          </dl>
        </section>
        {executable ? <ProcedureExecutionForm onSave={save} />
          : <p className="procedure-execution-page__unavailable" role="alert">
            {procedure.status === CareProcedureStatus.Completed
              ? "Услуга уже выполнена"
              : "Отменённую услугу выполнить нельзя"}
          </p>}
      </>}
  </div>;
}
