import { formatDate } from "../../utils/date";
import { Icon } from "../Icon/Icon";
import type { ReportData } from "../../types/analytics";
import "./ReportResult.scss";



export function ReportResult({ result, loading, error, exporting, exportError, onExport, exportingImage, imageError, onExportImage }: {
  result: ReportData | null; loading: boolean; error: string; exporting: boolean; exportError: string;
  onExport: (result: ReportData) => Promise<void>;
  exportingImage: boolean; imageError: string; onExportImage: (result: ReportData) => Promise<void>;
}) {
  return <section className="report-result" aria-labelledby="report-result-title" aria-busy={loading}>
    {loading ? <div className="report-result__loading" role="status"><span /><span /><span /><p>Собираем данные отчёта…</p></div>
      : error ? <div className="report-result__error" role="alert"><Icon name="alert" /><p>{error}</p></div>
      : result ? <>
        <div className="report-result__header">
          <span className="report-result__icon"><Icon name="file" /></span>
          <div><p className="report-result__eyebrow">Сформированный отчёт</p>
            <h2 className="report-result__title" id="report-result-title">{result.title}</h2>
            <p className="report-result__period">{formatDate(result.date_from)} — {formatDate(result.date_to)} · {result.procedure_type_name}</p></div>
        </div>
        <dl className="report-result__metrics">
          {result.metrics.map((metric) => <div className="report-result__metric" key={metric.key}>
            <dt>{metric.label}</dt><dd>{metric.value}</dd>
          </div>)}
        </dl>
        <div className="report-result__footer">
          <p className="report-result__note">XLSX — данные отчёта. PNG — показатели, диаграммы и таблицы выбранного отчёта.</p>
          <div className="report-result__downloads">
            <button className="report-result__export" type="button" disabled={exporting} onClick={() => void onExport(result)}>
              <Icon name="file" />{exporting ? "Подготавливаем Excel…" : "Выгрузить отчёт"}
            </button>
            <button className="report-result__export report-result__export--image" type="button"
              disabled={exportingImage} onClick={() => void onExportImage(result)}>
              {exportingImage ? "Подготавливаем PNG…" : "Скачать PNG"}
            </button>
          </div>
        </div>
        {exportError && <p className="report-result__export-error" role="alert">{exportError}</p>}
        {imageError && <p className="report-result__export-error" role="alert">{imageError}</p>}
      </> : <div className="report-result__placeholder">
        <span><Icon name="file" /></span>
        <h2 className="report-result__title" id="report-result-title">Отчёт ещё не сформирован</h2>
        <p>Выберите период и услугу, затем нажмите «Сформировать отчёт».</p>
      </div>}
  </section>;
}
