import { useEffect, useState } from "react";

import { getHealth } from "../../api/client";
import { SystemStatus, type SystemState } from "../../components/SystemStatus/SystemStatus";
import "./HomePage.scss";

export function HomePage() {
  const [systemState, setSystemState] = useState<SystemState>("loading");

  useEffect(() => {
    const controller = new AbortController();

    getHealth(controller.signal)
      .then((health) => {
        setSystemState(
          health.status === "ok" && health.database === "connected"
            ? "available"
            : "unavailable",
        );
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSystemState("unavailable");
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="home-page">
      <section className="home-page__hero">
        <p className="home-page__eyebrow">Информационная система</p>
        <h1 className="home-page__title">
          Волонтёрский центр <span className="home-page__title-accent">«Лапка»</span>
        </h1>
        <p className="home-page__description">
          Единое пространство для учёта животных, организации работы
          волонтёров и планирования процедур ухода.
        </p>
        <SystemStatus state={systemState} />
      </section>
    </div>
  );
}
