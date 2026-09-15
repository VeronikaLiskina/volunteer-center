import { Link } from "react-router-dom";
import { Icon, type IconName } from "../Icon/Icon";
import "./AnalyticsLinks.scss";

const links: { title: string; description: string; to: string; icon: IconName }[] = [
  { title: "Аналитика и отчёты", description: "Сводка за период, диаграммы и выгрузка XLSX", to: "/analytics", icon: "chart" },
];

export function AnalyticsLinks() {
  return <section className="analytics-links" aria-labelledby="analytics-links-title">
    <div className="analytics-links__heading">
      <h2 className="analytics-links__title" id="analytics-links-title">Аналитика и отчётность</h2>
      <p className="analytics-links__subtitle">Дополнительные возможности</p>
    </div>
    <div className="analytics-links__grid">
      {links.map((item) => <Link className="analytics-link" to={item.to} key={item.to}>
        <span className="analytics-link__icon"><Icon name={item.icon} /></span>
        <span className="analytics-link__body">
          <strong className="analytics-link__title">{item.title}</strong>
          <span className="analytics-link__description">{item.description}</span>
        </span>
        <span className="analytics-link__arrow" aria-hidden="true"><Icon name="arrow" /></span>
      </Link>)}
    </div>
  </section>;
}
