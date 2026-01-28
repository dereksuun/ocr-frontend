import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import { Link } from "react-router-dom";
import { useUser } from "../context/userContext";
import type { DocumentStatus } from "../lib/api";
import {
  fetchDocument,
  fetchExtractionSettings,
  uploadDocument,
} from "../lib/api";

type UploadStatus = "READY" | "UPLOADING" | "UPLOAD_FAILED" | DocumentStatus;

type UploadItem = {
  localId: string;
  file: File;
  status: UploadStatus;
  documentId?: string;
  error?: string;
};

const formatSize = (bytes: number) => {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(0)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
};

const statusLabel = (status: UploadStatus) => {
  if (status === "READY") {
    return "Pronto para enviar";
  }
  if (status === "UPLOADING") {
    return "Enviando";
  }
  if (status === "UPLOAD_FAILED") {
    return "Falha no envio";
  }
  if (status === "PENDING") {
    return "Pendente";
  }
  if (status === "PROCESSING") {
    return "Processando";
  }
  if (status === "DONE") {
    return "Processado";
  }
  if (status === "FAILED") {
    return "Falhou";
  }
  return status;
};

const nextLocalId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function UploadPage() {
  const { sector, isLoading: userLoading } = useUser();
  const isBlocked = !userLoading && !sector;
  const handleOpenFile = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [enabledFields, setEnabledFields] = useState<string[] | null>(null);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const loadEnabledFields = useCallback(async () => {
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const response = await fetchExtractionSettings();
      setEnabledFields(response.enabled_fields || []);
    } catch {
      setEnabledFields(null);
      setFieldsError("Falha ao carregar campos habilitados.");
    } finally {
      setFieldsLoading(false);
    }
  }, []);

  const pendingIds = useMemo(
    () =>
      uploads
        .filter(
          (item) =>
            item.documentId &&
            (item.status === "PENDING" || item.status === "PROCESSING"),
        )
        .map((item) => item.documentId as string),
    [uploads],
  );

  useEffect(() => {
    if (pendingIds.length === 0) {
      return;
    }

    let isActive = true;
    const poll = async () => {
      try {
        const updates = await Promise.all(
          pendingIds.map((id) => fetchDocument(id)),
        );
        if (!isActive) {
          return;
        }
        setUploads((prev) =>
          prev.map((item) => {
            const update = updates.find((doc) => doc.id === item.documentId);
            if (!update) {
              return item;
            }
            return {
              ...item,
              status: update.status,
              error: update.error_message || item.error,
            };
          }),
        );
      } catch {
        if (isActive) {
          setError("Falha ao atualizar status dos uploads.");
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 3000);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [pendingIds]);

  useEffect(() => {
    if (isBlocked) {
      return;
    }
    loadEnabledFields();
  }, [loadEnabledFields, isBlocked]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const nextUploads = files.map((file) => ({
      localId: nextLocalId(),
      file,
      status: "READY" as UploadStatus,
    }));
    setUploads(nextUploads);
  };

  const handleUpload = async () => {
    if (uploads.length === 0) {
      return;
    }
    if (isBlocked) {
      setError("Usuário sem setor atribuído.");
      return;
    }
    if (enabledFields === null) {
      setError("Campos habilitados não carregados.");
      return;
    }
    setIsUploading(true);
    setError(null);

    for (const item of uploads) {
      if (item.status !== "READY") {
        continue;
      }
      setUploads((prev) =>
        prev.map((entry) =>
          entry.localId === item.localId
            ? { ...entry, status: "UPLOADING", error: undefined }
            : entry,
        ),
      );
      try {
        const response = await uploadDocument(item.file, enabledFields);
        setUploads((prev) =>
          prev.map((entry) =>
            entry.localId === item.localId
              ? {
                  ...entry,
                  status: response.status,
                  documentId: response.id,
                }
              : entry,
          ),
        );
      } catch {
        setUploads((prev) =>
          prev.map((entry) =>
            entry.localId === item.localId
              ? {
                  ...entry,
                  status: "UPLOAD_FAILED",
                  error: "Falha ao enviar o arquivo.",
                }
              : entry,
          ),
        );
      }
    }

    setIsUploading(false);
  };

  const handleClear = () => {
    setUploads([]);
    setError(null);
  };

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Enviar documentos</h1>
          <p className="help-text">
            Envie arquivos PDF e acompanhe o processamento em tempo real.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/documents">
          Voltar
        </Link>
      </div>
      {isBlocked ? (
        <div className="notice">
          Usuário sem setor atribuído. Contate o administrador. Upload
          desabilitado.
        </div>
      ) : null}
      {error ? <p className="error-hint">{error}</p> : null}
      {fieldsLoading ? (
        <p className="help-text">Carregando campos habilitados...</p>
      ) : null}
      {fieldsError ? <p className="error-hint">{fieldsError}</p> : null}
      {fieldsError ? (
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={loadEnabledFields}
          disabled={fieldsLoading || isBlocked}
        >
          Recarregar campos
        </button>
      ) : null}
      {enabledFields !== null && !fieldsLoading && !fieldsError ? (
        <p className="help-text">
          Campos habilitados: {enabledFields.length}
        </p>
      ) : null}
      <div className="upload-grid">
        <label className="input-file" htmlFor="upload-files">
          Selecione arquivos PDF
          <input
            id="upload-files"
            type="file"
            multiple
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={isBlocked}
          />
        </label>
        <div className="upload-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleUpload}
            disabled={
              uploads.length === 0 || isUploading || enabledFields === null || isBlocked
            }
          >
            Enviar
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={handleClear}
            disabled={uploads.length === 0 || isUploading || isBlocked}
          >
            Limpar lista
          </button>
        </div>
      </div>
      {uploads.length > 0 ? (
        <div className="file-previews">
          {uploads.map((item) => (
            <div className="file-card" key={item.localId}>
              <div className="file-thumb">
                <div className="file-badge">PDF</div>
                <button
                  className="file-open"
                  type="button"
                  onClick={() => handleOpenFile(item.file)}
                >
                  Abrir
                </button>
              </div>
              <div className="file-name">{item.file.name}</div>
              <div className="file-meta">
                {item.file.type || "arquivo"} - {formatSize(item.file.size)}
              </div>
              <div className="upload-meta">
                <span className="upload-status">{statusLabel(item.status)}</span>
                {item.error ? (
                  <span className="error-hint">{item.error}</span>
                ) : null}
                {item.documentId ? (
                  <span className="info-empty">ID: {item.documentId}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="help-text">Nenhum arquivo selecionado.</p>
      )}
    </div>
  );
}
