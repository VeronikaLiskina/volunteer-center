import { Link } from "react-router-dom";
import { Icon } from "../Icon/Icon";
import type { AnimalSummary } from "../../types/animal";
import type { SystemState } from "../SystemStatus/SystemStatus";
import "./DashboardPanels.scss";

export function TodayProcedures() {
  return <section className="today-procedures" aria-labelledby="today-procedures-title">
    <h2 className="today-procedures__title" id="today-procedures-title">Процедуры на сегодня</h2>
    <div className="today-procedures__scroll">
      <table className="today-procedures__table">
        <thead><tr>{["Время", "Животное", "Процедура", "Волонтёр", "Статус"].map((title) =>
          <th scope="col" key={title}>{title}</th>)}</tr></thead>
        <tbody><tr><td colSpan={5} className="today-procedures__empty">
          <span className="today-procedures__empty-icon"><Icon name="calendar" /></span>
          <p className="today-procedures__empty-title">Здесь появится план заботы на день</p>
          <p className="today-procedures__empty-description">Расписание станет доступно после подключения<br />модуля планирования процедур.</p>
        </td></tr></tbody>
      </table>
    </div>
    <span className="today-procedures__footer">Все процедуры <Icon name="arrow" /><span className="today-procedures__soon">Скоро</span></span>
  </section>;
}

export function SystemOverview({ state, summary, onRetry }: {
  state: SystemState; summary: AnimalSummary | null; onRetry: () => void;
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
        <p className="system-overview__label">Планирование процедур</p>
        <p className="system-overview__description">Модуль пока не подключён</p>
      </div></li>
      <li className="system-overview__item"><Icon name="user" /><div>
        <p className="system-overview__label">Команда волонтёров</p>
        <p className="system-overview__description">Модуль пока не подключён</p>
      </div></li>
    </ul>
  </section>;
}

export function QuickActions() {
  return <section className="quick-actions" aria-labelledby="quick-actions-title">
    <h2 className="quick-actions__title" id="quick-actions-title">Работа с животными</h2>
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
    </div>
  </section>;
}
