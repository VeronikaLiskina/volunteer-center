import { useEffect, useRef, useState } from "react";
import { exportReport, getReport } from "../../api/analytics";
import { ReportFilters } from "../../components/ReportFilters/ReportFilters";
import { ReportResult } from "../../components/ReportResult/ReportResult";
import { ReportType, type ReportData, type ReportFiltersValue } from "../../types/analytics";
import "../ReportsPage/ReportsPage.scss";
import { AnalyticsDashboard } from "../../components/AnalyticsDashboard/AnalyticsDashboard";
import { downloadDashboardImage } from "../../utils/downloadDashboardImage";

function inputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function initialFilters(): ReportFiltersValue {
  const today = new Date();
  return { report_type: ReportType.ProcedureExecution, date_from: inputDate(new Date(today.getFullYear(), today.getMonth(), 1)), date_to: inputDate(today) };
}

export function AnalyticsPage() {
  const [result, setResult] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportingImage, setExportingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const reportElement = useRef<HTMLDivElement>(null);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => () => requestController.current?.abort(), []);

  async function generate(filters: ReportFiltersValue) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true); setError(""); setResult(null); setExportError(""); setImageError("");
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
        procedure_type_id: current.procedure_type_id,
        report_id: current.report_id,
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

  async function downloadImage(current: ReportData) {
    if (!reportElement.current || exportingImage) return;
    setExportingImage(true); setImageError("");
    try { await downloadDashboardImage(reportElement.current, current); }
    catch { setImageError("Не удалось сохранить картинку. Попробуйте скачать PNG ещё раз."); }
    finally { setExportingImage(false); }
  }

  return <div className="reports-page" ref={reportElement}>
    <header className="reports-page__header">
      <p className="reports-page__eyebrow">Отчётность</p>
      <h1 className="reports-page__title">Аналитика и отчёты</h1>
      <p className="reports-page__description">Выберите период и услугу, сформируйте сводку и выгрузите отчёт</p>
    </header>
    <div className="reports-page__workspace">
      <ReportFilters initialValue={initialFilters()} loading={loading} onSubmit={generate} />
      <ReportResult result={result} loading={loading} error={error} exporting={exporting}
        exportError={exportError} onExport={download} exportingImage={exportingImage}
        imageError={imageError} onExportImage={downloadImage} />
    </div>
    {result && !loading && !error && <AnalyticsDashboard data={result} />}
  </div>;
}
