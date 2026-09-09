import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAnimalTypes, getBreeds } from "../../api/dictionaries";
import type { AnimalType, Breed } from "../../types/animal";
import "../AnimalSectionPage.scss";

type Dictionaries = { types: AnimalType[]; breeds: Breed[] };

export function DictionariesPage() {
  const [revision, setRevision] = useState(0);
  const [resource, setResource] = useState<{ data: Dictionaries | null; error: string; version: number }>({ data: null, error: "", version: -1 });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const loading = resource.version !== revision;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getAnimalTypes(controller.signal), getBreeds(undefined, controller.signal)])
      .then(([types, breeds]) => {
        if (!controller.signal.aborted) setResource({ data: { types, breeds }, error: "", version: revision });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setResource({ data: null,
          error: cause instanceof Error ? cause.message : "Не удалось загрузить справочники", version: revision });
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => { if (!loading) titleRef.current?.focus(); }, [loading]);

  return <div className="animal-section-page">
    <header className="animal-section-page__header">
      <div>
        <p className="animal-section-page__eyebrow">Реестр центра</p>
        <h1 className="animal-section-page__title" ref={titleRef} tabIndex={-1}>Справочники</h1>
        <p className="animal-section-page__description">Типы животных и доступные для них породы</p>
      </div>
      <Link className="animal-section-page__close" to="/animals" aria-label="Закрыть справочники и вернуться к списку животных">
        <span className="animal-section-page__close-icon" aria-hidden="true">×</span> Закрыть
      </Link>
    </header>
    {loading ? <p className="animal-section-page__state" role="status">Загружаем справочники…</p>
      : resource.error ? <p className="animal-section-page__error" role="alert">{resource.error}
        <button className="animal-section-page__retry" type="button" onClick={() => setRevision((value) => value + 1)}>Повторить</button></p>
      : resource.data && <section className="dictionaries-card" aria-labelledby="dictionaries-title">
        <h2 className="dictionaries-card__title" id="dictionaries-title">Содержимое справочников</h2>
        <details className="dictionaries-card__item" open>
          <summary className="dictionaries-card__summary">Типы животных — {resource.data.types.length}</summary>
          <ul className="dictionaries-card__list">{resource.data.types.map((type) => <li key={type.id}>{type.name}</li>)}</ul>
        </details>
        <details className="dictionaries-card__item">
          <summary className="dictionaries-card__summary">Породы — {resource.data.breeds.length}</summary>
          {resource.data.types.map((type) => <div key={type.id} className="dictionaries-card__group">
            <h3 className="dictionaries-card__group-title">{type.name}</h3>
            <ul className="dictionaries-card__list">{resource.data?.breeds.filter((breed) => breed.animal_type_id === type.id)
              .map((breed) => <li key={breed.id}>{breed.name}</li>)}</ul>
          </div>)}
        </details>
      </section>}
  </div>;
}
