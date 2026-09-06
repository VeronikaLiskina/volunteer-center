import { Link, NavLink } from "react-router-dom";
import { Icon } from "../Icon/Icon";
import "./Header.scss";

export function Header() {
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
          <span className="header__name">АСУВЦ «Лапка»</span>
        </Link>
        <nav className="header__navigation" aria-label="Главная навигация">
          <NavLink to="/" end className={({ isActive }) => `header__link${isActive ? " header__link--active" : ""}`}>Главная</NavLink>
          <NavLink to="/animals" className={({ isActive }) => `header__link${isActive ? " header__link--active" : ""}`}>Животные</NavLink>
        </nav>
        <div className="header__account">
          <button className="header__notification" type="button" disabled aria-label="Уведомления пока недоступны" title="Уведомления пока недоступны"><Icon name="bell" /></button>
          <span className="header__caption"><Icon name="user" />Гостевой режим</span>
        </div>
      </div>
    </header>
  );
}
