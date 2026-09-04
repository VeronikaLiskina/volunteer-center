import { Header } from "../components/Header/Header";
import { HomePage } from "../pages/HomePage/HomePage";

export function App() {
  return (
    <div className="app">
      <Header />
      <main className="app__content">
        <HomePage />
      </main>
    </div>
  );
}

