import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "../LoginPage/LoginPage.scss";

export function ForgotPasswordPage() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === "COORDINATOR" ? "/" : "/procedures"} replace />;

  return <section className="login-page">
    <h1>Восстановление пароля</h1>
    <p>Для восстановления доступа обратитесь к координатору центра.</p>
    <p>Сообщите ФИО и номер телефона, указанный при регистрации. Координатор поможет восстановить доступ.</p>
    <p><Link to="/login">Вернуться ко входу</Link></p>
  </section>;
}
