import type { ReportData } from "../../types/analytics";
import { ProcedureChart } from "../ProcedureChart/ProcedureChart";
import { ProcedureDistribution } from "../ProcedureDistribution/ProcedureDistribution";
import { VolunteerActivity } from "../VolunteerActivity/VolunteerActivity";
import "./AnalyticsDashboard.scss";

export function AnalyticsDashboard({ data }: { data: ReportData }) {
  return <div className="analytics-dashboard">
    <p className="analytics-dashboard__note">Отбор по плановой дате, включая начало и конец периода. Статусы — на момент формирования.
      Животные и волонтёры учитываются по назначениям. После изменения параметров сформируйте отчёт заново.</p>
    <div className="analytics-dashboard__charts">
      {data.report_type !== "animal_care" && <ProcedureChart rows={data.executions_by_month} byPlannedMonth />}
      {data.report_type !== "volunteer_activity" && <ProcedureDistribution rows={data.procedure_types} />}
    </div>
    {data.report_type === "volunteer_activity" && <>
      <VolunteerActivity rows={data.volunteer_activity} />
      <div className="analytics-dashboard__table"><table><caption>Нагрузка волонтёров</caption>
        <thead><tr><th>Волонтёр</th><th>Назначений</th><th>Выполнено</th><th>Плановых минут выполненных услуг</th></tr></thead>
        <tbody>{data.volunteer_workload?.map((item) => <tr key={item.volunteer_id}><td>{item.full_name}</td><td>{item.total}</td><td>{item.completed}</td><td>{item.completed_minutes}</td></tr>)}</tbody>
      </table></div>
    </>}
    {data.report_type === "animal_care" && <div className="analytics-dashboard__table"><table><caption>Уход по животным</caption>
      <thead><tr><th>Животное</th><th>Назначений</th><th>Выполнено</th></tr></thead>
      <tbody>{data.animal_activity?.map((item) => <tr key={item.animal_id}><td>{item.name}</td><td>{item.total}</td><td>{item.completed}</td></tr>)}</tbody>
    </table></div>}
  </div>;
}
