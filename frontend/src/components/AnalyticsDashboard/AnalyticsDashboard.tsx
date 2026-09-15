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
      <ProcedureChart rows={data.executions_by_month} byPlannedMonth />
      <ProcedureDistribution rows={data.procedure_types} />
    </div>
    <VolunteerActivity rows={data.volunteer_activity} />
  </div>;
}
