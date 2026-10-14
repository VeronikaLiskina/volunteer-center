import { DeactivateVolunteerDialog } from "../DeactivateVolunteerDialog/DeactivateVolunteerDialog";
import type { Reassignment } from "../../api/volunteers";
import { formatPhone } from "../../utils/phone";
import { useState } from "react";
import { VOLUNTEERS_PAGE_SIZE } from "../../api/volunteers";
import { VolunteerStatus, volunteerStatusLabels, type Volunteer, type VolunteerFilters } from "../../types/volunteer";
import { Icon } from "../Icon/Icon";
import "./VolunteersTable.scss";

interface VolunteersTableProps {
  volunteers: Volunteer[];
  filters: VolunteerFilters;
  loading: boolean;
  error: string;
  onFilters: (filters: VolunteerFilters) => void;
  onEdit: (id: number) => void;
  onStatus: (volunteer: Volunteer, status: VolunteerStatus, replacements?: Reassignment[]) => Promise<void>;
  onRetry: () => void;
}

export function VolunteersTable({ volunteers, filters, loading, error, onFilters,
  onEdit, onStatus, onRetry }: VolunteersTableProps) {
  const [search, setSearch] = useState(filters.search);
  const [deactivateTarget, setDeactivateTarget] = useState<Volunteer | null>(null);
  const [changingId, setChangingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const rows = volunteers.slice(0, VOLUNTEERS_PAGE_SIZE);

  async function changeStatus(volunteer: Volunteer, status: VolunteerStatus) {
    setChangingId(volunteer.id);
    setActionError("");
    try {
      await onStatus(volunteer, status);
      return true;
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Не удалось изменить статус волонтёра");
      return false;
    } finally {
      setChangingId(null);
    }
  }

  return <section className="volunteers-table" aria-labelledby="volunteers-list-title">
    <div className="volunteers-table__heading-row">
      <div><h2 className="volunteers-table__title" id="volunteers-list-title">Список волонтёров</h2>
        <p className="volunteers-table__caption">Контактные данные и текущий статус команды</p></div>
      {!loading && !error && <span className="volunteers-table__count">На странице: {rows.length}</span>}
    </div>
    <form className="volunteers-table__filters" onSubmit={(event) => {
      event.preventDefault();
      onFilters({ ...filters, search: search.trim(), offset: 0 });
    }}>
      <label className="volunteers-table__filter">Поиск по ФИО
        <input className="volunteers-table__input" type="search" placeholder="Введите имя или фамилию"
          value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <label className="volunteers-table__filter">Статус
        <select className="volunteers-table__input" value={filters.status}
          onChange={(event) => onFilters({ ...filters, status: event.target.value as VolunteerFilters["status"], offset: 0 })}>
          <option value="">Все статусы</option>
          <option value={VolunteerStatus.Active}>Активные</option>
          <option value={VolunteerStatus.Inactive}>Неактивные</option>
        </select>
      </label>
      <button className="volunteers-table__button volunteers-table__button--search" type="submit">Найти</button>
    </form>
    {actionError && <p className="volunteers-table__error" role="alert">{actionError}</p>}
    {loading ? <p className="volunteers-table__state" role="status">Загружаем волонтёров…</p>
      : error ? <div className="volunteers-table__error" role="alert"><p>{error}</p>
        <button className="volunteers-table__button" type="button" onClick={onRetry}>Повторить</button></div>
      : rows.length === 0 ? <div className="volunteers-table__empty">
        <span className="volunteers-table__empty-icon"><Icon name="user" /></span>
        <p className="volunteers-table__empty-title">Волонтёры не найдены</p>
        <p>Добавьте первую карточку или измените условия поиска.</p>
      </div>
      : <div className="volunteers-table__scroll" tabIndex={0} role="region" aria-label="Таблица волонтёров">
        <table className="volunteers-table__table">
          <thead><tr>{["ФИО", "Телефон", "Статус", "Примечание", "Действия"].map((title) =>
            <th key={title} scope="col" className="volunteers-table__column-title">{title}</th>)}</tr></thead>
          <tbody>{rows.map((volunteer) => <tr key={volunteer.id} className="volunteers-table__row">
            <td className="volunteers-table__cell"><strong>{volunteer.full_name}</strong></td>
            <td className="volunteers-table__cell volunteers-table__cell--phone">{formatPhone(volunteer.phone)}</td>
            <td className="volunteers-table__cell"><span className={`volunteers-table__status volunteers-table__status--${volunteer.status}`}>
              {volunteerStatusLabels[volunteer.status]}</span></td>
            <td className="volunteers-table__cell volunteers-table__cell--note">{volunteer.note || "—"}</td>
            <td className="volunteers-table__cell"><div className="volunteers-table__actions">
              <button className="volunteers-table__action" type="button" disabled={changingId !== null}
                aria-label={`Изменить карточку ${volunteer.full_name}`} onClick={() => onEdit(volunteer.id)}>Изменить</button>
              {volunteer.status === VolunteerStatus.Active
                ? <button className="volunteers-table__action volunteers-table__action--deactivate" type="button"
                  disabled={changingId !== null} aria-label={`Деактивировать ${volunteer.full_name}`}
                  onClick={() => setDeactivateTarget(volunteer)}>Деактивировать</button>
                : <button className="volunteers-table__action volunteers-table__action--activate" type="button"
                  disabled={changingId !== null} aria-label={`Активировать ${volunteer.full_name}`}
                  onClick={() => void changeStatus(volunteer, VolunteerStatus.Active)}>
                  {changingId === volunteer.id ? "Активация…" : "Активировать"}</button>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
    <div className="volunteers-table__pagination">
      <button className="volunteers-table__button" type="button" disabled={loading || filters.offset === 0}
        onClick={() => onFilters({ ...filters, offset: Math.max(0, filters.offset - VOLUNTEERS_PAGE_SIZE) })}>Назад</button>
      <span>Страница {Math.floor(filters.offset / VOLUNTEERS_PAGE_SIZE) + 1}</span>
      <button className="volunteers-table__button" type="button"
        disabled={loading || Boolean(error) || volunteers.length <= VOLUNTEERS_PAGE_SIZE}
        onClick={() => onFilters({ ...filters, offset: filters.offset + VOLUNTEERS_PAGE_SIZE })}>Далее</button>
    </div>
    {deactivateTarget && <DeactivateVolunteerDialog volunteer={deactivateTarget} onClose={() => setDeactivateTarget(null)}
      onConfirm={(replacements) => onStatus(deactivateTarget, VolunteerStatus.Inactive, replacements)} />}
  </section>;
}
