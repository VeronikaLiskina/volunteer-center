import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ApiError, request } from "../../api/client";
import "../LoginPage/LoginPage.scss";

export function RegisterPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Navigate to={user.role === "COORDINATOR" ? "/" : "/procedures"} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!fullName.trim()) { setError("Укажите ФИО"); return; }
    if (password !== repeat) { setError("Пароли не совпадают"); return; }
    setBusy(true);
    try {
      await request("/auth/register", { method: "POST", body: JSON.stringify({ full_name: fullName, phone, password }) });
      setPassword(""); setRepeat(""); setDone(true);
    } catch (cause) {
      setError(cause instanceof ApiError && Object.keys(cause.fields).length
        ? Object.values(cause.fields).join(" ") : cause instanceof Error ? cause.message : "Не удалось отправить заявку");
    } finally { setBusy(false); }
  }

  return <section className="login-page">
    <h1>{done ? "Заявка отправлена" : "Регистрация в «Лапке»"}</h1>
    {done ? <div role="status">
      <p>Ваша учётная запись ожидает подтверждения координатором. После назначения роли вы сможете войти по телефону и выбранному паролю.</p>
      <p>Если заявка долго остаётся без ответа, обратитесь к координатору центра.</p>
    </div> : <>
      <p>Укажите ФИО, телефон и придумайте пароль. Координатор рассмотрит заявку и назначит роль.</p>
      <form className="login-page__form" onSubmit={submit}>
        <label>ФИО<input autoComplete="name" required maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        <label>Номер телефона<input type="tel" autoComplete="tel" required maxLength={32} placeholder="+7 (999) 123-45-67"
          value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label>Пароль<input type="password" autoComplete="new-password" required minLength={12} maxLength={1024}
          value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="register-password-hint" /></label>
        <p className="login-page__hint" id="register-password-hint">От 12 до 1024 символов.</p>
        <label>Повторите пароль<input type="password" autoComplete="new-password" required minLength={12} maxLength={1024}
          value={repeat} onChange={(event) => setRepeat(event.target.value)} /></label>
        {error && <p className="login-page__error" role="alert">{error}</p>}
        <button disabled={busy} type="submit">{busy ? "Отправляем…" : "Отправить заявку"}</button>
      </form>
    </>}
    <p><Link to="/login">Перейти ко входу</Link></p>
  </section>;
}
