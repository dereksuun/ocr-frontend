import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { confirmPasswordReset } from "../lib/api";

const getPasswordFeedback = (value: string) => {
  if (value.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  if (!hasLetter || !hasNumber) {
    return "Use letras e numeros para uma senha mais forte.";
  }
  return "";
};

const isInvalidTokenError = (err: unknown) => {
  if (!axios.isAxiosError(err)) {
    return false;
  }
  const status = err.response?.status;
  const data = err.response?.data;
  if (status === 400 || status === 401) {
    if (typeof data === "string") {
      return /invalid|expirad|token/i.test(data);
    }
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const detail = record.detail;
      if (typeof detail === "string" && /invalid|expirad|token/i.test(detail)) {
        return true;
      }
      if (record.token || record.uid) {
        return true;
      }
    }
    return true;
  }
  return false;
};

const getWeakPasswordMessage = (err: unknown) => {
  if (!axios.isAxiosError(err)) {
    return null;
  }
  const data = err.response?.data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const field = record.new_password || record.password;
    if (Array.isArray(field) && field.length > 0) {
      return String(field[0]);
    }
  }
  return null;
};

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordHint = getPasswordFeedback(password);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!uid || !token) {
      setError("Link inválido ou expirado. Solicite novamente.");
      return;
    }
    if (!password || !confirmPassword) {
      setError("Preencha os dois campos de senha.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    const feedback = getPasswordFeedback(password);
    if (feedback) {
      setError(feedback);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset(uid, token, password);
      setSuccess(true);
    } catch (err) {
      if (isInvalidTokenError(err)) {
        setError("Link inválido ou expirado. Solicite novamente.");
      } else {
        const weakPassword = getWeakPasswordMessage(err);
        setError(weakPassword || "Não foi possível atualizar a senha.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="card login-card">
        <div className="page-header">
          <div>
            <h1>Redefinir senha</h1>
            <p className="help-text">Informe sua nova senha.</p>
          </div>
        </div>
        {success ? (
          <div className="settings-form">
            <p className="notice">Senha atualizada.</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate("/login", { replace: true })}
            >
              Voltar para login
            </button>
          </div>
        ) : (
          <form className="settings-form" onSubmit={handleSubmit}>
            {error ? <p className="error-hint">{error}</p> : null}
            <label className="filter-field">
              <span>Nova senha</span>
              <input
                className="input-text"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {passwordHint ? <p className="help-text">{passwordHint}</p> : null}
            <label className="filter-field">
              <span>Confirmar senha</span>
              <input
                className="input-text"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
            <div className="filters-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Atualizar senha"}
              </button>
              <Link className="btn btn-ghost" to="/login">
                Voltar
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
