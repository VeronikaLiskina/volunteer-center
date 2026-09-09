import { useEffect, useState } from "react";
import { getAnimalOptions } from "../../api/animals";
import { CARE_PROCEDURES_PAGE_SIZE } from "../../api/careProcedures";
import { getCareProcedureTypes } from "../../api/careProcedureTypes";
import { getVolunteerOptions } from "../../api/volunteers";
import {
  CareProcedureStatus, careProcedureStatusLabels, type CareProcedure,
  type CareProcedureFilters, type CareProcedureType,
} from "../../types/careProcedure";
import type { Animal } from "../../types/animal";
import type { Volunteer } from "../../types/volunteer";
import { Icon } from "../Icon/Icon";
import "./CareProceduresTable.scss";

interface Props {
  procedures: CareProcedure[];
  filters: CareProcedureFilters;
  loading: boolean;
  error: string;
  onFilters: (filters: CareProcedureFilters) => void;
  onEdit: (id: number) => void;
  onRetry: () => void;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export function CareProceduresTable({ procedures, filters, loading, error, onFilters, onEdit, onRetry }: Props) {
  const [options, setOptions] = useState<{ animals: Animal[]; volunteers: Volunteer[]; types: CareProcedureType[] }>({
    animals: [], volunteers: [], types: [],
  });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getAnimalOptions(controller.signal), getVolunteerOptions(controller.signal), getCareProcedureTypes(controller.signal)])
      .then(([animals, volunteers, types]) => { if (!controller.signal.aborted) setOptions({ animals, volunteers, types }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const rows = procedures.slice(0, CARE_PROCEDURES_PAGE_SIZE);
  function update(changes: Partial<CareProcedureFilters>) {
    onFilters({ ...filters, ...changes, offset: 0 });
  }

  return <section className="care-procedures-table" aria-labelledby="care-procedures-list-title">
    <div className="care-procedures-table__heading-row">
      <div><h2 id="care-procedures-list-title">План процедур</h2>
        <p>Назначения отсортированы по плановой дате и времени</p></div>
      {!loading && !error && <span className="care-procedures-table__count">На странице: {rows.length}</span>}
    </div>
    <div className="care-procedures-table__filters" aria-label="Фильтры процедур">
      <label>Статус<select value={filters.status} onChange={(event) => update({ status: event.target.value as CareProcedureFilters["status"] })}>
        <option value="">Все статусы</option>
        {Object.values(CareProcedureStatus).map((status) => <option key={status} value={status}>{careProcedureStatusLabels[status]}</option>)}
      </select></label>
      <label>Животное<select value={filters.animal_id} onChange={(event) => update({ animal_id: event.target.value })}>
        <option value="">Все животные</option>{options.animals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>Волонтёр<select value={filters.volunteer_id} onChange={(event) => update({ volunteer_id: event.target.value })}>
        <option value="">Все волонтёры</option>{options.volunteers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
      </select></label>
      <label>Тип<select value={filters.procedure_type_id} onChange={(event) => update({ procedure_type_id: event.target.value })}>
        <option value="">Все типы</option>{options.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>С даты<input type="date" value={filters.date_from} onChange={(event) => update({ date_from: event.target.value })} /></label>
      <label>По дату<input type="date" value={filters.date_to} onChange={(event) => update({ date_to: event.target.value })} /></label>
      <button type="button" onClick={() => onFilters({ status: "", animal_id: "", volunteer_id: "", procedure_type_id: "", date_from: "", date_to: "", offset: 0 })}>Сбросить</button>
    </div>
    {loading ? <p className="care-procedures-table__state" role="status">Загружаем процедуры…</p>
      : error ? <div className="care-procedures-table__error" role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Повторить</button></div>
      : rows.length === 0 ? <div className="care-procedures-table__empty">
        <span><Icon name="calendar" /></span><strong>Процедуры не найдены</strong>
        <p>Создайте первое назначение или измените фильтры.</p></div>
      : <div className="care-procedures-table__scroll" tabIndex={0} role="region" aria-label="Таблица процедур">
        <table><thead><tr>{["Дата", "Время", "Животное", "Процедура", "Волонтёр", "Статус", "Действие"].map((title) =>
          <th key={title} scope="col">{title}</th>)}</tr></thead>
          <tbody>{rows.map((item) => <tr className="care-procedures-table__row" key={item.id}>
            <td>{formatDate(item.planned_date)}</td><td>{item.planned_time.slice(0, 5)}</td>
            <td><strong>{item.animal.name}</strong></td><td>{item.procedure_type.name}<small>{item.duration_minutes} мин</small></td>
            <td>{item.volunteer.full_name}</td><td><span className={`care-procedures-table__status care-procedures-table__status--${item.status}`}>
              {careProcedureStatusLabels[item.status]}</span></td>
            <td><button className="care-procedures-table__edit" type="button" onClick={() => onEdit(item.id)}>Изменить</button></td>
          </tr>)}</tbody></table>
      </div>}
    <div className="care-procedures-table__pagination">
      <button type="button" disabled={loading || filters.offset === 0}
        onClick={() => onFilters({ ...filters, offset: Math.max(0, filters.offset - CARE_PROCEDURES_PAGE_SIZE) })}>Назад</button>
      <span>Страница {Math.floor(filters.offset / CARE_PROCEDURES_PAGE_SIZE) + 1}</span>
      <button type="button" disabled={loading || Boolean(error) || procedures.length <= CARE_PROCEDURES_PAGE_SIZE}
        onClick={() => onFilters({ ...filters, offset: filters.offset + CARE_PROCEDURES_PAGE_SIZE })}>Далее</button>
    </div>
  </section>;
}
