import type { AnalyticsData } from "../../types/analytics";
import { AnalyticsStatCards } from "../AnalyticsStatCards/AnalyticsStatCards";
import { ProcedureChart } from "../ProcedureChart/ProcedureChart";
import { ProcedureDistribution } from "../ProcedureDistribution/ProcedureDistribution";
import { VolunteerActivity } from "../VolunteerActivity/VolunteerActivity";
import "./AnalyticsDashboard.scss";

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  return <div className="analytics-dashboard">
    <AnalyticsStatCards data={data} />
    <div className="analytics-dashboard__charts">
      <ProcedureChart rows={data.executions_by_month} />
      <ProcedureDistribution rows={data.procedure_types} />
    </div>
    <VolunteerActivity rows={data.volunteer_activity} />
  </div>;
}
