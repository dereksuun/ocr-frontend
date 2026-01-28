import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useUser } from "../context/userContext";
import { fetchDocument, fetchDocumentJson, getApiBaseUrl } from "../lib/api";
import type { Document } from "../lib/api";

export default function DocumentJsonPage() {
  const { id } = useParams<{ id: string }>();
  const { sector, isLoading: userLoading } = useUser();
  const isBlocked = !userLoading && !sector;
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
      setError("Documento não encontrado.");
      return;
    }
    if (isBlocked) {
      setDoc(null);
      setJsonContent(null);
      setLoading(false);
      setError("Usuário sem setor atribuído. Contate o administrador.");
      return;
    }

    let isActive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setDoc(null);
      setJsonContent(null);
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
      } catch (err) {
        if (!isActive) {
          return;
        }
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 403 || status === 404) {
            setError(
              "O período de armazenamento do documento (30 dias) se esgotou.",
            );
            return;
          }
        }
        setError("Falha ao carregar o JSON do documento.");
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
  }, [id, isBlocked]);

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>JSON extraído</h1>
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
