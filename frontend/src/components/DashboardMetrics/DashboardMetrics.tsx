import { Icon, type IconName } from "../Icon/Icon";
import type { AnimalSummary } from "../../types/animal";
import type { VolunteerSummary } from "../../types/volunteer";
import "./DashboardMetrics.scss";

export function DashboardMetrics({ summary, volunteerSummary, loading, volunteersLoading }: {
  summary: AnimalSummary | null;
  volunteerSummary: VolunteerSummary | null;
  loading: boolean;
  volunteersLoading: boolean;
}) {
  const cards: { title: string; value: string; hint: string; icon: IconName }[] = [
    { title: "Животных на учёте", value: loading ? "…" : summary ? String(summary.in_care) : "—",
      hint: loading ? "Загружаем данные" : summary ? "Под опекой центра" : "Данные недоступны", icon: "paw" },
    { title: "Процедур на сегодня", value: "—", hint: "Планирование ещё не подключено", icon: "clipboard" },
    { title: "Выполнено сегодня", value: "—", hint: "Учёт процедур ещё не подключён", icon: "check" },
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
