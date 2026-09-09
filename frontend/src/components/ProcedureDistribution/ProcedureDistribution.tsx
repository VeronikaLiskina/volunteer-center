import type { CSSProperties } from "react";
import type { ProcedureTypeShare } from "../../types/analytics";
import "./ProcedureDistribution.scss";

const colors = ["#518cf1", "#54b98c", "#9875df", "#91a6c5", "#e6ad62"];

function chartBackground(rows: ProcedureTypeShare[]) {
  if (!rows.length) return "#edf2f7";
  let position = 0;
  const stops = rows.map((row, index) => {
    const start = position;
    position += row.percentage;
    return `${colors[index % colors.length]} ${start}% ${position}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function ProcedureDistribution({ rows }: { rows: ProcedureTypeShare[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <section className="procedure-distribution" aria-labelledby="procedure-distribution-title">
    <h2 className="procedure-distribution__title" id="procedure-distribution-title">Типы процедур</h2>
    <p className="procedure-distribution__subtitle">Распределение всех назначений</p>
    {rows.length ? <div className="procedure-distribution__content">
      <div className="procedure-distribution__chart" style={{ background: chartBackground(rows) } as CSSProperties}
        role="img" aria-label={rows.map((row) => `${row.name}: ${row.percentage}%`).join(", ")}>
        <span><strong>{total}</strong>всего</span>
      </div>
      <ul className="procedure-distribution__legend">
        {rows.map((row, index) => <li key={row.procedure_type_id}>
          <span className="procedure-distribution__dot" style={{ backgroundColor: colors[index % colors.length] }} />
          <span>{row.name}</span><strong>{row.percentage}%</strong>
        </li>)}
      </ul>
    </div> : <p className="procedure-distribution__empty">Назначений пока нет</p>}
  </section>;
}
