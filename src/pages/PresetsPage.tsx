import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Preset, PresetPayload } from "../lib/api";
import { createPreset, deletePreset, fetchPresets, updatePreset } from "../lib/api";

type PresetFormState = {
  name: string;
  keywordsMode: "all" | "any";
  excludeUnknowns: boolean;
  experienceMin: string;
  ageMin: string;
  ageMax: string;
  keywordsText: string;
  excludeText: string;
};

const emptyForm: PresetFormState = {
  name: "",
  keywordsMode: "all",
  excludeUnknowns: false,
  experienceMin: "",
  ageMin: "",
  ageMax: "",
  keywordsText: "",
  excludeText: "",
};

const splitTerms = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  const parts = trimmed.includes(";")
    ? trimmed.split(";")
    : trimmed.split(/[,\s]+/);
  return parts.map((term) => term.trim()).filter(Boolean);
};

const formatPresetMeta = (preset: Preset) => {
  const parts: string[] = [];
  if (preset.keywords.length) {
    parts.push(`Termos: ${preset.keywords.join("; ")}`);
  }
  if (preset.exclude_terms_text) {
    parts.push(`Excluir: ${preset.exclude_terms_text}`);
  }
  if (preset.keywords_mode) {
    parts.push(`Modo: ${preset.keywords_mode === "any" ? "qualquer" : "todos"}`);
  }
  if (preset.exclude_unknowns) {
    parts.push("Excluir desconhecidos");
  }
  if (preset.experience_min_years !== null) {
    parts.push(`Experiência: ${preset.experience_min_years}+ anos`);
  }
  if (preset.age_min_years !== null || preset.age_max_years !== null) {
    const min = preset.age_min_years === null ? "?" : String(preset.age_min_years);
    const max = preset.age_max_years === null ? "?" : String(preset.age_max_years);
    parts.push(`Idade: ${min}-${max} anos`);
  }
  return parts.join(" | ");
};

const buildFormFromPreset = (preset: Preset): PresetFormState => ({
  name: preset.name || "",
  keywordsMode: preset.keywords_mode || "all",
  excludeUnknowns: preset.exclude_unknowns,
  experienceMin:
    preset.experience_min_years === null ? "" : String(preset.experience_min_years),
  ageMin: preset.age_min_years === null ? "" : String(preset.age_min_years),
  ageMax: preset.age_max_years === null ? "" : String(preset.age_max_years),
  keywordsText: preset.keywords.join("; "),
  excludeText: preset.exclude_terms_text || "",
});

const toNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PresetFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = useMemo(
    () => (editingId ? "Editar filtro" : "Filtros"),
    [editingId],
  );

  const loadPresets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPresets();
      setPresets(result.items);
    } catch {
      setError("Falha ao carregar filtros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const handleEdit = (preset: Preset) => {
    setEditingId(preset.id);
    setFormState(buildFormFromPreset(preset));
    setError(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormState(emptyForm);
    setError(null);
  };

  const buildPayload = (): PresetPayload => ({
    name: formState.name.trim(),
    keywords: splitTerms(formState.keywordsText),
    exclude_terms_text: formState.excludeText.trim(),
    keywords_mode: formState.keywordsMode,
    exclude_unknowns: formState.excludeUnknowns,
    experience_min_years: toNumberOrNull(formState.experienceMin),
    experience_max_years: null,
    age_min_years: toNumberOrNull(formState.ageMin),
    age_max_years: toNumberOrNull(formState.ageMax),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formState.name.trim();
    if (!name) {
      setError("Informe o nome do filtro.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        await updatePreset(editingId, payload);
      } else {
        await createPreset(payload);
      }
      await loadPresets();
      setEditingId(null);
      setFormState(emptyForm);
    } catch {
      setError("Falha ao salvar filtro.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (presetId: string) => {
    const ok = window.confirm("Deseja remover este filtro?");
    if (!ok) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deletePreset(presetId);
      await loadPresets();
      if (editingId === presetId) {
        setEditingId(null);
        setFormState(emptyForm);
      }
    } catch {
      setError("Falha ao remover filtro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>{heading}</h1>
          <p className="help-text">
            Crie filtros reutilizáveis por palavras-chave, idade e experiência.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/documents">
          Voltar
        </Link>
      </div>

      {error ? <p className="error-hint">{error}</p> : null}

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          <label className="filter-field">
            <span>Nome do filtro</span>
            <input
              className="input-text"
              type="text"
              value={formState.name}
              onChange={(event) =>
                setFormState({ ...formState, name: event.target.value })
              }
              placeholder="Filtro gerente"
            />
          </label>
          <label className="filter-field">
            <span>Modo palavras-chave</span>
            <select
              className="input-select"
              value={formState.keywordsMode}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  keywordsMode: event.target.value as "all" | "any",
                })
              }
            >
              <option value="all">Todos</option>
              <option value="any">Qualquer</option>
            </select>
          </label>
          <label className="check-item">
            <input
              type="checkbox"
              checked={formState.excludeUnknowns}
              onChange={(event) =>
                setFormState({ ...formState, excludeUnknowns: event.target.checked })
              }
            />
            <span>Excluir currículos sem idade/experiência detectada</span>
          </label>
          <label className="filter-field">
            <span>Experiência mínima (anos)</span>
            <input
              className="input-text"
              type="number"
              min={0}
              value={formState.experienceMin}
              onChange={(event) =>
                setFormState({
                  ...formState,
                  experienceMin: event.target.value,
                })
              }
            />
          </label>
          <label className="filter-field">
            <span>Idade minima (anos)</span>
            <input
              className="input-text"
              type="number"
              min={0}
              value={formState.ageMin}
              onChange={(event) =>
                setFormState({ ...formState, ageMin: event.target.value })
              }
            />
          </label>
          <label className="filter-field">
            <span>Idade maxima (anos)</span>
            <input
              className="input-text"
              type="number"
              min={0}
              value={formState.ageMax}
              onChange={(event) =>
                setFormState({ ...formState, ageMax: event.target.value })
              }
            />
          </label>
        </div>
        <label className="filter-field">
          <span>Palavras-chave</span>
          <textarea
            className="input-text"
            rows={3}
            value={formState.keywordsText}
            onChange={(event) =>
              setFormState({ ...formState, keywordsText: event.target.value })
            }
            placeholder="Separe termos com ;"
          />
        </label>
        <label className="filter-field">
          <span>Excluir termos</span>
          <textarea
            className="input-text"
            rows={2}
            value={formState.excludeText}
            onChange={(event) =>
              setFormState({ ...formState, excludeText: event.target.value })
            }
            placeholder="estagio; junior"
          />
        </label>
        <div className="filters-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {editingId ? "Salvar filtro" : "Criar filtro"}
          </button>
          {editingId ? (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="keyword-admin">
        <h2>Filtros salvos</h2>
        {loading ? <p className="help-text">Carregando filtros...</p> : null}
        {presets.length ? (
          <div className="keyword-admin-list">
            {presets.map((preset) => (
              <div className="keyword-admin-item" key={preset.id}>
                <div>
                  <strong>{preset.name}</strong>
                  <div className="help-text">{formatPresetMeta(preset)}</div>
                </div>
                <div className="keyword-admin-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => handleEdit(preset)}
                    disabled={saving}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => handleDelete(preset.id)}
                    disabled={saving}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="help-text">Nenhum filtro salvo.</p>
        )}
      </div>
    </div>
  );
}
