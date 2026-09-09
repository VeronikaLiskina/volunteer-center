import { request, requestBlob } from "./client";
import type { AnalyticsData, ReportData, ReportFiltersValue } from "../types/analytics";

export const getAnalytics = (signal?: AbortSignal) => request<AnalyticsData>("/analytics", { signal });

export function getReport(filters: ReportFiltersValue, signal?: AbortSignal) {
  const params = new URLSearchParams({
    report_type: filters.report_type,
    date_from: filters.date_from,
    date_to: filters.date_to,
  });
  return request<ReportData>(`/reports?${params}`, { signal });
}

export function exportReport(filters: ReportFiltersValue, signal?: AbortSignal) {
  const params = new URLSearchParams({
    report_type: filters.report_type,
    date_from: filters.date_from,
    date_to: filters.date_to,
  });
  return requestBlob(`/reports/export.xlsx?${params}`, { signal });
}
