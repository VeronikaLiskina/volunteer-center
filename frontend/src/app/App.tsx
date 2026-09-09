import { Header } from "../components/Header/Header";
import { HomePage } from "../pages/HomePage/HomePage";
import { AnimalsPage } from "../pages/AnimalsPage/AnimalsPage";
import { AnimalCardPage } from "../pages/AnimalCardPage/AnimalCardPage";
import { DictionariesPage } from "../pages/DictionariesPage/DictionariesPage";
import { VolunteersPage } from "../pages/VolunteersPage/VolunteersPage";
import { VolunteerCardPage } from "../pages/VolunteerCardPage/VolunteerCardPage";
import { CareProceduresPage } from "../pages/CareProceduresPage/CareProceduresPage";
import { CareProcedureCardPage } from "../pages/CareProcedureCardPage/CareProcedureCardPage";
import { ProcedureExecutionPage } from "../pages/ProcedureExecutionPage/ProcedureExecutionPage";
import { AnalyticsPage } from "../pages/AnalyticsPage/AnalyticsPage";
import { ReportsPage } from "../pages/ReportsPage/ReportsPage";
import { Link, Route, Routes } from "react-router-dom";

export function App() {
  return (
    <div className="app">
      <Header />
      <main className="app__content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/animals" element={<AnimalsPage />} />
          <Route path="/animals/new" element={<AnimalCardPage />} />
          <Route path="/animals/:animalId/edit" element={<AnimalCardPage />} />
          <Route path="/animals/dictionaries" element={<DictionariesPage />} />
          <Route path="/volunteers" element={<VolunteersPage />} />
          <Route path="/volunteers/new" element={<VolunteerCardPage />} />
          <Route path="/volunteers/:volunteerId/edit" element={<VolunteerCardPage />} />
          <Route path="/procedures" element={<CareProceduresPage />} />
          <Route path="/procedures/new" element={<CareProcedureCardPage />} />
          <Route path="/procedures/:procedureId/edit" element={<CareProcedureCardPage />} />
          <Route path="/procedures/:procedureId/execute" element={<ProcedureExecutionPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<div className="app__not-found"><h1>Страница не найдена</h1><Link to="/">На главную</Link></div>} />
        </Routes>
      </main>
    </div>
  );
}
