import type { MonthlyExecution } from "../../types/analytics";
import "./ProcedureChart.scss";

export function ProcedureChart({ rows }: { rows: MonthlyExecution[] }) {
  const max = Math.max(1, ...rows.map((item) => item.completed));
  return <section className="procedure-chart" aria-labelledby="procedure-chart-title">
    <div className="procedure-chart__heading">
      <div><h2 className="procedure-chart__title" id="procedure-chart-title">Выполнение процедур</h2>
        <p className="procedure-chart__subtitle">По месяцам, на основе фактов выполнения</p></div>
    </div>
    <div className="procedure-chart__plot" role="img" aria-label={`Выполнено процедур по месяцам: ${rows.map((item) => `${item.label} — ${item.completed}`).join(", ")}`}>
      {rows.map((item) => <div className="procedure-chart__column" key={item.month}>
        <span className="procedure-chart__value">{item.completed}</span>
        <span className="procedure-chart__track"><span className="procedure-chart__bar" style={{ height: `${item.completed ? Math.max(10, item.completed / max * 100) : 3}%` }} /></span>
        <span className="procedure-chart__label">{item.label}</span>
      </div>)}
    </div>
  </section>;
}
