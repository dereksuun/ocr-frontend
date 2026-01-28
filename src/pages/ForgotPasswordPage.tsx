import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../lib/api";

const genericMessage =
  "Se existir uma conta com esse e-mail, enviamos um link para redefinir sua senha.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Informe seu e-mail.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await requestPasswordReset(trimmed);
    } catch {
      // Intencional: nao revelar existencia de conta.
    } finally {
      setSubmitting(false);
      setMessage(genericMessage);
    }
  };

  return (
    <div className="login-shell">
      <div className="card login-card">
        <div className="page-header">
          <div>
            <h1>Esqueci minha senha</h1>
            <p className="help-text">
              Informe seu e-mail para receber o link de redefinição.
            </p>
          </div>
        </div>
        {error ? <p className="error-hint">{error}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        <form className="settings-form" onSubmit={handleSubmit}>
          <label className="filter-field">
            <span>E-mail</span>
            <input
              className="input-text"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <div className="filters-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar link"}
            </button>
            <Link className="btn btn-ghost" to="/login">
              Voltar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
