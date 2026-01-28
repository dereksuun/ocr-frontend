import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

export default function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Sair</h1>
          <p className="help-text">Encerrando sessão...</p>
        </div>
      </div>
    </div>
  );
}
