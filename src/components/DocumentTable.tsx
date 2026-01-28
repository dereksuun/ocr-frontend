import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { Document } from "../lib/api";
import { getApiBaseUrl } from "../lib/api";

type DocumentTableProps = {
  documents: Document[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onReprocess: (id: string) => void;
  onBulkReprocess: () => void;
  onBulkDownloadJson: () => void;
  onBulkDownloadFiles: () => void;
  isDownloadingJson?: boolean;
  isDownloadingFiles?: boolean;
  isLoading?: boolean;
};

const formatDate = (value: string) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("pt-BR");
};

const formatTime = (value: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const formatDateTime = (value: string) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const formattedDate = date.toLocaleDateString("pt-BR");
  const formattedTime = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formattedDate} ${formattedTime}`;
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  DONE: "Processado",
  FAILED: "Falhou",
};

export default function DocumentTable({
  documents,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onReprocess,
  onBulkReprocess,
  onBulkDownloadJson,
  onBulkDownloadFiles,
  isDownloadingJson,
  isDownloadingFiles,
  isLoading,
}: DocumentTableProps) {
  const apiBaseUrl = getApiBaseUrl();
  const tableRef = useRef<HTMLTableElement | null>(null);
  const allSelected =
    documents.length > 0 && documents.every((doc) => selectedIds.has(doc.id));
  const bulkDisabled = selectedIds.size === 0 || isLoading;
  const jsonDisabled = bulkDisabled || isDownloadingJson;
  const filesDisabled = bulkDisabled || isDownloadingFiles;

  const buildDownloadUrl = (id: string, type: "json" | "file") => {
    if (!apiBaseUrl) {
      return `/api/documents/${id}/download-${type}/`;
    }
    return `${apiBaseUrl}/api/documents/${id}/download-${type}/`;
  };

  useEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    const headerRow = table.querySelector("thead tr");
    if (!headerRow) {
      return;
    }

    const headers = Array.from(headerRow.children) as HTMLTableCellElement[];
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      headers.forEach(() => colgroup?.appendChild(document.createElement("col")));
      table.insertBefore(colgroup, table.querySelector("thead"));
    }

    const cols = Array.from(colgroup.children) as HTMLTableColElement[];
    if (cols.length !== headers.length) {
      colgroup.innerHTML = "";
      headers.forEach(() => colgroup?.appendChild(document.createElement("col")));
    }

    const getMinWidth = (th: HTMLTableCellElement) => {
      const raw = th.getAttribute("data-min-width");
      const parsed = Number.parseInt(raw || "", 10);
      if (Number.isNaN(parsed)) {
        return 60;
      }
      return Math.max(parsed, 40);
    };

    const listeners: Array<{
      handle: HTMLElement;
      onMouseDown: (event: MouseEvent) => void;
    }> = [];

    headers.forEach((th, index) => {
      const col = (colgroup?.children[index] as HTMLTableColElement) || null;
      if (!col) {
        return;
      }
      const width = Math.max(
        getMinWidth(th),
        Math.round(th.getBoundingClientRect().width),
      );
      col.style.width = `${width}px`;

      let handle = th.querySelector(".col-resizer") as HTMLElement | null;
      if (!handle) {
        handle = document.createElement("span");
        handle.className = "col-resizer";
        th.appendChild(handle);
      }

      const onMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        const startX = event.pageX;
        const startWidth = col.getBoundingClientRect().width;
        const minWidth = getMinWidth(th);

        const onMouseMove = (moveEvent: MouseEvent) => {
          const delta = moveEvent.pageX - startX;
          const nextWidth = Math.max(minWidth, startWidth + delta);
          col.style.width = `${nextWidth}px`;
        };

        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      };

      handle.addEventListener("mousedown", onMouseDown);
      listeners.push({ handle, onMouseDown });
    });

    return () => {
      listeners.forEach(({ handle, onMouseDown }) => {
        handle.removeEventListener("mousedown", onMouseDown);
      });
    };
  }, []);

  return (
    <>
      <div className="bulk-actions">
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={onBulkReprocess}
          disabled={bulkDisabled}
        >
          Reprocessar selecionados
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={onBulkDownloadJson}
          disabled={jsonDisabled}
        >
          {isDownloadingJson ? "Baixando JSON..." : "Download JSON selecionados"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={onBulkDownloadFiles}
          disabled={filesDisabled}
        >
          {isDownloadingFiles
            ? "Baixando PDFs..."
            : "Download PDFs selecionados"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={onToggleSelectAll}
          disabled={documents.length === 0 || isLoading}
        >
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </button>
        {selectedIds.size > 0 ? (
          <span className="results-meta">
            {selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <div className="table-card">
        <table ref={tableRef} className="table table-resizable">
          <colgroup>
            <col className="col-select" />
            <col className="col-name" />
            <col className="col-date" />
            <col className="col-info" />
            <col className="col-contact" />
            <col className="col-status" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-select" data-min-width="40">
                Sel
              </th>
              <th data-min-width="160">Nome do documento</th>
              <th data-min-width="120">Data cadastro</th>
              <th data-min-width="220">Trecho</th>
              <th data-min-width="150">Contato</th>
              <th data-min-width="110">Status</th>
              <th data-min-width="170">Ações</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  {isLoading ? "Carregando..." : "Nenhum documento enviado ainda."}
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const statusValue = doc.status || "PENDING";
                const statusLabel = String(statusValue).toLowerCase();
                const statusText = statusLabels[statusValue] || String(statusValue);
                const canReprocess = statusValue === "DONE";
                const canDownloadJson = statusValue === "DONE";
                const rawSnippets = doc.match_snippets || [];
                const fallbackSnippet = doc.search_snippet || "";
                const snippets =
                  rawSnippets.length > 0 ? rawSnippets : fallbackSnippet ? [fallbackSnippet] : [];
                const failedAt =
                  statusValue === "FAILED" ? formatDateTime(doc.updated_at) : "";
                return (
                  <tr key={doc.id}>
                    <td className="col-select">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => onToggleSelect(doc.id)}
                        aria-label={`Selecionar documento ${doc.id}`}
                      />
                    </td>
                    <td className="doc-info">
                      <div className="doc-name">{doc.filename || "Arquivo"}</div>
                    </td>
                    <td>
                      <div className="date-stack">
                        <span>{formatDate(doc.created_at)}</span>
                        <span className="time">{formatTime(doc.created_at)}</span>
                      </div>
                    </td>
                    <td>
                      {snippets.length > 0 ? (
                        <div className="snippets">
                          {snippets.slice(0, 3).map((snippet, idx) => (
                            <div key={`${doc.id}-snippet-${idx}`} className="snippet">
                              {snippet}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="info-empty">—</span>
                      )}
                    </td>
                    <td>
                      {doc.contact_phone ? (
                        <a
                          href={`https://web.whatsapp.com/send?phone=${doc.contact_phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {doc.contact_phone}
                        </a>
                      ) : (
                        <span className="info-empty">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${statusLabel}`}>
                        {statusText}
                      </span>
                      {statusValue === "FAILED" && doc.error_message ? (
                        <span className="error-hint" title={doc.error_message}>
                          Erro
                        </span>
                      ) : null}
                      {failedAt ? (
                        <div className="status-meta">Falhou: {failedAt}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="actions">
                        {canReprocess ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={() => onReprocess(doc.id)}
                            disabled={isLoading}
                          >
                            Reprocessar
                          </button>
                        ) : null}
                        <details className="drop">
                          <summary className="btn btn-ghost btn-sm">⋯</summary>
                          <div className="drop-menu">
                            {canDownloadJson ? (
                              <Link to={`/documents/${doc.id}/json`}>Ver JSON</Link>
                            ) : (
                              <span className="drop-item is-disabled">Ver JSON</span>
                            )}
                            {canDownloadJson ? (
                              <a
                                href={buildDownloadUrl(doc.id, "json")}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Download JSON
                              </a>
                            ) : (
                              <span className="drop-item is-disabled">
                                Download JSON
                              </span>
                            )}
                            <a
                              href={buildDownloadUrl(doc.id, "file")}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Download arquivo
                            </a>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
