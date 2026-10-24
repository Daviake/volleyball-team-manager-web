import { Navigate, NavLink, Route, Routes } from "react-router";
import { DEFAULT_PATH, NAV_ROUTES, ROUTES } from "./routes.js";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">
          <span aria-hidden="true">🏐</span> Sorteio de Times
        </h1>
        <nav className="app-nav" aria-label="Navegação principal">
          {NAV_ROUTES.map((route) => (
            <NavLink key={route.id} to={route.path} end>
              {route.title}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
          {ROUTES.map((route) => (
            <Route key={route.id} path={route.path} element={<PlaceholderPage title={route.title} />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
