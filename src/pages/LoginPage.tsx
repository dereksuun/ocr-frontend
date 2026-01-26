import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

type LocationState = {
  from?: string;
};

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const redirectTo = state?.from || "/documents";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Credenciais invalidas. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="card login-card">
        <div className="page-header">
          <div>
            <h1>Entrar</h1>
            <p className="help-text">Acesse o tratamento de documentos.</p>
          </div>
        </div>
        {isLoading ? (
          <p className="help-text">Verificando sessao...</p>
        ) : null}
        {error ? <p className="error-hint">{error}</p> : null}
        <form className="settings-form" onSubmit={handleSubmit}>
          <label className="filter-field">
            <span>Usuario</span>
            <input
              className="input-text"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="filter-field">
            <span>Senha</span>
            <input
              className="input-text"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <div className="filters-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
