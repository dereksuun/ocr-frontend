import type { Preset } from "../lib/api";

type PresetSelectProps = {
  presets: Preset[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export default function PresetSelect({
  presets,
  value,
  disabled,
  onChange,
}: PresetSelectProps) {
  return (
    <label className="filter-field">
      <span>Filtro</span>
      <select
        className="input-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Todos</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
    </label>
  );
}
