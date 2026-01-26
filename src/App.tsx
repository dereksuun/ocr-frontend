import { useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "./context/authContext";
import DocumentsPage from "./pages/DocumentsPage";
import DocumentJsonPage from "./pages/DocumentJsonPage";
import KeywordsPage from "./pages/KeywordsPage";
import LogoutPage from "./pages/LogoutPage";
import LoginPage from "./pages/LoginPage";
import PresetsPage from "./pages/PresetsPage";
import UploadPage from "./pages/UploadPage";
import "./App.css";
import { onAuthRequired } from "./lib/api";

const buildNavClass = ({ isActive }: { isActive: boolean }) =>
  `nav-item${isActive ? " is-active" : ""}`;

function Layout() {
  const [authRequired, setAuthRequired] = useState(false);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthRequired((detail) => {
      setAuthRequired(true);
      setAuthStatus(detail.status ?? null);
    });
    return unsubscribe;
  }, []);
  const showAuthRequired =
    authRequired && !isAuthenticated && location.pathname !== "/login";

  const handleLogin = () => {
    navigate("/login", {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTjfKZW8TWXI0AghHartslJblfdt9K77bNogQ&s"
              alt="Logo"
              width="48"
              height="48"
            />
          </span>
          <span>TRATAMENTO DE DOCUMENTOS</span>
        </div>
        <nav className="nav-links">
          <NavLink className={buildNavClass} to="/documents">
            Documentos
          </NavLink>
          <NavLink className={buildNavClass} to="/upload">
            Upload
          </NavLink>
          <NavLink className={buildNavClass} to="/keywords">
            Palavras-Chave
          </NavLink>
          <NavLink className={buildNavClass} to="/presets">
            Filtros
          </NavLink>
          <NavLink className={buildNavClass} to="/logout">
            Sair
          </NavLink>
        </nav>
      </aside>
      <main className="app-main">
        <div className="container">
          {showAuthRequired ? (
            <div className="card auth-banner">
              <div className="page-header">
                <div>
                  <h1>Nao autenticado</h1>
                  <p className="help-text">
                    Sua sessao expirou ou voce nao tem permissao.
                    {authStatus ? ` (status ${authStatus})` : ""}
                  </p>
                </div>
              </div>
              <div className="filters-actions">
                <button className="btn btn-primary" type="button" onClick={handleLogin}>
                  Ir para login
                </button>
              </div>
            </div>
          ) : null}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Pagina nao encontrada</h1>
          <p className="help-text">O endereco informado nao existe.</p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="card">
        <div className="page-header">
          <div>
            <h1>Carregando</h1>
            <p className="help-text">Verificando autenticacao...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id/json" element={<DocumentJsonPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/keywords" element={<KeywordsPage />} />
          <Route path="/presets" element={<PresetsPage />} />
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
