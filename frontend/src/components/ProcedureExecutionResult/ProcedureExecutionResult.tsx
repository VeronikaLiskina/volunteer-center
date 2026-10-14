import { formatDate } from "../../utils/date";
import type { ProcedureExecution } from "../../types/procedureExecution";
import "./ProcedureExecutionResult.scss";



export function ProcedureExecutionResult({ execution }: { execution: ProcedureExecution | null }) {
  return <section className="procedure-execution-result" aria-labelledby="procedure-execution-result-title">
    <div className="procedure-execution-result__heading">
      <div><p>Фактические данные</p><h2 id="procedure-execution-result-title">Результат выполнения</h2></div>
      {execution && <span>{execution.is_completed === false ? "Не выполнено" : "Выполнено"}</span>}
    </div>
    {!execution ? <p className="procedure-execution-result__empty">Услуга ещё не выполнена</p>
      : <dl className="procedure-execution-result__grid">
        {execution.is_completed === false && <div className="procedure-execution-result__item procedure-execution-result__item--wide"><dt>Причина невыполнения</dt><dd>{execution.failure_reason}</dd></div>}
        <div className="procedure-execution-result__item"><dt>Дата выполнения</dt><dd>{formatDate(execution.execution_date)}</dd></div>
        <div className="procedure-execution-result__item"><dt>Время</dt><dd>{execution.execution_time.slice(0, 5)}</dd></div>
        <div className="procedure-execution-result__item procedure-execution-result__item--wide"><dt>Результат</dt><dd>{execution.result}</dd></div>
        <div className="procedure-execution-result__item procedure-execution-result__item--wide"><dt>Комментарий</dt><dd>{execution.comment || "—"}</dd></div>
      </dl>}
  </section>;
}
