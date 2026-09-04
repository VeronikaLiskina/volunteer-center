import "./SystemStatus.scss";

export type SystemState = "loading" | "available" | "unavailable";

interface SystemStatusProps {
  state: SystemState;
}

const statusText: Record<SystemState, string> = {
  loading: "Проверяем доступность…",
  available: "Система работает",
  unavailable: "Сервис временно недоступен",
};

export function SystemStatus({ state }: SystemStatusProps) {
  return (
    <section className="system-status" aria-live="polite">
      <div>
        <p className="system-status__label">Состояние системы</p>
        <p className="system-status__value">{statusText[state]}</p>
      </div>
      <span
        className={`system-status__indicator system-status__indicator--${state}`}
        aria-hidden="true"
      />
    </section>
  );
}

