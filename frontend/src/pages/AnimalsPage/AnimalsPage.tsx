import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { archiveAnimal, getAnimals, getAnimalSummary } from "../../api/animals";
import { getAnimalTypes } from "../../api/dictionaries";
import { AnimalsTable } from "../../components/AnimalsTable/AnimalsTable";
import { Icon } from "../../components/Icon/Icon";
import type { Animal, AnimalFilters, AnimalSummary, AnimalType } from "../../types/animal";
import "./AnimalsPage.scss";

const initialFilters: AnimalFilters = { search: "", animal_type_id: "", status: "", offset: 0 };

export function AnimalsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [types, setTypes] = useState<AnimalType[]>([]);
  const [typesError, setTypesError] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<{ data: Animal[]; error: string; key: string }>({ data: [], error: "", key: "" });
  const [summary, setSummary] = useState<AnimalSummary | null>(null);
  const [notice, setNotice] = useState(() => {
    const state = location.state as { notice?: string } | null;
    return state?.notice ?? "";
  });
  const listKey = JSON.stringify([filters, revision]);
  const loading = list.key !== listKey;

  useEffect(() => {
    const controller = new AbortController();
    getAnimalTypes(controller.signal)
      .then((data) => { if (!controller.signal.aborted) { setTypes(data); setTypesError(""); } })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setTypesError(cause instanceof Error ? cause.message : "Не удалось загрузить типы животных");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getAnimals(filters, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setList({ data, error: "", key: listKey }); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setList({ data: [],
          error: cause instanceof Error ? cause.message : "Не удалось загрузить животных", key: listKey });
      });
    return () => controller.abort();
  }, [filters, listKey]);

  useEffect(() => {
    const controller = new AbortController();
    getAnimalSummary(controller.signal)
      .then((data) => { if (!controller.signal.aborted) setSummary(data); })
      .catch(() => { if (!controller.signal.aborted) setSummary(null); });
    return () => controller.abort();
  }, [revision]);

  async function archive(animal: Animal) {
    const saved = await archiveAnimal(animal.id);
    setNotice(`Карточка «${saved.name}» переведена в архив`);
    setRevision((value) => value + 1);
  }

  return <div className="animals-page">
    <header className="animals-page__header">
      <div>
        <p className="animals-page__eyebrow">Реестр центра</p>
        <h1 className="animals-page__title">Учёт животных</h1>
        <p className="animals-page__description">Карточки животных, сведения о владельцах и текущий статус</p>
      </div>
      <nav className="animals-page__actions" aria-label="Действия раздела животных">
        <Link className="animals-page__action animals-page__action--secondary" to="/animals/dictionaries">
          <Icon name="book" />Справочники
        </Link>
        <Link className="animals-page__action animals-page__action--primary" to="/animals/new">
          <Icon name="paw" />Добавить животное
        </Link>
      </nav>
    </header>
    <section className="animals-page__summary" aria-label="Сводка по животным">
      <article className="animals-page__summary-card"><span>Всего в базе</span><strong>{summary?.total ?? "—"}</strong></article>
      <article className="animals-page__summary-card animals-page__summary-card--active"><span>Под опекой</span><strong>{summary?.in_care ?? "—"}</strong></article>
      <article className="animals-page__summary-card"><span>В архиве</span><strong>{summary?.archived ?? "—"}</strong></article>
    </section>
    {notice && <p className="animals-page__notice" role="status">{notice}</p>}
    {typesError && <p className="animals-page__error" role="alert">{typesError}</p>}
    <AnimalsTable animals={list.data} types={types} filters={filters}
      loading={loading} error={list.error} opening={false} saving={false} onFilters={setFilters}
      onEdit={(id) => navigate(`/animals/${id}/edit`)} onArchive={archive}
      onRetry={() => setRevision((value) => value + 1)} />
  </div>;
}
