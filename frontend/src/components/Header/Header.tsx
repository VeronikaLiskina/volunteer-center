import "./Header.scss";

export function Header() {
  return (
    <header className="header">
      <div className="header__content">
        <a className="header__brand" href="/" aria-label="Лапка — главная">
          <span className="header__logo" aria-hidden="true">
            <svg className="header__logo-icon" viewBox="0 0 32 32">
              <circle cx="9" cy="9" r="3.2" />
              <circle cx="16" cy="6.5" r="3.2" />
              <circle cx="23" cy="9" r="3.2" />
              <circle cx="26" cy="15.5" r="3" />
              <path d="M8.6 21.3c0-4.4 3.4-8.2 7.4-8.2s7.4 3.8 7.4 8.2c0 3-2.1 4.4-4.5 4.4-1.2 0-2-.5-2.9-.5s-1.7.5-2.9.5c-2.4 0-4.5-1.4-4.5-4.4Z" />
            </svg>
          </span>
          <span className="header__name">Лапка</span>
        </a>
        <span className="header__caption">АСУ волонтёрского центра</span>
      </div>
    </header>
  );
}
