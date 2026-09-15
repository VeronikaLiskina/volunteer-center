import { Link, NavLink } from "react-router-dom";
import { Icon } from "../Icon/Icon";
import "./Header.scss";
import { useAuth } from "../../auth/AuthContext";
import { Notifications } from "../Notifications/Notifications";
import { useState } from "react";

export function Header() {
  const { user, logout } = useAuth();
  const [error, setError] = useState("");
  return (
    <header className="header">
      <div className="header__content">
        <Link className="header__brand" to="/" aria-label="Лапка — главная">
          <span className="header__logo" aria-hidden="true">
            <svg className="header__logo-icon" viewBox="0 0 32 32">
              <circle cx="9" cy="9" r="3.2" />
              <circle cx="16" cy="6.5" r="3.2" />
              <circle cx="23" cy="9" r="3.2" />
              <circle cx="26" cy="15.5" r="3" />
              <path d="M8.6 21.3c0-4.4 3.4-8.2 7.4-8.2s7.4 3.8 7.4 8.2c0 3-2.1 4.4-4.5 4.4-1.2 0-2-.5-2.9-.5s-1.7.5-2.9.5c-2.4 0-4.5-1.4-4.5-4.4Z" />
            </svg>
          </span>
          <span className="header__brand-copy">
            <span className="header__name">АСУВЦ «Лапка»</span>
            <span className="header__tagline">С заботой о тех, кто рядом</span>
          </span>
        </Link>
        {user && <nav className="header__navigation" aria-label="Главная навигация">
          {user.role === "COORDINATOR" && <NavLink to="/" end className={({ isActive }) => `header__link${isActive ? " header__link--active" : ""}`}>Главная</NavLink>}
          {user.role === "COORDINATOR" && <NavLink to="/animals" className={({ isActive }) => `header__link${isActive ? " header__link--active" : ""}`}>Животные</NavLink>}
          <NavLink to="/procedures" className={({ isActive }) => `header__link${isActive ? " header__link--active" : ""}`}>Процедуры</NavLink>
          {user.role === "COORDINATOR" && <NavLink to="/volunteers" className={({ isActive }) => `header__link${isActive ? " header__link--active" : ""}`}>Волонтёры</NavLink>}
          {user.role === "COORDINATOR" && <NavLink to="/analytics" className={({ isActive }) => `header__link${isActive ? " header__link--active" : ""}`}>Аналитика и отчёты</NavLink>}

        </nav>}
        <div className="header__account">
          {user && <><Notifications /><span className="header__caption" title={user.full_name}><Icon name="user" /><span className="header__full-name">{user.full_name}</span></span>
            <button className="header__logout" type="button" onClick={() => { setError(""); void logout().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Не удалось выйти")); }}>Выйти</button></>}
          {error && <span role="alert">{error}</span>}
        </div>
      </div>
    </header>
  );
}
