import { Link } from "react-router-dom";

export default function DocumentExpiredPage() {
  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Documento indisponível</h1>
          <p className="help-text">
            O período de armazenamento do documento (30 dias) se esgotou e o
            arquivo foi excluído.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/documents">
          Voltar
        </Link>
      </div>
      <div className="notice">
        Se precisar do arquivo, solicite um novo envio.
      </div>
    </div>
  );
}
