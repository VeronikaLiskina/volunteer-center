import { Link } from "react-router-dom";
import { Icon } from "../Icon/Icon";
import type { AnimalSummary } from "../../types/animal";
import type { VolunteerSummary } from "../../types/volunteer";
import { careProcedureStatusLabels, type CareProcedure, type CareProcedureSummary } from "../../types/careProcedure";
import type { SystemState } from "../SystemStatus/SystemStatus";
import "./DashboardPanels.scss";

export function TodayProcedures({ procedures, loading, error, onRetry }: {
  procedures: CareProcedure[]; loading: boolean; error: string; onRetry: () => void;
}) {
  return <section className="today-procedures" aria-labelledby="today-procedures-title">
    <h2 className="today-procedures__title" id="today-procedures-title">Услуги на сегодня</h2>
    <div className="today-procedures__scroll">
      <table className="today-procedures__table">
        <thead><tr>{["Время", "Животное", "Услуга", "Волонтёр", "Статус"].map((title) =>
          <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={5} className="today-procedures__state" role="status">Загружаем расписание…</td></tr>
          : error ? <tr><td colSpan={5} className="today-procedures__state today-procedures__state--error" role="alert">{error}
            <button type="button" onClick={onRetry}>Повторить</button></td></tr>
          : procedures.length ? procedures.map((item) => <tr className="today-procedures__row" key={item.id}>
            <td>{item.planned_time.slice(0, 5)}</td><td><strong>{item.animal.name}</strong></td>
            <td>{item.procedure_type.name}</td><td>{item.volunteer.full_name}</td>
            <td><span className={`today-procedures__status today-procedures__status--${item.status}`}>{careProcedureStatusLabels[item.status]}</span></td>
          </tr>) : <tr><td colSpan={5} className="today-procedures__empty">
          <span className="today-procedures__empty-icon"><Icon name="calendar" /></span>
          <p className="today-procedures__empty-title">На сегодня услуг нет</p>
          <p className="today-procedures__empty-description">Создайте назначение, чтобы оно появилось в расписании.</p>
        </td></tr>}</tbody>
      </table>
    </div>
    <Link className="today-procedures__footer" to="/procedures">Все услуги <Icon name="arrow" /></Link>
  </section>;
}

export function SystemOverview({ state, summary, volunteerSummary, procedureSummary, onRetry }: {
  state: SystemState; summary: AnimalSummary | null; volunteerSummary: VolunteerSummary | null;
  procedureSummary: CareProcedureSummary | null; onRetry: () => void;
}) {
  const systemText = { loading: "Проверяем подключение…", available: "Система работает", unavailable: "Сервис временно недоступен" }[state];
  return <section className="system-overview" aria-labelledby="system-overview-title">
    <div className="system-overview__heading">
      <h2 className="system-overview__title" id="system-overview-title">Состояние системы</h2>
      {state === "unavailable" && <button className="system-overview__retry" onClick={onRetry} type="button">Повторить</button>}
    </div>
    <ul className="system-overview__list">
      <li className={`system-overview__item system-overview__item--${state}`}>
        <Icon name={state === "unavailable" ? "alert" : "check"} />
        <div><p className="system-overview__label" role="status">{systemText}</p>
          <p className="system-overview__description">{state === "available" ? "Соединение с базой данных установлено" : "Проверка доступности приложения"}</p></div>
      </li>
      <li className="system-overview__item"><Icon name="paw" /><div>
        <p className="system-overview__label">Учёт животных</p>
        <p className="system-overview__description">{summary ? `Под опекой: ${summary.in_care} · В архиве: ${summary.archived}` : "Сведения о животных загружаются отдельно"}</p>
      </div></li>
      <li className="system-overview__item"><Icon name="calendar" /><div>
        <p className="system-overview__label">Планирование услуг</p>
        <p className="system-overview__description">{procedureSummary
          ? `Планов сегодня: ${procedureSummary.today_total} · Фактов выполнения: ${procedureSummary.today_completed}`
          : "Сведения о расписании временно недоступны"}</p>
      </div></li>
      <li className="system-overview__item"><Icon name="user" /><div>
        <p className="system-overview__label">Команда волонтёров</p>
        <p className="system-overview__description">{volunteerSummary
          ? `Активны: ${volunteerSummary.active} · Неактивны: ${volunteerSummary.inactive}`
          : "Сведения о волонтёрах временно недоступны"}</p>
      </div></li>
    </ul>
  </section>;
}

export function QuickActions() {
  return <section className="quick-actions" aria-labelledby="quick-actions-title">
    <h2 className="quick-actions__title" id="quick-actions-title">Быстрые действия</h2>
    <div className="quick-actions__grid">
      <Link className="quick-actions__action" to="/animals/new">
        <span className="quick-actions__icon"><Icon name="paw" /></span>
        <span className="quick-actions__content">
          <strong className="quick-actions__label">Карточка животного</strong>
          <span className="quick-actions__description">Открыть форму регистрации животного</span>
        </span>
        <Icon name="arrow" />
      </Link>
      <Link className="quick-actions__action" to="/animals/dictionaries">
        <span className="quick-actions__icon"><Icon name="book" /></span>
        <span className="quick-actions__content">
          <strong className="quick-actions__label">Справочники</strong>
          <span className="quick-actions__description">Посмотреть типы животных и породы</span>
        </span>
        <Icon name="arrow" />
      </Link>
      <Link className="quick-actions__action" to="/volunteers/new">
        <span className="quick-actions__icon"><Icon name="user" /></span>
        <span className="quick-actions__content">
          <strong className="quick-actions__label">Карточка волонтёра</strong>
          <span className="quick-actions__description">Добавить участника команды</span>
        </span>
        <Icon name="arrow" />
      </Link>
      <Link className="quick-actions__action" to="/procedures/new">
        <span className="quick-actions__icon"><Icon name="calendar" /></span>
        <span className="quick-actions__content">
          <strong className="quick-actions__label">Назначить услугу</strong>
          <span className="quick-actions__description">Добавить задачу в план ухода</span>
        </span>
        <Icon name="arrow" />
      </Link>
    </div>
  </section>;
}
