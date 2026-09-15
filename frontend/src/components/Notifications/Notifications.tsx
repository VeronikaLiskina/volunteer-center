import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../../api/client";
import { Icon } from "../Icon/Icon";
import "./Notifications.scss";

interface Notification { id: number; procedure_id: number; kind: string; message: string; is_read: boolean; created_at: string }
interface NotificationList { items: Notification[]; unread_count: number }

export function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationList | null>(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await request<NotificationList>(`/notifications?limit=20&offset=${offset}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось загрузить уведомления");
      } finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [offset, revision, open]);
  async function markRead(id: number) {
    try { await request<void>(`/notifications/${id}/read`, { method: "PATCH" }); setRevision((n) => n + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сохранить"); }
  }
  return <div className="notifications">
    <button className="header__notification" type="button" aria-label={`Уведомления${data?.unread_count ? `: ${data.unread_count} непрочитанных` : ""}`}
      aria-expanded={open} aria-controls="notifications-panel" onClick={() => setOpen(!open)}>
      <Icon name="bell" />{Boolean(data?.unread_count) && <span className="header__notification-dot" />}
    </button>
    {open && <section className="notifications__panel" id="notifications-panel" aria-label="Уведомления">
      <div className="notifications__heading"><h2>Уведомления ({data?.unread_count ?? "…"})</h2><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть уведомления">×</button></div>
      {error && <p role="alert">{error}<button type="button" onClick={() => setRevision((n) => n + 1)}>Повторить</button></p>}
      {!data && !error && <p role="status">Загрузка…</p>}
      {data?.items.length === 0 && <p>Уведомлений пока нет</p>}
      <ul className="notifications__list">{data?.items.map((item) => <li className={`notifications__item${item.is_read ? "" : " notifications__item--unread"}`} key={item.id}>
        <p>{item.message}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("ru-RU")}</time>
        <div className="notifications__actions">{item.kind !== "reassigned" && <Link to={`/procedures/${item.procedure_id}/execute`} onClick={() => setOpen(false)}>Открыть процедуру</Link>}
          {!item.is_read && <button type="button" onClick={() => void markRead(item.id)}>Прочитано</button>}</div>
      </li>)}</ul>
      <div className="notifications__actions"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Назад</button>
        <button type="button" disabled={!data || data.items.length < 20} onClick={() => setOffset(offset + 20)}>Далее</button></div>
    </section>}
  </div>;
}
