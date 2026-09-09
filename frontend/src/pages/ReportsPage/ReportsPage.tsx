import { useRef, useState } from "react";
import { exportReport, getReport } from "../../api/analytics";
import { ReportFilters } from "../../components/ReportFilters/ReportFilters";
import { ReportResult } from "../../components/ReportResult/ReportResult";
import { ReportType, type ReportData, type ReportFiltersValue } from "../../types/analytics";
import "./ReportsPage.scss";

function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function initialFilters(): ReportFiltersValue {
  const today = new Date();
  return { report_type: ReportType.ProcedureExecution, date_from: inputDate(new Date(today.getFullYear(), today.getMonth(), 1)), date_to: inputDate(today) };
}

export function ReportsPage() {
  const [result, setResult] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const requestController = useRef<AbortController | null>(null);

  async function generate(filters: ReportFiltersValue) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true); setError("");
    try { setResult(await getReport(filters, controller.signal)); }
    catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось сформировать отчёт");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  async function download(current: ReportData) {
    setExporting(true); setExportError("");
    try {
      const blob = await exportReport({
        report_type: current.report_type,
        date_from: current.date_from,
        date_to: current.date_to,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lapka-report-${current.date_from}-${current.date_to}.xlsx`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Не удалось скачать Excel-файл");
    } finally { setExporting(false); }
  }

  return <div className="reports-page">
    <header className="reports-page__header">
      <p className="reports-page__eyebrow">Отчётность</p>
      <h1 className="reports-page__title">Отчёты</h1>
      <p className="reports-page__description">Сформируйте краткую сводку за выбранный период</p>
    </header>
    <div className="reports-page__workspace">
      <ReportFilters initialValue={initialFilters()} loading={loading} onSubmit={generate} />
      <ReportResult result={result} loading={loading} error={error} exporting={exporting}
        exportError={exportError} onExport={download} />
    </div>
  </div>;
}
