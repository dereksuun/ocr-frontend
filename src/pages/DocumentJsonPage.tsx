import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchDocument, fetchDocumentJson, getApiBaseUrl } from "../lib/api";
import type { Document } from "../lib/api";

export default function DocumentJsonPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Document | null>(null);
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadUrl = useMemo(() => {
    if (!id) {
      return "";
    }
    const base = getApiBaseUrl();
    if (!base) {
      return `/api/documents/${id}/download-json/`;
    }
    return `${base}/api/documents/${id}/download-json/`;
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError("Documento nao encontrado.");
      return;
    }

    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [docResponse, jsonResponse] = await Promise.all([
          fetchDocument(id),
          fetchDocumentJson(id),
        ]);
        if (!isActive) {
          return;
        }
        setDoc(docResponse);
        const formatted =
          typeof jsonResponse === "string"
            ? jsonResponse
            : JSON.stringify(jsonResponse, null, 2);
        setJsonContent(formatted);
      } catch {
        if (isActive) {
          setError("Falha ao carregar o JSON do documento.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [id]);

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>JSON extraido</h1>
          <p className="help-text">
            Documento {doc?.filename || (id ?? "")}
          </p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href={downloadUrl}>
            Download JSON
          </a>
          <Link className="btn btn-ghost" to="/documents">
            Voltar
          </Link>
        </div>
      </div>
      {loading ? <p className="help-text">Carregando JSON...</p> : null}
      {error ? <p className="error-hint">{error}</p> : null}
      {!loading && !error && jsonContent ? (
        <pre className="json-block">{jsonContent}</pre>
      ) : null}
    </div>
  );
}
