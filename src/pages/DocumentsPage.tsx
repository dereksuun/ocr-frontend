import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DocumentTable from "../components/DocumentTable";
import FiltersBar from "../components/FiltersBar";
import { useUser } from "../context/userContext";
import type { Document, DocumentFilters, Preset } from "../lib/api";
import {
  bulkDownloadFiles,
  bulkDownloadJson,
  bulkReprocessDocuments,
  fetchDocument,
  fetchDocuments,
  fetchPresets,
  reprocessDocument,
} from "../lib/api";

const initialFilters: DocumentFilters = {
  presetId: "",
  query: "",
  exclude: "",
  mode: "all",
  excludeUnknowns: undefined,
  ageMin: "",
  ageMax: "",
  expMin: "",
};

export default function DocumentsPage() {
  const { sector, isLoading: userLoading } = useUser();
  const isBlocked = !userLoading && !sector;
  const log = useCallback((...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info(...args);
    }
  }, []);
  const [filters, setFilters] = useState<DocumentFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<DocumentFilters>(initialFilters);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [processingCount, setProcessingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [downloadingJson, setDownloadingJson] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPresets = useCallback(async () => {
    if (isBlocked) {
      setPresetsLoading(false);
      return;
    }
    setPresetsLoading(true);
    try {
      const result = await fetchPresets();
      setPresets(result.items);
    } catch {
      setError("Falha ao carregar presets.");
    } finally {
      setPresetsLoading(false);
    }
  }, [isBlocked]);

  useEffect(() => {
    log("[DocumentsPage] entrou");
    loadPresets();
  }, [loadPresets, log]);

  useEffect(() => {
    if (isBlocked) {
      setDocuments([]);
      setTotalCount(0);
      setHasNextPage(false);
      setHasPreviousPage(false);
      setSelectedIds(new Set());
      setLoading(false);
      return;
    }
    const loadDocuments = async () => {
      setLoading(true);
      setError(null);
      log("[DocumentsPage] request started", appliedFilters);
      try {
        const result = await fetchDocuments({
          ...appliedFilters,
          page,
          pageSize,
        });
        log("[DocumentsPage] response status", result.status);
        log("[DocumentsPage] documents length", result.items.length);
        setDocuments(result.items);
        setTotalCount(result.count);
        setHasNextPage(Boolean(result.next));
        setHasPreviousPage(Boolean(result.previous));
        setSelectedIds((prev) => {
          if (prev.size === 0) {
            return prev;
          }
          const next = new Set<string>();
          result.items.forEach((doc) => {
            if (prev.has(doc.id)) {
              next.add(doc.id);
            }
          });
          return next;
        });
      } catch {
        setError("Falha ao carregar documentos.");
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [appliedFilters, page, pageSize, log, isBlocked]);

  useEffect(() => {
    if (isBlocked) {
      setProcessingCount(null);
      return;
    }
    const filtersActive = Boolean(
      appliedFilters.query ||
        appliedFilters.exclude ||
        appliedFilters.presetId ||
        appliedFilters.expMin ||
        appliedFilters.ageMin ||
        appliedFilters.ageMax ||
        (appliedFilters.mode || "all") === "any",
    );
    if (!filtersActive) {
      setProcessingCount(null);
      return;
    }

    let isActive = true;
    const loadProcessingCount = async () => {
      try {
        const result = await fetchDocuments({
          status: "processing",
          page: 1,
          pageSize: 1,
        });
        if (isActive) {
          setProcessingCount(result.count);
        }
      } catch {
        if (isActive) {
          setProcessingCount(null);
        }
      }
    };

    loadProcessingCount();
    return () => {
      isActive = false;
    };
  }, [appliedFilters, isBlocked]);

  const pollingIds = useMemo(
    () =>
      documents
        .filter((doc) => doc.status === "PENDING" || doc.status === "PROCESSING")
        .map((doc) => doc.id),
    [documents],
  );

  useEffect(() => {
    if (isBlocked) {
      return;
    }
    if (pollingIds.length === 0) {
      return;
    }

    let isActive = true;
    const poll = async () => {
      try {
        const updates = await Promise.all(
          pollingIds.map((id) => fetchDocument(id)),
        );
        if (!isActive) {
          return;
        }
        const map = new Map(updates.map((doc) => [doc.id, doc]));
        setDocuments((prev) => prev.map((doc) => map.get(doc.id) ?? doc));
      } catch {
        if (isActive) {
          setError("Falha ao atualizar status dos documentos.");
        }
      }
    };

    poll();
    const interval = window.setInterval(poll, 3000);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [pollingIds, isBlocked]);

  if (isBlocked) {
    return (
      <div className="card">
        <div className="page-header">
          <div>
            <h1>Documentos</h1>
            <p className="help-text">
              Usuário sem setor atribuído. Contate o administrador.
            </p>
          </div>
        </div>
        <div className="notice">
          Upload e listagem de documentos estão desabilitados até a definição do
          setor.
        </div>
      </div>
    );
  }

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setSelectedIds(new Set());
    setPage(1);
  };

  const handleRetry = () => {
    loadPresets();
    setAppliedFilters((prev) => ({ ...prev }));
  };

  const handleNextPage = () => {
    if (!(hasNextPage || page < totalPages)) {
      return;
    }
    setPage((prev) => prev + 1);
  };

  const handlePreviousPage = () => {
    if (!(hasPreviousPage || page > 1)) {
      return;
    }
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const canGoNext = hasNextPage || page < totalPages;
  const canGoPrevious = hasPreviousPage || page > 1;
  const resultCount = totalCount || documents.length;
  const filtersActive = Boolean(
    appliedFilters.query ||
      appliedFilters.exclude ||
      appliedFilters.presetId ||
      appliedFilters.expMin ||
      appliedFilters.ageMin ||
      appliedFilters.ageMax ||
      (appliedFilters.mode || "all") === "any",
  );
  const processingNotice =
    filtersActive && processingCount
      ? "Documentos em processamento não entram nos filtros."
      : null;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allIds = documents.map((doc) => doc.id);
      const allSelected =
        allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleReprocess = async (id: string) => {
    setError(null);
    try {
      const response = await reprocessDocument(id);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, status: response.status } : doc,
        ),
      );
    } catch {
      setError("Falha ao reprocessar documento.");
    }
  };

  const handleBulkReprocess = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    setError(null);
    try {
      await bulkReprocessDocuments(Array.from(selectedIds));
      setDocuments((prev) =>
        prev.map((doc) =>
          selectedIds.has(doc.id)
            ? { ...doc, status: "PROCESSING" }
            : doc,
        ),
      );
    } catch {
      setError("Falha ao reprocessar documentos.");
    }
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkDownloadJson = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    setDownloadingJson(true);
    setError(null);
    try {
      const blob = await bulkDownloadJson(Array.from(selectedIds));
      triggerDownload(blob, "documentos-json.zip");
    } catch {
      setError("Falha ao baixar JSON em lote.");
    } finally {
      setDownloadingJson(false);
    }
  };

  const handleBulkDownloadFiles = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    setDownloadingFiles(true);
    setError(null);
    try {
      const blob = await bulkDownloadFiles(Array.from(selectedIds));
      triggerDownload(blob, "documentos-arquivos.zip");
    } catch {
      setError("Falha ao baixar arquivos em lote.");
    } finally {
      setDownloadingFiles(false);
    }
  };

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Documentos</h1>
          <p className="help-text">
            Liste documentos, aplique filtros e acompanhe o processamento.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/upload">
          Upload
        </Link>
      </div>
      {error ? <p className="error-hint">{error}</p> : null}
      {error ? (
        <div className="filters-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={handleRetry}>
            Tentar novamente
          </button>
        </div>
      ) : null}
      <FiltersBar
        presets={presets}
        filters={filters}
        isLoading={loading || presetsLoading}
        resultCount={resultCount}
        processingNotice={processingNotice}
        onFiltersChange={setFilters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />
      <DocumentTable
        documents={documents}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onReprocess={handleReprocess}
        onBulkReprocess={handleBulkReprocess}
        onBulkDownloadJson={handleBulkDownloadJson}
        onBulkDownloadFiles={handleBulkDownloadFiles}
        isDownloadingJson={downloadingJson}
        isDownloadingFiles={downloadingFiles}
        isLoading={loading}
      />
      <div className="pagination">
        <span className="results-meta">
          Página {page} de {totalPages}
        </span>
        <label className="filter-field">
          <span>Itens por página</span>
          <select
            className="input-select"
            value={pageSize}
            onChange={(event) =>
              handlePageSizeChange(Number(event.target.value))
            }
            disabled={loading}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={handlePreviousPage}
          disabled={loading || !canGoPrevious}
        >
          Anterior
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={handleNextPage}
          disabled={loading || !canGoNext}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
