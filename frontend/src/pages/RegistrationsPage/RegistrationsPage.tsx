import { useEffect, useState } from "react";
import { request } from "../../api/client";
import "./RegistrationsPage.scss";

type Role = "COORDINATOR" | "VOLUNTEER";
type Status = "pending" | "approved" | "rejected";
interface Registration {
  id: number; full_name: string; phone: string | null; role: Role | null;
  registration_status: Status; created_at: string; reviewed_at: string | null;
}
const statuses: Record<Status, string> = { pending: "Ожидают подтверждения", approved: "Подтверждены", rejected: "Отклонены" };
const roles: Record<Role, string> = { COORDINATOR: "Координатор", VOLUNTEER: "Волонтёр" };
const date = (value: string) => new Date(value).toLocaleString("ru-RU");

function RegistrationCard({ item, busy, onReview }: {
  item: Registration; busy: boolean; onReview: (id: number, role: Role | null) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>("VOLUNTEER");
  return <article className="registrations-page__card" aria-label={item.full_name}>
    <div><h2>{item.full_name}</h2><p>{item.phone || "Телефон не указан"}</p>
      <p>Зарегистрирован: <time dateTime={item.created_at}>{date(item.created_at)}</time></p>
      {item.reviewed_at && <p>Рассмотрено: <time dateTime={item.reviewed_at}>{date(item.reviewed_at)}</time></p>}
    </div>
    {item.registration_status === "pending" ? <div className="registrations-page__review">
      <label>Назначить роль<select value={role} disabled={busy} onChange={(event) => setRole(event.target.value as Role)}>
        <option value="VOLUNTEER">Волонтёр</option><option value="COORDINATOR">Координатор</option>
      </select></label>
      <p>{role === "COORDINATOR" ? "Полный доступ, включая рассмотрение заявок и назначение ролей." : "Доступ к своим назначениям и отметке выполнения услуг."}</p>
      <div className="registrations-page__actions">
        <button disabled={busy} onClick={() => void onReview(item.id, role)}>Подтвердить</button>
        <button className="registrations-page__reject" disabled={busy} onClick={() => void onReview(item.id, null)}>Отклонить</button>
      </div>
    </div> : <p>{item.role ? `Роль: ${roles[item.role]}` : "Заявка отклонена"}</p>}
  </article>;
}

export function RegistrationsPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request<Registration[]>(`/registrations?status=${status}&limit=51&offset=${offset}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setItems(data); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось загрузить заявки"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, offset, revision]);

  function refresh() { setError(""); setLoading(true); setRevision((value) => value + 1); }
  async function review(id: number, role: Role | null) {
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/registrations/${id}/${role ? "approve" : "reject"}`, {
        method: "POST", ...(role ? { body: JSON.stringify({ role }) } : {}),
      });
      setNotice(role ? `Заявка подтверждена. Назначена роль «${roles[role]}». Пользователь может войти.` : "Заявка отклонена. Доступ не предоставлен.");
      if (items.length === 1 && offset > 0) { setOffset(offset - 50); setLoading(true); }
      else refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось рассмотреть заявку"); }
    finally { setBusy(false); }
  }

  return <section className="registrations-page">
    <h1>Заявки на регистрацию</h1>
    <p>Проверьте ФИО и телефон, выберите роль и подтвердите заявку. До подтверждения доступ к рабочим данным закрыт.</p>
    <div className="registrations-page__toolbar">
      <label>Статус заявок<select value={status} disabled={busy} onChange={(event) => {
        setStatus(event.target.value as Status); setOffset(0); setLoading(true); setError(""); setNotice("");
      }}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button onClick={refresh} disabled={busy || loading}>Обновить список</button>
    </div>
    {notice && <p className="registrations-page__notice" role="status">{notice}</p>}
    {error && <p className="registrations-page__error" role="alert">{error}</p>}
    {loading ? <p role="status">Загружаем заявки…</p> : !error && <>
      {items.length ? <div className="registrations-page__list">{items.slice(0, 50).map((item) =>
        <RegistrationCard key={item.id} item={item} busy={busy} onReview={review} />)}</div> : <p>Заявок с этим статусом нет.</p>}
      {(offset > 0 || items.length > 50) && <nav className="registrations-page__actions" aria-label="Страницы заявок">
        <button disabled={busy || offset === 0} onClick={() => { setOffset(offset - 50); setLoading(true); }}>Назад</button>
        <span>Страница {offset / 50 + 1}</span>
        <button disabled={busy || items.length <= 50} onClick={() => { setOffset(offset + 50); setLoading(true); }}>Далее</button>
      </nav>}
    </>}
  </section>;
}
