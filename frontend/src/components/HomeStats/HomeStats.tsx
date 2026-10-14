import { formatDate, localDate } from "../../utils/date";
import { Icon, type IconName } from "../Icon/Icon";
import type { AnimalSummary } from "../../types/animal";
import type { CareProcedureSummary } from "../../types/careProcedure";
import type { VolunteerSummary } from "../../types/volunteer";
import "./HomeStats.scss";

export interface SummaryResource<T> {
  data: T | null;
  loading: boolean;
  error: string;
}

interface HomeStatsProps {
  animals: SummaryResource<AnimalSummary>;
  procedures: SummaryResource<CareProcedureSummary>;
  volunteers: SummaryResource<VolunteerSummary>;
  onRetry: () => void;
}

function formatToday() {
  const now = new Date();
  const date = formatDate(localDate(now));
  const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(now).replace(".", "");
  return `${date}, ${weekday}`;
}

export function HomeStats({ animals, procedures, volunteers, onRetry }: HomeStatsProps) {
  const items: { label: string; icon: IconName; tone: string; value?: number; loading: boolean; error: string }[] = [
    { label: "Животных под опекой", icon: "paw", tone: "blue", value: animals.data?.in_care, loading: animals.loading, error: animals.error },
    { label: "Услуг на сегодня", icon: "calendar", tone: "green", value: procedures.data?.today_total, loading: procedures.loading, error: procedures.error },
    { label: "Выполнено сегодня", icon: "check", tone: "violet", value: procedures.data?.today_completed, loading: procedures.loading, error: procedures.error },
    { label: "Активных волонтёров", icon: "user", tone: "neutral", value: volunteers.data?.active, loading: volunteers.loading, error: volunteers.error },
  ];
  const hasError = items.some((item) => item.error);

  return <section className="home-stats" aria-label="Основные показатели центра">
    <div className="home-stats__greeting">
      <time className="home-stats__date" dateTime={new Date().toISOString().slice(0, 10)}>{formatToday()}</time>
      <span className="home-stats__wish">Хорошего дня! <span aria-hidden="true">🌿</span></span>
    </div>
    <ul className="home-stats__list">
      {items.map((item) => <li className="home-stats__item" key={item.label}>
        <span className={`home-stats__icon home-stats__icon--${item.tone}`}><Icon name={item.icon} /></span>
        <span className="home-stats__content">
          {item.loading
            ? <span className="home-stats__skeleton" aria-label={`Загружается показатель: ${item.label}`} />
            : <strong className={`home-stats__value${item.error ? " home-stats__value--error" : ""}`}
              aria-label={item.error ? `${item.label}: данные недоступны` : undefined}>{item.error ? "—" : item.value}</strong>}
          <span className="home-stats__label">{item.label}</span>
        </span>
      </li>)}
    </ul>
    {hasError && <div className="home-stats__error" role="alert">
      <span>Часть статистики недоступна</span>
      <button type="button" onClick={onRetry}>Повторить</button>
    </div>}
  </section>;
}
