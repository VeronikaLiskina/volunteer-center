import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCareProcedures, getCareProcedureSummary } from "../../api/careProcedures";
import { CareProceduresTable } from "../../components/CareProceduresTable/CareProceduresTable";
import { Icon } from "../../components/Icon/Icon";
import type { CareProcedure, CareProcedureFilters, CareProcedureSummary } from "../../types/careProcedure";
import "./CareProceduresPage.scss";
import { useAuth } from "../../auth/AuthContext";

const initialFilters: CareProcedureFilters = {
  status: "", animal_id: "", volunteer_id: "", procedure_type_id: "",
  date_from: "", date_to: "", offset: 0,
};

export function CareProceduresPage() {
  const isCoordinator = useAuth().user?.role === "COORDINATOR";
  const navigate = useNavigate();
  const location = useLocation();
  const [filters, setFilters] = useState(initialFilters);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<{ data: CareProcedure[]; error: string; key: string }>({ data: [], error: "", key: "" });
  const [summary, setSummary] = useState<CareProcedureSummary | null>(null);
  const [notice] = useState(() => (location.state as { notice?: string } | null)?.notice ?? "");
  const listKey = JSON.stringify([filters, revision]);
  const loading = list.key !== listKey;

  useEffect(() => {
    const controller = new AbortController();
    getCareProcedures(filters, controller.signal).then((data) => {
      if (!controller.signal.aborted) setList({ data, error: "", key: listKey });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setList({ data: [], error: cause instanceof Error ? cause.message : "Не удалось загрузить услуги", key: listKey });
    });
    return () => controller.abort();
  }, [filters, listKey]);

  useEffect(() => {
    const controller = new AbortController();
    getCareProcedureSummary(controller.signal).then((data) => {
      if (!controller.signal.aborted) setSummary(data);
    }).catch(() => { if (!controller.signal.aborted) setSummary(null); });
    return () => controller.abort();
  }, [revision]);

  return <div className="care-procedures-page">
    <header className="care-procedures-page__header">
      <div><p className="care-procedures-page__eyebrow">Забота по расписанию</p>
        <h1>{isCoordinator ? "Услуги ухода" : "Мои услуги"}</h1><p>{isCoordinator ? "Планирование задач для животных и ответственных волонтёров" : "Ваши назначения и результаты выполнения"}</p></div>
      {isCoordinator && <Link className="care-procedures-page__add" to="/procedures/new"><Icon name="calendar" />Назначить услугу</Link>}
    </header>
    <section className="care-procedures-page__summary" aria-label="Сводка на сегодня">
      <article><span>Запланировано сегодня</span><strong>{summary?.today_total ?? "—"}</strong></article>
      <article className="care-procedures-page__summary-card--completed"><span>Фактически выполнено сегодня</span><strong>{summary?.today_completed ?? "—"}</strong></article>
    </section>
    {notice && <p className="care-procedures-page__notice" role="status">{notice}</p>}
    <CareProceduresTable procedures={list.data} filters={filters} loading={loading} error={list.error}
      onFilters={setFilters} onEdit={(id) => navigate(`/procedures/${id}/edit`)}
      onExecute={(id) => navigate(`/procedures/${id}/execute`)}
      onRetry={() => setRevision((value) => value + 1)} />
  </div>;
}
