import { request, requestBlob } from "./client";
import type { AnalyticsData, ReportData, ReportFiltersValue } from "../types/analytics";

export const getAnalytics = (signal?: AbortSignal) => request<AnalyticsData>("/analytics", { signal });

export function getReport(filters: ReportFiltersValue, signal?: AbortSignal) {
  const params = new URLSearchParams({
    report_type: filters.report_type,
    date_from: filters.date_from,
    date_to: filters.date_to,
  });
  if (filters.procedure_type_id) params.set("procedure_type_id", String(filters.procedure_type_id));
  return request<ReportData>(`/reports?${params}`, { signal });
}

export function exportReport(filters: ReportFiltersValue, signal?: AbortSignal) {
  const params = new URLSearchParams({
    report_type: filters.report_type,
    date_from: filters.date_from,
    date_to: filters.date_to,
  });
  if (filters.procedure_type_id) params.set("procedure_type_id", String(filters.procedure_type_id));
  if (filters.report_id) params.set("report_id", filters.report_id);
  return requestBlob(`/reports/export.xlsx?${params}`, { signal });
}
