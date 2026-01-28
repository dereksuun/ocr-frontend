import type { DocumentFilters, Preset } from "../lib/api";
import PresetSelect from "./PresetSelect";

type FiltersBarProps = {
  presets: Preset[];
  filters: DocumentFilters;
  isLoading?: boolean;
  resultCount?: number | null;
  processingNotice?: string | null;
  onFiltersChange: (next: DocumentFilters) => void;
  onApply: () => void;
  onClear: () => void;
};

const formatPresetKeywords = (preset: Preset) => preset.keywords.join("; ");
const formatPresetExclude = (preset: Preset) => preset.exclude_terms_text || "";

export default function FiltersBar({
  presets,
  filters,
  isLoading,
  resultCount,
  processingNotice,
  onFiltersChange,
  onApply,
  onClear,
}: FiltersBarProps) {
  const activePreset = presets.find((preset) => preset.id === filters.presetId);
  const showPresetFields = Boolean(filters.presetId);

  const handlePresetChange = (presetId: string) => {
    if (!presetId) {
      onFiltersChange({ ...filters, presetId: "" });
      return;
    }

    const preset = presets.find((item) => item.id === presetId);
    if (!preset) {
      onFiltersChange({ ...filters, presetId });
      return;
    }

    onFiltersChange({
      ...filters,
      presetId,
      query: formatPresetKeywords(preset),
      exclude: formatPresetExclude(preset),
      mode: preset.keywords_mode || filters.mode,
      excludeUnknowns: preset.exclude_unknowns,
      expMin:
        preset.experience_min_years === null ? "" : String(preset.experience_min_years),
      ageMin: preset.age_min_years === null ? "" : String(preset.age_min_years),
      ageMax: preset.age_max_years === null ? "" : String(preset.age_max_years),
    });
  };

  return (
    <form
      className="filters-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="filters-row">
        <PresetSelect
          presets={presets}
          value={filters.presetId || ""}
          onChange={handlePresetChange}
          disabled={isLoading}
        />
        <label className="filter-field">
          <span>Buscar termos</span>
          <input
            className="input-text"
            type="text"
            value={filters.query || ""}
            onChange={(event) =>
              onFiltersChange({ ...filters, query: event.target.value })
            }
            placeholder="python, django, fastapi"
          />
        </label>
        <label className="filter-field">
          <span>Excluir termos</span>
          <input
            className="input-text"
            type="text"
            value={filters.exclude || ""}
            onChange={(event) =>
              onFiltersChange({ ...filters, exclude: event.target.value })
            }
            placeholder="estagio, junior"
          />
        </label>
        <div className="filter-toggle">
          <span>Modo</span>
          <div className="toggle-options">
            <label className="toggle-option">
              <input
                type="radio"
                name="mode"
                value="all"
                checked={(filters.mode || "all") !== "any"}
                onChange={() => onFiltersChange({ ...filters, mode: "all" })}
              />
              <span>TODOS</span>
            </label>
            <label className="toggle-option">
              <input
                type="radio"
                name="mode"
                value="any"
                checked={(filters.mode || "all") === "any"}
                onChange={() => onFiltersChange({ ...filters, mode: "any" })}
              />
              <span>QUALQUER</span>
            </label>
          </div>
        </div>
      </div>
      {showPresetFields ? (
        <div className="filters-row filters-row--extra">
          <label className="filter-field">
            <span>Experiência mínima (anos)</span>
            <input
              className="input-text"
              type="number"
              min={0}
              value={filters.expMin || ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, expMin: event.target.value })
              }
            />
          </label>
          <label className="filter-field">
            <span>Idade minima (anos)</span>
            <input
              className="input-text"
              type="number"
              min={0}
              value={filters.ageMin || ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, ageMin: event.target.value })
              }
            />
          </label>
          <label className="filter-field">
            <span>Idade maxima (anos)</span>
            <input
              className="input-text"
              type="number"
              min={0}
              value={filters.ageMax || ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, ageMax: event.target.value })
              }
            />
          </label>
          <label className="check-item">
            <input
              type="checkbox"
              checked={Boolean(filters.excludeUnknowns)}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  excludeUnknowns: event.target.checked,
                })
              }
            />
            <span>Excluir desconhecidos</span>
          </label>
        </div>
      ) : null}
      <div className="filters-actions">
        <button className="btn btn-primary btn-sm" type="submit" disabled={isLoading}>
          Aplicar
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={onClear}
          disabled={isLoading}
        >
          Limpar filtros
        </button>
        <span className="results-meta">
          {typeof resultCount === "number"
            ? `${resultCount} documento${resultCount === 1 ? "" : "s"}`
            : "Sem resultados"}
        </span>
        {activePreset ? (
          <span className="results-meta">Filtro: {activePreset.name}</span>
        ) : null}
        {processingNotice ? (
          <span className="results-meta">{processingNotice}</span>
        ) : null}
        {isLoading ? <span className="results-meta">Carregando...</span> : null}
      </div>
    </form>
  );
}
