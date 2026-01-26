import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import type { ExtractionField, ExtractionKeyword } from "../lib/api";
import {
  createKeyword,
  deleteKeyword,
  fetchExtractionSettings,
  updateExtractionSettings,
} from "../lib/api";

type FilterMode = "all" | "active" | "inactive";

type SettingsItem = {
  key: string;
  label: string;
  isActive: boolean;
  kind: "field" | "keyword";
};

const VALUE_TYPE_OPTIONS = [
  "text",
  "money",
  "date",
  "cpf",
  "cnpj",
  "id",
  "barcode",
  "address",
  "block",
];

const normalizeText = (value: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function KeywordsPage() {
  const [availableFields, setAvailableFields] = useState<ExtractionField[]>([]);
  const [keywords, setKeywords] = useState<ExtractionKeyword[]>([]);
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [newKeyword, setNewKeyword] = useState("");
  const [newValueType, setNewValueType] = useState("text");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchExtractionSettings();
      setAvailableFields(response.available_fields || []);
      setKeywords(response.keywords || []);
      setEnabledFields(new Set(response.enabled_fields || []));
    } catch {
      setError("Falha ao carregar configuracoes de extracao.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const items = useMemo<SettingsItem[]>(() => {
    const fieldItems = availableFields.map((field) => ({
      key: field.key,
      label: field.label,
      isActive: enabledFields.has(field.key),
      kind: "field" as const,
    }));
    const keywordItems = keywords.map((keyword) => ({
      key: keyword.keyword_key,
      label: keyword.label,
      isActive: enabledFields.has(keyword.keyword_key),
      kind: "keyword" as const,
    }));
    return [...fieldItems, ...keywordItems];
  }, [availableFields, keywords, enabledFields]);

  const filteredItems = useMemo(() => {
    const query = normalizeText(searchTerm);
    return items.filter((item) => {
      const matchesQuery = !query || normalizeText(item.label).includes(query);
      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "active" ? item.isActive : !item.isActive);
      return matchesQuery && matchesFilter;
    });
  }, [items, searchTerm, filterMode]);

  const handleToggle = (key: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await updateExtractionSettings(Array.from(enabledFields));
      setAvailableFields(response.available_fields || []);
      setKeywords(response.keywords || []);
      setEnabledFields(new Set(response.enabled_fields || []));
    } catch {
      setError("Falha ao salvar configuracoes.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddKeyword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newKeyword.trim();
    if (!trimmed) {
      setError("Informe uma palavra-chave.");
      return;
    }
    const ok = window.confirm(`Voce digitou: "${trimmed}". Confirmar?`);
    if (!ok) {
      return;
    }
    setAdding(true);
    setError(null);
    setAdminError(null);
    try {
      await createKeyword({ label: trimmed, value_type: newValueType });
      setNewKeyword("");
      setNewValueType("text");
      await loadSettings();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setAdminError("Apenas administradores podem adicionar palavras-chave.");
      } else {
        setError("Falha ao adicionar palavra-chave.");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteKeyword = async (keyword: ExtractionKeyword) => {
    const ok = window.confirm(`Remover a palavra-chave "${keyword.label}"?`);
    if (!ok) {
      return;
    }
    setDeletingId(keyword.id);
    setError(null);
    setAdminError(null);
    try {
      await deleteKeyword(keyword.id);
      await loadSettings();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setAdminError("Apenas administradores podem remover palavras-chave.");
      } else {
        setError("Falha ao remover palavra-chave.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Configuracoes de extracao</h1>
          <p className="help-text">
            Selecione os campos e palavras-chave que devem ser extraidos em novos
            uploads.
          </p>
          <p className="help-text">
            Nenhuma opcao e obrigatoria; voce pode desmarcar tudo.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/documents">
          Voltar
        </Link>
      </div>

      {error ? <p className="error-hint">{error}</p> : null}
      {adminError ? <p className="error-hint">{adminError}</p> : null}
      {loading ? <p className="help-text">Carregando configuracoes...</p> : null}

      <div className="settings-form">
        <div className="settings-toolbar">
          <div className="search-field">
            <label htmlFor="keyword-search">Buscar</label>
            <input
              id="keyword-search"
              className="input-text"
              type="search"
              placeholder="Buscar campo ou palavra"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="filter-field">
            <label htmlFor="keyword-filter">Filtro</label>
            <select
              id="keyword-filter"
              className="input-select"
              value={filterMode}
              onChange={(event) =>
                setFilterMode(event.target.value as FilterMode)
              }
            >
              <option value="all">Todas</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
          </div>
        </div>

        <div className="settings-grid">
          {filteredItems.map((item) => (
            <label className="check-item" key={`${item.kind}-${item.key}`}>
              <input
                type="checkbox"
                checked={item.isActive}
                onChange={() => handleToggle(item.key)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <form className="keyword-add" onSubmit={handleAddKeyword}>
          <label htmlFor="new-keyword">Adicionar palavra-chave</label>
          <div className="keyword-add-row">
            <div className="keyword-input">
              <input
                id="new-keyword"
                className="input-text"
                type="text"
                value={newKeyword}
                onChange={(event) => setNewKeyword(event.target.value)}
                placeholder="Nova palavra-chave"
                list="field-suggestions"
                disabled={adding}
              />
            </div>
            <div className="keyword-type">
              <select
                className="input-select"
                value={newValueType}
                onChange={(event) => setNewValueType(event.target.value)}
                disabled={adding}
              >
                {VALUE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <datalist id="field-suggestions">
              {availableFields.map((field) => (
                <option key={field.key} value={field.label} />
              ))}
            </datalist>
            <button className="btn btn-secondary" type="submit" disabled={adding}>
              {adding ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
          <p className="help-text">
            Pode ser qualquer palavra; se existir um extrator, ele sera usado.
          </p>
        </form>

        <div className="filters-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Salvando..." : "Salvar configuracoes"}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadSettings}
            disabled={loading}
          >
            Recarregar
          </button>
          <span className="results-meta">
            {enabledFields.size} item{enabledFields.size === 1 ? "" : "s"} ativo
            {enabledFields.size === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="keyword-admin">
        <h2>Palavras adicionadas</h2>
        {keywords.length ? (
          <div className="keyword-admin-list">
            {keywords.map((keyword) => (
              <div className="keyword-admin-item" key={keyword.id}>
                <span>{keyword.label}</span>
                <div className="keyword-admin-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => handleDeleteKeyword(keyword)}
                    disabled={deletingId === keyword.id}
                  >
                    {deletingId === keyword.id ? "Removendo..." : "Remover"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="help-text">Nenhuma palavra cadastrada.</p>
        )}
      </div>
    </div>
  );
}
