import { useEffect, useRef, useState } from "react";
import { getDeactivationAssignments, type DeactivationAssignment, type Reassignment } from "../../api/volunteers";
import type { Volunteer } from "../../types/volunteer";
import { formatDate } from "../../utils/date";
import { VolunteerDetails } from "../VolunteerDetails/VolunteerDetails";
import "./DeactivateVolunteerDialog.scss";

export function DeactivateVolunteerDialog({ volunteer, onConfirm, onClose }: {
  volunteer: Volunteer; onConfirm: (replacements: Reassignment[]) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [assignments, setAssignments] = useState<DeactivationAssignment[] | null>(null);
  const [replacements, setReplacements] = useState<Record<number, number>>({});
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    getDeactivationAssignments(volunteer.id, controller.signal).then((items) => {
      if (!controller.signal.aborted) { setAssignments(items); setReplacements({}); setError(""); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось загрузить назначения");
    });
    return () => controller.abort();
  }, [volunteer.id, revision]);

  async function confirm() {
    if (locked.current || assignments === null) return;
    locked.current = true; setBusy(true); setError("");
    try {
      await onConfirm(assignments.map(({ procedure }) => ({ procedure_id: procedure.id, volunteer_id: replacements[procedure.id] })));
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось деактивировать волонтёра"); }
    finally { locked.current = false; setBusy(false); }
  }

  return <dialog className="deactivate-volunteer-dialog" ref={dialog} aria-labelledby="deactivate-volunteer-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="deactivate-volunteer-title">Деактивировать волонтёра?</h2>
    <p>«{volunteer.full_name}» останется в базе. Для всех текущих назначений выберите замену.</p>
    {assignments === null && !error && <p role="status">Загружаем назначения…</p>}
    {assignments?.length === 0 && <p>Текущих назначений нет.</p>}
    {assignments?.map(({ procedure, candidates }) => <article className="deactivate-volunteer-dialog__assignment" key={procedure.id}>
      <h3>{procedure.animal.name} · {procedure.procedure_type.name}</h3>
      <p>{formatDate(procedure.planned_date)} · {procedure.planned_time.slice(0, 5)} · {procedure.duration_minutes} мин</p>
      {procedure.comment && <p>{procedure.comment}</p>}
      {candidates.length === 0 ? <p role="alert">Нет подходящих свободных волонтёров. Деактивация недоступна.</p>
        : <label>Замена для услуги №{procedure.id}
          <select value={replacements[procedure.id] || ""} disabled={busy} onChange={(event) =>
            setReplacements((current) => ({ ...current, [procedure.id]: Number(event.target.value) }))}>
            <option value="">Выберите волонтёра</option>
            {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}
          </select>
        </label>}
      {candidates.filter((candidate) => candidate.id === replacements[procedure.id]).map((candidate) =>
        <VolunteerDetails key={candidate.id} volunteer={candidate} />)}
    </article>)}
    {error && <p role="alert">{error}</p>}
    <div className="deactivate-volunteer-dialog__actions">
      <button type="button" autoFocus disabled={busy} onClick={onClose}>Отмена</button>
      {error && <button type="button" disabled={busy} onClick={() => { setAssignments(null); setRevision((value) => value + 1); }}>Обновить назначения</button>}
      <button type="button" disabled={busy || assignments === null || assignments.some(({ procedure, candidates }) =>
        !candidates.some((candidate) => candidate.id === replacements[procedure.id]))}
        onClick={() => void confirm()}>{busy ? "Деактивация…" : "Деактивировать"}</button>
    </div>
  </dialog>;
}
