import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createVolunteer, getVolunteer, updateVolunteer } from "../../api/volunteers";
import { VolunteerForm } from "../../components/VolunteerForm/VolunteerForm";
import type { Volunteer, VolunteerCreate } from "../../types/volunteer";
import "./VolunteerCardPage.scss";

export function VolunteerCardPage() {
  const { volunteerId } = useParams();
  const navigate = useNavigate();
  const isEditRoute = volunteerId !== undefined;
  const editId = isEditRoute ? Number(volunteerId) : null;
  const hasValidEditId = editId !== null && Number.isInteger(editId) && editId > 0;
  const requestKey = isEditRoute ? `edit-${volunteerId}` : "new";
  const [resource, setResource] = useState<{ volunteer: Volunteer | null; error: string; key: string }>({ volunteer: null, error: "", key: "" });
  const [revision, setRevision] = useState(0);
  const loading = resource.key !== `${requestKey}-${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    const request = !isEditRoute
      ? Promise.resolve(null)
      : hasValidEditId
        ? getVolunteer(editId, controller.signal)
        : Promise.reject(new Error("Некорректный номер карточки"));
    request.then((volunteer) => {
      if (!controller.signal.aborted) setResource({ volunteer, error: "", key: `${requestKey}-${revision}` });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setResource({ volunteer: null,
        error: cause instanceof Error ? cause.message : "Не удалось открыть карточку волонтёра", key: `${requestKey}-${revision}` });
    });
    return () => controller.abort();
  }, [editId, hasValidEditId, isEditRoute, requestKey, revision]);

  async function save(data: VolunteerCreate) {
    const saved = resource.volunteer
      ? await updateVolunteer(resource.volunteer.id, data)
      : await createVolunteer(data);
    navigate("/volunteers", { state: { notice: resource.volunteer
      ? `Карточка «${saved.full_name}» обновлена`
      : `Волонтёр «${saved.full_name}» добавлен` } });
  }

  return <div className="volunteer-card-page">
    <header className="volunteer-card-page__header">
      <div>
        <p className="volunteer-card-page__eyebrow">Учёт волонтёров</p>
        <h1 className="volunteer-card-page__title">{isEditRoute ? "Карточка волонтёра" : "Добавление волонтёра"}</h1>
        <p className="volunteer-card-page__description">Только основные контактные данные без учётной записи и доступа к системе</p>
      </div>
      <Link className="volunteer-card-page__close" to="/volunteers" aria-label="Закрыть и вернуться к списку волонтёров">
        <span aria-hidden="true">×</span> Закрыть
      </Link>
    </header>
    {loading ? <p className="volunteer-card-page__state" role="status">Загружаем карточку…</p>
      : resource.error ? <p className="volunteer-card-page__error" role="alert">{resource.error}
        <button className="volunteer-card-page__retry" type="button" onClick={() => setRevision((value) => value + 1)}>Повторить</button></p>
      : <VolunteerForm key={requestKey} volunteer={resource.volunteer} onSave={save} />}
  </div>;
}
