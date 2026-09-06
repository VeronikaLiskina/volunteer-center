import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createAnimal, getAnimal, updateAnimal } from "../../api/animals";
import { getAnimalTypes, getBreeds } from "../../api/dictionaries";
import { AnimalForm } from "../../components/AnimalForm/AnimalForm";
import type { Animal, AnimalCreate, AnimalType, Breed } from "../../types/animal";
import "../AnimalSectionPage.scss";

type FormData = { types: AnimalType[]; breeds: Breed[]; animal: Animal | null };

export function AnimalCardPage() {
  const { animalId } = useParams();
  const navigate = useNavigate();
  const editId = animalId ? Number(animalId) : null;
  const requestKey = editId ? `edit-${editId}` : "new";
  const [resource, setResource] = useState<{ data: FormData | null; error: string; key: string }>({ data: null, error: "", key: "" });
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const loading = resource.key !== `${requestKey}-${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    const animalRequest = editId && Number.isInteger(editId) && editId > 0
      ? getAnimal(editId) : editId ? Promise.reject(new Error("Некорректный номер карточки")) : Promise.resolve(null);
    Promise.all([getAnimalTypes(controller.signal), getBreeds(undefined, controller.signal), animalRequest])
      .then(([types, breeds, animal]) => {
        if (!controller.signal.aborted) setResource({ data: { types, breeds, animal }, error: "", key: `${requestKey}-${revision}` });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setResource({ data: null,
          error: cause instanceof Error ? cause.message : "Не удалось открыть карточку животного", key: `${requestKey}-${revision}` });
      });
    return () => controller.abort();
  }, [editId, requestKey, revision]);

  async function save(data: AnimalCreate, addAnother: boolean) {
    const saved = resource.data?.animal ? await updateAnimal(resource.data.animal.id, data) : await createAnimal(data);
    const message = resource.data?.animal ? "Изменения карточки сохранены" : "Карточка животного сохранена";
    if (addAnother) {
      setNotice(`${message}. Можно заполнить следующую карточку.`);
      if (editId) navigate("/animals/new", { replace: true });
    } else {
      navigate("/animals", { state: { notice: message } });
    }
    return saved;
  }

  return <div className="animal-section-page">
    <header className="animal-section-page__header">
      <div>
        <h1 className="animal-section-page__title">{editId ? "Карточка животного" : "Добавление животного"}</h1>
        <p className="animal-section-page__description">Заполните сведения и сохраните карточку</p>
      </div>
      <Link className="animal-section-page__close" to="/animals" aria-label="Закрыть и вернуться к списку животных">
        <span className="animal-section-page__close-icon" aria-hidden="true">×</span> Закрыть
      </Link>
    </header>
    {notice && <p className="animal-section-page__notice" role="status">{notice}</p>}
    {loading ? <p className="animal-section-page__state" role="status">Загружаем карточку…</p>
      : resource.error ? <p className="animal-section-page__error" role="alert">{resource.error}
        <button className="animal-section-page__retry" type="button" onClick={() => setRevision((value) => value + 1)}>Повторить</button></p>
      : resource.data && <AnimalForm key={requestKey} animal={resource.data.animal} types={resource.data.types}
        breeds={resource.data.breeds} onSave={save} onClear={() => {
          setNotice("");
          if (editId) navigate("/animals/new");
        }} />}
  </div>;
}
