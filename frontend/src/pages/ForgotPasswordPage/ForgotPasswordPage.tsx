import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ApiError, request } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import "../LoginPage/LoginPage.scss";

type CodeResponse = { request_id: string; message: string; resend_after: number; expires_in: number };

export function ForgotPasswordPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [phone, setPhone] = useState(() => typeof location.state?.phone === "string" ? location.state.phone : "");
  const [challenge, setChallenge] = useState<CodeResponse | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [retryUntil, setRetryUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!retryUntil) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  if (user) return <Navigate to={user.role === "COORDINATOR" ? "/" : "/procedures"} replace />;

  function cooldown(seconds: number) {
    setRemaining(seconds);
    setRetryUntil(Date.now() + seconds * 1000);
  }

  function showError(cause: unknown) {
    setError(cause instanceof ApiError && Object.keys(cause.fields).length
      ? Object.values(cause.fields).join(" ") : cause instanceof Error ? cause.message : "Не удалось выполнить запрос");
    if (cause instanceof ApiError && cause.retryAfter) cooldown(cause.retryAfter);
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (busy || remaining > 0) return;
    setBusy(true); setError("");
    try {
      const result = await request<CodeResponse>("/auth/password-reset/request", {
        method: "POST", body: JSON.stringify({ phone }),
      });
      setChallenge(result); setCode(""); cooldown(result.resend_after);
    } catch (cause) { showError(cause); }
    finally { setBusy(false); }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (busy || !challenge) return;
    setError("");
    if (password !== repeat) { setError("Пароли не совпадают"); return; }
    setBusy(true);
    try {
      await request<void>("/auth/password-reset/confirm", {
        method: "POST", body: JSON.stringify({ request_id: challenge.request_id, code, password }),
      });
      setCode(""); setPassword(""); setRepeat(""); setChallenge(null); setDone(true);
    } catch (cause) { showError(cause); }
    finally { setBusy(false); }
  }

  return <section className="login-page">
    <h1>{done ? "Пароль изменён" : "Восстановление пароля"}</h1>
    {done ? <p role="status">Теперь вы можете войти с новым паролем. Предыдущие сеансы завершены.</p> : <>
      {!challenge ? <>
        <p>Укажите телефон, который использовали при регистрации. Мы отправим SMS с кодом для смены пароля.</p>
        <form className="login-page__form" onSubmit={sendCode}>
          <label>Номер телефона<input type="tel" inputMode="tel" autoComplete="tel" required maxLength={32}
            placeholder="+7 (999) 123-45-67" value={phone} disabled={busy}
            onChange={(event) => setPhone(event.target.value)} /></label>
          {error && <p className="login-page__error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || remaining > 0}>
            {busy ? "Отправляем…" : remaining > 0 ? `Повторить через ${remaining} с` : "Получить код"}
          </button>
        </form>
      </> : <>
        <p role="status">{challenge.message} Указанный номер: {phone}.</p>
        <p id="reset-code-hint">Код действует {Math.ceil(challenge.expires_in / 60)} минут. Используйте код из последнего SMS.</p>
        <form className="login-page__form" onSubmit={confirm}>
          <label>Код из SMS<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}"
            minLength={6} maxLength={6} value={code} disabled={busy} aria-describedby="reset-code-hint"
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
          <label>Новый пароль<input type="password" autoComplete="new-password" required minLength={12} maxLength={1024}
            value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} aria-describedby="reset-password-hint" /></label>
          <p className="login-page__hint" id="reset-password-hint">От 12 до 1024 символов.</p>
          <label>Повторите пароль<input type="password" autoComplete="new-password" required minLength={12} maxLength={1024}
            value={repeat} disabled={busy} onChange={(event) => setRepeat(event.target.value)} /></label>
          {error && <p className="login-page__error" role="alert">{error}</p>}
          <button type="submit" disabled={busy}>{busy ? "Подождите…" : "Сохранить новый пароль"}</button>
          <div className="login-page__recovery-actions">
            <button className="login-page__secondary" type="button" disabled={busy || remaining > 0} onClick={() => sendCode()}>
              {remaining > 0 ? `Отправить код повторно через ${remaining} с` : "Отправить код повторно"}
            </button>
            <button className="login-page__secondary" type="button" disabled={busy} onClick={() => {
              setChallenge(null); setCode(""); setPassword(""); setRepeat(""); setError(""); setRetryUntil(0); setRemaining(0);
            }}>Изменить номер</button>
          </div>
        </form>
      </>}
    </>}
    <p><Link to="/login">Вернуться ко входу</Link></p>
  </section>;
}
