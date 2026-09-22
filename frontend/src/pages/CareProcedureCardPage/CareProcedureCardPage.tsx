import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createCareProcedure, getCareProcedure, updateCareProcedure } from "../../api/careProcedures";
import { ApiError } from "../../api/client";
import { getProcedureExecution } from "../../api/procedureExecutions";
import { CareProcedureForm } from "../../components/CareProcedureForm/CareProcedureForm";
import { ProcedureExecutionResult } from "../../components/ProcedureExecutionResult/ProcedureExecutionResult";
import type { CareProcedure, CareProcedureCreate } from "../../types/careProcedure";
import type { ProcedureExecution } from "../../types/procedureExecution";
import "./CareProcedureCardPage.scss";

export function CareProcedureCardPage() {
  const { procedureId } = useParams();
  const navigate = useNavigate();
  const isEditRoute = procedureId !== undefined;
  const editId = isEditRoute ? Number(procedureId) : null;
  const validId = editId !== null && Number.isInteger(editId) && editId > 0;
  const requestKey = isEditRoute ? `edit-${procedureId}` : "new";
  const [resource, setResource] = useState<{
    procedure: CareProcedure | null;
    execution: ProcedureExecution | null;
    error: string;
    key: string;
  }>({ procedure: null, execution: null, error: "", key: "" });
  const [revision, setRevision] = useState(0);
  const loading = resource.key !== `${requestKey}-${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    const request = !isEditRoute ? Promise.resolve({ procedure: null, execution: null })
      : validId ? Promise.all([
        getCareProcedure(editId, controller.signal),
        getProcedureExecution(editId, controller.signal).catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.status === 404) return null;
          throw cause;
        }),
      ]).then(([procedure, execution]) => ({ procedure, execution }))
        : Promise.reject(new Error("Некорректный номер услуги"));
    request.then(({ procedure, execution }) => {
      if (!controller.signal.aborted) setResource({ procedure, execution, error: "", key: `${requestKey}-${revision}` });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setResource({ procedure: null, execution: null,
        error: cause instanceof Error ? cause.message : "Не удалось открыть услугу", key: `${requestKey}-${revision}` });
    });
    return () => controller.abort();
  }, [editId, isEditRoute, requestKey, revision, validId]);

  async function save(data: CareProcedureCreate, addAnother: boolean) {
    const saved = resource.procedure
      ? await updateCareProcedure(resource.procedure.id, data)
      : await createCareProcedure(data);
    if (addAnother && !resource.procedure) return;
    navigate("/procedures", { state: { notice: resource.procedure
      ? `Услуга для «${saved.animal.name}» обновлена`
      : `Услуга для «${saved.animal.name}» назначена` } });
  }

  return <div className="care-procedure-card-page">
    <header className="care-procedure-card-page__header"><div>
      <p className="care-procedure-card-page__eyebrow">Планирование ухода</p>
      <h1>{isEditRoute ? "Карточка услуги" : "Назначение услуги"}</h1>
      <p>Плановые сведения и зафиксированный результат выполнения</p>
    </div><Link className="care-procedure-card-page__close" to="/procedures" aria-label="Закрыть и вернуться к списку услуг">
      <span aria-hidden="true">×</span> Закрыть</Link></header>
    {loading ? <p className="care-procedure-card-page__state" role="status">Загружаем карточку…</p>
      : resource.error ? <p className="care-procedure-card-page__error" role="alert">{resource.error}
        <button type="button" onClick={() => setRevision((value) => value + 1)}>Повторить</button></p>
      : <><CareProcedureForm key={requestKey} procedure={resource.procedure} onSave={save} />
        {isEditRoute && <ProcedureExecutionResult execution={resource.execution} />}</>}
  </div>;
}
