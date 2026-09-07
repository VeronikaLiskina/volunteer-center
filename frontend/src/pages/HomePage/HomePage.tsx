import { useEffect, useState } from "react";
import { getHealth } from "../../api/client";
import { getAnimalSummary } from "../../api/animals";
import { getVolunteerSummary } from "../../api/volunteers";
import type { AnimalSummary } from "../../types/animal";
import type { VolunteerSummary } from "../../types/volunteer";
import type { SystemState } from "../../components/SystemStatus/SystemStatus";
import { DashboardMetrics } from "../../components/DashboardMetrics/DashboardMetrics";
import { QuickActions, SystemOverview, TodayProcedures } from "../../components/DashboardPanels/DashboardPanels";
import "./HomePage.scss";

export function HomePage() {
  const [systemState, setSystemState] = useState<SystemState>("loading");
  const [summary, setSummary] = useState<AnimalSummary | null>(null);
  const [volunteerSummary, setVolunteerSummary] = useState<VolunteerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [volunteersLoading, setVolunteersLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal).then((health) => {
      if (!controller.signal.aborted) setSystemState(health.status === "ok" && health.database === "connected" ? "available" : "unavailable");
    }).catch(() => { if (!controller.signal.aborted) setSystemState("unavailable"); });
    getAnimalSummary(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setSummary(result); setLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setSummary(null); setLoading(false); } });
    getVolunteerSummary(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setVolunteerSummary(result); setVolunteersLoading(false); }
    }).catch(() => { if (!controller.signal.aborted) { setVolunteerSummary(null); setVolunteersLoading(false); } });
    return () => controller.abort();
  }, [revision]);

  function retry() { setSystemState("loading"); setLoading(true); setVolunteersLoading(true); setRevision((value) => value + 1); }

  return <div className="home-page">
    <h1 className="home-page__title">Главная панель</h1>
    <DashboardMetrics summary={summary} volunteerSummary={volunteerSummary}
      loading={loading} volunteersLoading={volunteersLoading} />
    {!loading && !summary && <p className="home-page__error" role="alert">Не удалось загрузить сведения о животных.
      <button className="home-page__retry" onClick={retry} type="button">Повторить</button></p>}
    <div className="home-page__workspace">
      <TodayProcedures />
      <div className="home-page__sidebar">
        <SystemOverview state={systemState} summary={summary} volunteerSummary={volunteerSummary} onRetry={retry} />
        <QuickActions />
      </div>
    </div>
    <footer className="home-page__footer"><span>© {new Date().getFullYear()} АСУВЦ «Лапка»</span><span>Версия 0.1.0</span></footer>
  </div>;
}
