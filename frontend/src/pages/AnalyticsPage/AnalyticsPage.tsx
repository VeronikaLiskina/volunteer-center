import { useEffect, useState } from "react";
import { getAnalytics } from "../../api/analytics";
import { AnalyticsDashboard } from "../../components/AnalyticsDashboard/AnalyticsDashboard";
import type { AnalyticsData } from "../../types/analytics";
import "./AnalyticsPage.scss";

export function AnalyticsPage() {
  const [resource, setResource] = useState<{ data: AnalyticsData | null; error: string; key: number }>({ data: null, error: "", key: -1 });
  const [revision, setRevision] = useState(0);
  const loading = resource.key !== revision;

  useEffect(() => {
    const controller = new AbortController();
    getAnalytics(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResource({ data, error: "", key: revision }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setResource({
        data: null, error: cause instanceof Error ? cause.message : "Не удалось загрузить аналитику", key: revision,
      }); });
    return () => controller.abort();
  }, [revision]);

  return <div className="analytics-page">
    <header className="analytics-page__header">
      <p className="analytics-page__eyebrow">Данные центра</p>
      <h1 className="analytics-page__title">Аналитика центра</h1>
      <p className="analytics-page__description">Сводная информация о работе АСУВЦ</p>
    </header>
    {loading ? <div className="analytics-page__loading" role="status" aria-label="Загрузка аналитики">
      <span /><span /><span />
    </div> : resource.error ? <div className="analytics-page__error" role="alert">
      <p>{resource.error}</p><button type="button" onClick={() => setRevision((value) => value + 1)}>Повторить</button>
    </div> : resource.data && <AnalyticsDashboard data={resource.data} />}
  </div>;
}
