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
import { useUser } from "./context/userContext";
import DocumentsPage from "./pages/DocumentsPage";
import DocumentJsonPage from "./pages/DocumentJsonPage";
import KeywordsPage from "./pages/KeywordsPage";
import LogoutPage from "./pages/LogoutPage";
import LoginPage from "./pages/LoginPage";
import PresetsPage from "./pages/PresetsPage";
import UploadPage from "./pages/UploadPage";
import AdminSectorsPage from "./pages/AdminSectorsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import ProfilePage from "./pages/ProfilePage";
import BillingPage from "./pages/BillingPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import "./App.css";
import { onAuthRequired } from "./lib/api";

const buildNavClass = ({ isActive }: { isActive: boolean }) =>
  `nav-item${isActive ? " is-active" : ""}`;

function Layout() {
  const [authRequired, setAuthRequired] = useState(false);
  const [authStatus, setAuthStatus] = useState<number | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthRequired((detail) => {
      setAuthRequired(true);
      setAuthStatus(detail.status ?? null);
    });
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (location.pathname.startsWith("/admin") || location.pathname === "/billing") {
      setConfigOpen(true);
    }
  }, [location.pathname]);
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
          <NavLink className={buildNavClass} to="/upload">
            Upload
          </NavLink>
          <NavLink className={buildNavClass} to="/documents">
            Documentos
          </NavLink>
          <NavLink className={buildNavClass} to="/profile">
            Perfil
          </NavLink>
          <NavLink className={buildNavClass} to="/billing">
            Billing
          </NavLink>
          <div className="nav-group">
            <button
              className="nav-link-button"
              type="button"
              onClick={() => setConfigOpen((prev) => !prev)}
              aria-expanded={configOpen}
            >
              <span>Configuração</span>
              <span className="nav-caret">{configOpen ? "▾" : "▸"}</span>
            </button>
            {configOpen ? (
              <div className="nav-sub">
                <NavLink className={buildNavClass} to="/extration">
                  Extração
                </NavLink>
                <NavLink className={buildNavClass} to="/presets">
                  Filtros
                </NavLink>
                {isAdmin ? (
                  <NavLink className={buildNavClass} to="/admin/sectors">
                    Setores
                  </NavLink>
                ) : null}
                {isAdmin ? (
                  <NavLink className={buildNavClass} to="/admin/users">
                    Usuários
                  </NavLink>
                ) : null}
              </div>
            ) : null}
          </div>
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
                  <h1>Não autenticado</h1>
                  <p className="help-text">
                    Sua sessão expirou ou você não tem permissão.
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
          <h1>Página não encontrada</h1>
          <p className="help-text">O endereço informado não existe.</p>
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
            <p className="help-text">Verificando autenticação...</p>
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

function AdminRoute() {
  const { isAdmin, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="card">
        <div className="page-header">
          <div>
            <h1>Carregando</h1>
            <p className="help-text">Verificando permissão de administrador...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card">
        <div className="page-header">
          <div>
            <h1>Acesso restrito</h1>
            <p className="help-text">
              Você não tem permissão para acessar esta área.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<Layout />}>
        <Route element={<ProtectedRoute />}>
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id/json" element={<DocumentJsonPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/extration" element={<KeywordsPage />} />
          <Route path="/presets" element={<PresetsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin/sectors" element={<AdminSectorsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Route>
          <Route path="/logout" element={<LogoutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
