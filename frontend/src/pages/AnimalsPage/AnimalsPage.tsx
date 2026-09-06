import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { archiveAnimal, getAnimals } from "../../api/animals";
import { getAnimalTypes } from "../../api/dictionaries";
import { AnimalsTable } from "../../components/AnimalsTable/AnimalsTable";
import type { Animal, AnimalFilters, AnimalType } from "../../types/animal";
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

  async function archive(animal: Animal) {
    const saved = await archiveAnimal(animal.id);
    setNotice(`Карточка «${saved.name}» переведена в архив`);
    setRevision((value) => value + 1);
  }

  return <div className="animals-page">
    <div className="animals-page__heading">
      <h1 className="animals-page__title">Учёт животных</h1>
      <p className="animals-page__description">Регистрация, поиск и редактирование карточек животных</p>
      <nav className="animals-page__section-navigation" aria-label="Разделы учёта животных">
        <Link className="animals-page__section-link animals-page__section-link--primary" to="/animals/new">
          <span className="animals-page__section-link-title">Добавить животное</span>
          <span className="animals-page__section-link-description">Открыть новую карточку</span>
        </Link>
        <Link className="animals-page__section-link" to="/animals/dictionaries">
          <span className="animals-page__section-link-title">Справочники</span>
          <span className="animals-page__section-link-description">Типы животных и породы</span>
        </Link>
      </nav>
    </div>
    {notice && <p className="animals-page__notice" role="status">{notice}</p>}
    {typesError && <p className="animals-page__error" role="alert">{typesError}</p>}
    <AnimalsTable animals={list.data} types={types} filters={filters}
      loading={loading} error={list.error} opening={false} saving={false} onFilters={setFilters}
      onEdit={(id) => navigate(`/animals/${id}/edit`)} onArchive={archive}
      onRetry={() => setRevision((value) => value + 1)} />
  </div>;
}
