import { Icon } from "../Icon/Icon";
import type { ReportData } from "../../types/analytics";
import "./ReportResult.scss";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function ReportResult({ result, loading, error, exporting, exportError, onExport }: {
  result: ReportData | null; loading: boolean; error: string; exporting: boolean; exportError: string;
  onExport: (result: ReportData) => Promise<void>;
}) {
  return <section className="report-result" aria-labelledby="report-result-title" aria-busy={loading}>
    {loading ? <div className="report-result__loading" role="status"><span /><span /><span /><p>Собираем данные отчёта…</p></div>
      : error ? <div className="report-result__error" role="alert"><Icon name="alert" /><p>{error}</p></div>
      : result ? <>
        <div className="report-result__header">
          <span className="report-result__icon"><Icon name="file" /></span>
          <div><p className="report-result__eyebrow">Сформированный отчёт</p>
            <h2 className="report-result__title" id="report-result-title">{result.title}</h2>
            <p className="report-result__period">{formatDate(result.date_from)} — {formatDate(result.date_to)}</p></div>
        </div>
        <dl className="report-result__metrics">
          {result.metrics.map((metric) => <div className="report-result__metric" key={metric.key}>
            <dt>{metric.label}</dt><dd>{metric.value}</dd>
          </div>)}
        </dl>
        <div className="report-result__footer">
          <p className="report-result__note">Файл содержит показатели текущего отчёта и выбранный период.</p>
          <button className="report-result__export" type="button" disabled={exporting} onClick={() => void onExport(result)}>
            <Icon name="file" />{exporting ? "Подготавливаем Excel…" : "Скачать Excel"}
          </button>
        </div>
        {exportError && <p className="report-result__export-error" role="alert">{exportError}</p>}
      </> : <div className="report-result__placeholder">
        <span><Icon name="file" /></span>
        <h2 className="report-result__title" id="report-result-title">Отчёт ещё не сформирован</h2>
        <p>Выберите период и тип отчёта, затем нажмите «Сформировать отчёт».</p>
      </div>}
  </section>;
}
