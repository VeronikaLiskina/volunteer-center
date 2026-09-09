import { Icon, type IconName } from "../Icon/Icon";
import type { AnalyticsData } from "../../types/analytics";
import "./AnalyticsStatCards.scss";

export function AnalyticsStatCards({ data }: { data: AnalyticsData }) {
  const cards: { title: string; icon: IconName; tone: string; rows: [string, number][] }[] = [
    { title: "Животные", icon: "paw", tone: "blue", rows: [["Всего", data.animals.total], ["Под опекой", data.animals.in_care], ["В архиве", data.animals.archived]] },
    { title: "Волонтёры", icon: "user", tone: "green", rows: [["Всего", data.volunteers.total], ["Активные", data.volunteers.active], ["Неактивные", data.volunteers.inactive]] },
    { title: "Процедуры", icon: "calendar", tone: "violet", rows: [["Всего", data.procedures.total], ["Выполнено", data.procedures.completed], ["Просрочено", data.procedures.overdue]] },
  ];
  return <section className="analytics-stat-cards" aria-label="Общая статистика">
    {cards.map((card) => <article className="analytics-stat-card" key={card.title}>
      <div className="analytics-stat-card__header">
        <span className={`analytics-stat-card__icon analytics-stat-card__icon--${card.tone}`}><Icon name={card.icon} /></span>
        <h2 className="analytics-stat-card__title">{card.title}</h2>
      </div>
      <dl className="analytics-stat-card__values">
        {card.rows.map(([label, value]) => <div className="analytics-stat-card__row" key={label}>
          <dt>{label}</dt><dd>{value}</dd>
        </div>)}
      </dl>
    </article>)}
  </section>;
}
