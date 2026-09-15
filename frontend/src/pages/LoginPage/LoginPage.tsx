import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./LoginPage.scss";

export function LoginPage() {
  const auth = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate to={auth.user.role === "COORDINATOR" ? "/" : "/procedures"} replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await auth.login(phone, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось войти"); }
    finally { setBusy(false); }
  }
  return <section className="login-page">
    <h1>Вход в «Лапку»</h1><p>Войдите с учётной записью, выданной координатором.</p>
    <form className="login-page__form" onSubmit={submit}>
      <label>Номер телефона<input type="tel" inputMode="tel" autoComplete="username" placeholder="+7 (999) 123-45-67"
        value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={32} aria-describedby="login-phone-hint" /></label>
      <p className="login-page__hint" id="login-phone-hint">Можно ввести номер с +7 или 8.</p>
      <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={1024} /></label>
      {(error || auth.error) && <p className="login-page__error" role="alert">{error || auth.error}</p>}
      <button type="submit" disabled={busy || auth.loading}>{busy ? "Входим…" : "Войти"}</button>
    </form>
  </section>;
}
