import type { CSSProperties } from "react";
import heroImage from "../../assets/home-hero-cat.png";
import type { AnimalSummary } from "../../types/animal";
import type { CareProcedureSummary } from "../../types/careProcedure";
import type { VolunteerSummary } from "../../types/volunteer";
import { HomeStats, type SummaryResource } from "../HomeStats/HomeStats";
import "./HomeHero.scss";

interface HomeHeroProps {
  animals: SummaryResource<AnimalSummary>;
  procedures: SummaryResource<CareProcedureSummary>;
  volunteers: SummaryResource<VolunteerSummary>;
  onRetry: () => void;
}

export function HomeHero({ animals, procedures, volunteers, onRetry }: HomeHeroProps) {
  const imageStyle = { "--home-hero-image": `url(${heroImage})` } as CSSProperties;

  return <section className="home-hero" style={imageStyle} aria-labelledby="home-hero-title">
    <div className="home-hero__content">
      <h1 className="home-hero__title" id="home-hero-title">Забота сегодня.<br />Лучшее завтра.</h1>
      <p className="home-hero__description">Учёт животных, планирование ухода<br className="home-hero__desktop-break" /> и работа команды — в одном месте.</p>
      <span className="home-hero__accent" aria-hidden="true" />
      <p className="home-hero__thanks">Спасибо, что<br />делаете этот мир добрее! <span aria-hidden="true">♡</span></p>
    </div>
    <HomeStats animals={animals} procedures={procedures} volunteers={volunteers} onRetry={onRetry} />
  </section>;
}
