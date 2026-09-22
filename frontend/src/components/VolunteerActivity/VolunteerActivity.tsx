import { Icon } from "../Icon/Icon";
import type { VolunteerActivityItem } from "../../types/analytics";
import "./VolunteerActivity.scss";

function procedureWord(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "услуг";
  if (last === 1) return "услуга";
  if (last >= 2 && last <= 4) return "услуги";
  return "услуг";
}

export function VolunteerActivity({ rows }: { rows: VolunteerActivityItem[] }) {
  const max = Math.max(1, ...rows.map((item) => item.completed_count));
  return <section className="volunteer-activity" aria-labelledby="volunteer-activity-title">
    <div className="volunteer-activity__heading">
      <span className="volunteer-activity__icon"><Icon name="user" /></span>
      <div><h2 className="volunteer-activity__title" id="volunteer-activity-title">Самые активные волонтёры</h2>
        <p className="volunteer-activity__subtitle">По количеству выполненных услуг</p></div>
    </div>
    {rows.length ? <ol className="volunteer-activity__list">
      {rows.map((row, index) => <li className="volunteer-activity__item" key={row.volunteer_id}>
        <span className="volunteer-activity__rank">{index + 1}</span>
        <span className="volunteer-activity__person">
          <strong>{row.full_name}</strong>
          <span className="volunteer-activity__track"><span style={{ width: `${row.completed_count / max * 100}%` }} /></span>
        </span>
        <span className="volunteer-activity__count"><strong>{row.completed_count}</strong> {procedureWord(row.completed_count)}</span>
      </li>)}
    </ol> : <p className="volunteer-activity__empty">Выполненных услуг пока нет</p>}
  </section>;
}
