import { Link } from "react-router-dom";
import { Icon, type IconName } from "../Icon/Icon";
import "./QuickActions.scss";

const actions: { title: string; description: string; to: string; icon: IconName; tone: string }[] = [
  { title: "Добавить животное", description: "Открыть форму регистрации нового животного", to: "/animals/new", icon: "paw", tone: "blue" },
  { title: "Назначить процедуру", description: "Добавить задачу в план ухода", to: "/procedures/new", icon: "calendar", tone: "green" },
  { title: "Добавить волонтёра", description: "Пополнить команду помощи", to: "/volunteers/new", icon: "user", tone: "violet" },
  { title: "Справочники", description: "Посмотреть типы животных, породы и другие справочники", to: "/animals/dictionaries", icon: "book", tone: "neutral" },
];

export function QuickActions() {
  return <section className="quick-actions" aria-labelledby="quick-actions-title">
    <div className="quick-actions__heading">
      <h2 className="quick-actions__title" id="quick-actions-title">Быстрые действия</h2>
      <p className="quick-actions__subtitle">Выберите, с чего хотите начать</p>
    </div>
    <div className="quick-actions__grid">
      {actions.map((action) => <Link className={`quick-action quick-action--${action.tone}`} to={action.to} key={action.to}>
        <span className="quick-action__icon"><Icon name={action.icon} /></span>
        <span className="quick-action__body">
          <strong className="quick-action__title">{action.title}</strong>
          <span className="quick-action__description">{action.description}</span>
        </span>
        <span className="quick-action__arrow" aria-hidden="true"><Icon name="arrow" /></span>
      </Link>)}
    </div>
  </section>;
}
