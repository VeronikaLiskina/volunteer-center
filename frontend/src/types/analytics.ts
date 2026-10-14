export interface AnimalAnalytics {
  total: number;
  in_care: number;
  archived: number;
}

export interface VolunteerAnalytics {
  total: number;
  active: number;
  inactive: number;
}

export interface ProcedureAnalytics {
  total: number;
  assigned: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

export interface MonthlyExecution { month: string; label: string; completed: number }
export interface ProcedureTypeShare { procedure_type_id: number; name: string; count: number; percentage: number }
export interface VolunteerActivityItem { volunteer_id: number; full_name: string; completed_count: number }

export interface AnalyticsData {
  animals: AnimalAnalytics;
  volunteers: VolunteerAnalytics;
  procedures: ProcedureAnalytics;
  executions_by_month: MonthlyExecution[];
  procedure_types: ProcedureTypeShare[];
  volunteer_activity: VolunteerActivityItem[];
}

export const ReportType = {
  AnimalCare: "animal_care",
  VolunteerActivity: "volunteer_activity",
  ProcedureExecution: "procedure_execution",
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export interface ReportFiltersValue { report_type: ReportType; date_from: string; date_to: string; procedure_type_id?: number | null; report_id?: string | null }
export interface ReportMetric { key: string; label: string; value: number }
export interface AnimalActivityItem { animal_id: number; name: string; total: number; completed: number }
export interface VolunteerWorkloadItem { volunteer_id: number; full_name: string; total: number; completed: number; completed_minutes: number }
export interface ReportData extends ReportFiltersValue { title: string; metrics: ReportMetric[]; procedure_type_name: string; executions_by_month: MonthlyExecution[]; procedure_types: ProcedureTypeShare[]; volunteer_activity: VolunteerActivityItem[]; animal_activity?: AnimalActivityItem[]; volunteer_workload?: VolunteerWorkloadItem[] }
