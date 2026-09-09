import { Icon, type IconName } from "../Icon/Icon";
import type { AnimalSummary } from "../../types/animal";
import type { VolunteerSummary } from "../../types/volunteer";
import type { CareProcedureSummary } from "../../types/careProcedure";
import "./DashboardMetrics.scss";

export function DashboardMetrics({ summary, volunteerSummary, procedureSummary, loading, volunteersLoading, proceduresLoading }: {
  summary: AnimalSummary | null;
  volunteerSummary: VolunteerSummary | null;
  procedureSummary: CareProcedureSummary | null;
  loading: boolean;
  volunteersLoading: boolean;
  proceduresLoading: boolean;
}) {
  const cards: { title: string; value: string; hint: string; icon: IconName }[] = [
    { title: "Животных на учёте", value: loading ? "…" : summary ? String(summary.in_care) : "—",
      hint: loading ? "Загружаем данные" : summary ? "Под опекой центра" : "Данные недоступны", icon: "paw" },
    { title: "Процедур на сегодня", value: proceduresLoading ? "…" : procedureSummary ? String(procedureSummary.today_total) : "—",
      hint: proceduresLoading ? "Загружаем план" : procedureSummary ? "Назначено на текущую дату" : "Данные недоступны", icon: "clipboard" },
    { title: "Выполнено сегодня", value: proceduresLoading ? "…" : procedureSummary ? String(procedureSummary.today_completed) : "—",
      hint: proceduresLoading ? "Загружаем данные" : procedureSummary ? "Фактических выполнений за день" : "Данные недоступны", icon: "check" },
    { title: "Активных волонтёров", value: volunteersLoading ? "…" : volunteerSummary ? String(volunteerSummary.active) : "—",
      hint: volunteersLoading ? "Загружаем данные" : volunteerSummary ? "Доступны для назначения" : "Данные недоступны", icon: "user" },
  ];
  return <section className="dashboard-metrics" aria-label="Основные показатели">
    {cards.map((card) => <article className="dashboard-metrics__card" key={card.title}>
      <span className="dashboard-metrics__icon"><Icon name={card.icon} /></span>
      <div className="dashboard-metrics__body"><h2 className="dashboard-metrics__title">{card.title}</h2>
        <p className="dashboard-metrics__value" aria-live="polite">{card.value}</p>
        <p className="dashboard-metrics__hint">{card.hint}</p></div>
    </article>)}
  </section>;
}
