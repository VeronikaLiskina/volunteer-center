import { useEffect, useRef, useState } from "react";
import { AnimalStatus, animalStatusLabels, type Animal, type AnimalFilters, type AnimalType } from "../../types/animal";
import { PAGE_SIZE } from "../../api/animals";
import { Icon } from "../Icon/Icon";
import "./AnimalsTable.scss";

interface AnimalsTableProps {
  animals: Animal[];
  types: AnimalType[];
  filters: AnimalFilters;
  loading: boolean;
  error: string;
  opening: boolean;
  saving: boolean;
  onFilters: (filters: AnimalFilters) => void;
  onEdit: (id: number) => void;
  onArchive: (animal: Animal) => Promise<void>;
  onRetry: () => void;
}

function ArchiveDialog({ animal, onConfirm, onClose }: {
  animal: Animal; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function confirm() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { await onConfirm(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось архивировать карточку"); }
    finally { locked.current = false; setBusy(false); }
  }

  return <dialog className="animals-table__dialog" ref={dialog} aria-labelledby="archive-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="archive-title">Архивировать карточку?</h2>
    <p>Животное «{animal.name}» будет переведено в архив. Карточка сохранится и будет доступна для просмотра.</p>
    {error && <p className="animals-table__error" role="alert">{error}</p>}
    <div className="animals-table__dialog-actions">
      <button className="animals-table__button" type="button" autoFocus disabled={busy} onClick={onClose}>Отмена</button>
      <button className="animals-table__button animals-table__button--danger" type="button" disabled={busy}
        onClick={() => void confirm()}>{busy ? "Архивирование…" : "В архив"}</button>
    </div>
  </dialog>;
}

export function AnimalsTable({ animals, types, filters, loading, error, opening, saving,
  onFilters, onEdit, onArchive, onRetry }: AnimalsTableProps) {
  const [search, setSearch] = useState(filters.search);
  const [archiveTarget, setArchiveTarget] = useState<Animal | null>(null);
  const rows = animals.slice(0, PAGE_SIZE);
  const weightFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return <section className="animals-table" aria-labelledby="animals-list-title">
    <div className="animals-table__heading-row">
      <div>
        <h2 className="animals-table__title" id="animals-list-title">Список животных</h2>
        <p className="animals-table__caption">Используйте фильтры, чтобы быстро найти нужную карточку</p>
      </div>
      <span className="animals-table__count">На странице: {rows.length}</span>
    </div>
    <form className="animals-table__filters" onSubmit={(event) => {
      event.preventDefault(); onFilters({ ...filters, search: search.trim(), offset: 0 });
    }}>
      <label className="animals-table__filter">Поиск по кличке
        <input className="animals-table__input" type="search" placeholder="Введите кличку" value={search}
          maxLength={50} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <label className="animals-table__filter">Тип животного
        <select className="animals-table__input" value={filters.animal_type_id}
          onChange={(e) => onFilters({ ...filters, animal_type_id: e.target.value, offset: 0 })}>
          <option value="">Все типы</option>
          {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </label>
      <label className="animals-table__filter">Статус
        <select className="animals-table__input" value={filters.status}
          onChange={(e) => onFilters({ ...filters, status: e.target.value as AnimalFilters["status"], offset: 0 })}>
          <option value="">Все статусы</option>
          <option value={AnimalStatus.InCare}>Под опекой</option>
          <option value={AnimalStatus.Archived}>В архиве</option>
        </select>
      </label>
      <button className="animals-table__button animals-table__button--search" type="submit">Найти</button>
    </form>
    {opening && <p className="animals-table__state" role="status">Загружаем карточку…</p>}
    {loading ? <p className="animals-table__state" role="status">Загружаем животных…</p>
      : error ? <div className="animals-table__error" role="alert"><p>{error}</p>
        <button className="animals-table__button" type="button" onClick={onRetry}>Повторить</button></div>
      : rows.length === 0 ? <div className="animals-table__empty" role="status">
        <span className="animals-table__empty-icon"><Icon name="paw" /></span>
        <strong className="animals-table__empty-title">Животные не найдены.</strong>
        <p>Добавьте карточку или измените параметры поиска.</p>
      </div>
      : <div className="animals-table__scroll" tabIndex={0} role="region" aria-label="Таблица животных">
        <table className="animals-table__table">
          <thead><tr>{["Кличка", "Тип", "Порода", "Вес, кг", "Год рождения", "Хозяин / ответственное лицо", "Телефон", "Статус", "Действия"]
            .map((title) => <th key={title} scope="col" className="animals-table__heading">{title}</th>)}</tr></thead>
          <tbody>{rows.map((animal) => <tr key={animal.id} className="animals-table__row">
            <td className="animals-table__cell animals-table__cell--name">{animal.name}</td>
            <td className="animals-table__cell">{animal.animal_type.name}</td>
            <td className="animals-table__cell">{animal.breed.name}</td>
            <td className="animals-table__cell animals-table__cell--numeric">{weightFormat.format(Number(animal.weight))}</td>
            <td className="animals-table__cell animals-table__cell--numeric">{animal.birth_year}</td>
            <td className="animals-table__cell">{animal.owner_name || "—"}</td>
            <td className="animals-table__cell animals-table__cell--phone">{animal.owner_phone || "—"}</td>
            <td className="animals-table__cell"><span className={`animals-table__status animals-table__status--${animal.status}`}>
              {animalStatusLabels[animal.status]}</span></td>
            <td className="animals-table__cell"><div className="animals-table__actions">
              <button className="animals-table__action" type="button" disabled={opening || saving}
                aria-label={`${animal.status === AnimalStatus.Archived ? "Просмотреть" : "Редактировать"} карточку ${animal.name}`}
                onClick={() => onEdit(animal.id)}>{animal.status === AnimalStatus.Archived ? "Просмотр" : "Изменить"}</button>
              {animal.status !== AnimalStatus.Archived && <button className="animals-table__action animals-table__action--archive"
                type="button" disabled={saving || opening} onClick={() => setArchiveTarget(animal)} aria-label={`Архивировать карточку ${animal.name}`}>В архив</button>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
    <div className="animals-table__pagination">
      <button className="animals-table__button" type="button" disabled={loading || filters.offset === 0}
        onClick={() => onFilters({ ...filters, offset: Math.max(0, filters.offset - PAGE_SIZE) })}>Назад</button>
      <span>Страница {Math.floor(filters.offset / PAGE_SIZE) + 1}</span>
      <button className="animals-table__button" type="button" disabled={loading || Boolean(error) || animals.length <= PAGE_SIZE}
        onClick={() => onFilters({ ...filters, offset: filters.offset + PAGE_SIZE })}>Далее</button>
    </div>
    {archiveTarget && <ArchiveDialog animal={archiveTarget} onClose={() => setArchiveTarget(null)}
      onConfirm={() => onArchive(archiveTarget)} />}
  </section>;
}
