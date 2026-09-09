import { useEffect, useState } from "react";
import { getAnimalSummary } from "../../api/animals";
import { getCareProcedureSummary } from "../../api/careProcedures";
import { getVolunteerSummary } from "../../api/volunteers";
import { AnalyticsLinks } from "../../components/AnalyticsLinks/AnalyticsLinks";
import { HomeHero } from "../../components/HomeHero/HomeHero";
import type { SummaryResource } from "../../components/HomeStats/HomeStats";
import { QuickActions } from "../../components/QuickActions/QuickActions";
import type { AnimalSummary } from "../../types/animal";
import type { CareProcedureSummary } from "../../types/careProcedure";
import type { VolunteerSummary } from "../../types/volunteer";
import "./HomePage.scss";

const emptyResource = <T,>(): SummaryResource<T> => ({ data: null, loading: true, error: "" });

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Не удалось загрузить данные";
}

export function HomePage() {
  const [animals, setAnimals] = useState<SummaryResource<AnimalSummary>>(emptyResource);
  const [procedures, setProcedures] = useState<SummaryResource<CareProcedureSummary>>(emptyResource);
  const [volunteers, setVolunteers] = useState<SummaryResource<VolunteerSummary>>(emptyResource);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getAnimalSummary(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setAnimals({ data, loading: false, error: "" }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setAnimals({ data: null, loading: false, error: errorMessage(cause) }); });

    getCareProcedureSummary(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setProcedures({ data, loading: false, error: "" }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setProcedures({ data: null, loading: false, error: errorMessage(cause) }); });

    getVolunteerSummary(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setVolunteers({ data, loading: false, error: "" }); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setVolunteers({ data: null, loading: false, error: errorMessage(cause) }); });

    return () => controller.abort();
  }, [revision]);

  function retry() {
    setAnimals(emptyResource());
    setProcedures(emptyResource());
    setVolunteers(emptyResource());
    setRevision((value) => value + 1);
  }

  return <div className="home-page">
    <HomeHero animals={animals} procedures={procedures} volunteers={volunteers}
      onRetry={retry} />
    <QuickActions />
    <AnalyticsLinks />
  </div>;
}
