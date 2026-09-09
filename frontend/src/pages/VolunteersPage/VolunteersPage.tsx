import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { activateVolunteer, deactivateVolunteer, getVolunteers, getVolunteerSummary } from "../../api/volunteers";
import { Icon } from "../../components/Icon/Icon";
import { VolunteersTable } from "../../components/VolunteersTable/VolunteersTable";
import { VolunteerStatus, type Volunteer, type VolunteerFilters, type VolunteerSummary } from "../../types/volunteer";
import "./VolunteersPage.scss";

const initialFilters: VolunteerFilters = { search: "", status: "", offset: 0 };

export function VolunteersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filters, setFilters] = useState(initialFilters);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<{ data: Volunteer[]; error: string; key: string }>({ data: [], error: "", key: "" });
  const [summary, setSummary] = useState<VolunteerSummary | null>(null);
  const [notice, setNotice] = useState(() => {
    const state = location.state as { notice?: string } | null;
    return state?.notice ?? "";
  });
  const listKey = JSON.stringify([filters, revision]);
  const loading = list.key !== listKey;

  useEffect(() => {
    const controller = new AbortController();
    getVolunteers(filters, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setList({ data, error: "", key: listKey }); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setList({ data: [],
          error: cause instanceof Error ? cause.message : "Не удалось загрузить волонтёров", key: listKey });
      });
    return () => controller.abort();
  }, [filters, listKey]);

  useEffect(() => {
    const controller = new AbortController();
    getVolunteerSummary(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSummary(data); })
      .catch(() => { if (!controller.signal.aborted) setSummary(null); });
    return () => controller.abort();
  }, [revision]);

  async function changeStatus(volunteer: Volunteer, status: VolunteerStatus) {
    const saved = status === VolunteerStatus.Active
      ? await activateVolunteer(volunteer.id)
      : await deactivateVolunteer(volunteer.id);
    setNotice(status === VolunteerStatus.Active
      ? `${saved.full_name} снова активен`
      : `${saved.full_name} деактивирован`);
    setRevision((value) => value + 1);
  }

  return <div className="volunteers-page">
    <div className="volunteers-page__header">
      <div>
        <p className="volunteers-page__eyebrow">Команда центра</p>
        <h1 className="volunteers-page__title">Учёт волонтёров</h1>
        <p className="volunteers-page__description">Контакты и управление активностью волонтёров</p>
      </div>
      <Link className="volunteers-page__add" to="/volunteers/new"><Icon name="user" />Добавить волонтёра</Link>
    </div>
    <section className="volunteers-page__summary" aria-label="Сводка по волонтёрам">
      <article className="volunteers-page__summary-card"><span>Всего в базе</span><strong>{summary?.total ?? "—"}</strong></article>
      <article className="volunteers-page__summary-card volunteers-page__summary-card--active"><span>Активных</span><strong>{summary?.active ?? "—"}</strong></article>
      <article className="volunteers-page__summary-card"><span>Неактивных</span><strong>{summary?.inactive ?? "—"}</strong></article>
    </section>
    {notice && <p className="volunteers-page__notice" role="status">{notice}</p>}
    <VolunteersTable volunteers={list.data} filters={filters} loading={loading} error={list.error}
      onFilters={setFilters} onEdit={(id) => navigate(`/volunteers/${id}/edit`)}
      onStatus={changeStatus} onRetry={() => setRevision((value) => value + 1)} />
  </div>;
}
