import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../context/userContext";
import { fetchProfile, updateProfile } from "../lib/api";

const getString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
};

const getSectorName = (
  record: Record<string, unknown>,
  fallback: string,
): string => {
  const sectorValue = record.sector;
  if (sectorValue && typeof sectorValue === "object") {
    const sectorRecord = sectorValue as Record<string, unknown>;
    const name = getString(sectorRecord, ["name", "label", "title", "sector_name"]);
    if (name) {
      return name;
    }
  }
  const direct = getString(record, ["sector_name", "sectorName"]);
  if (direct) {
    return direct;
  }
  return fallback;
};

const resolveAdminFlag = (record: Record<string, unknown>, fallback: boolean) => {
  const flag =
    record.is_admin ??
    record.isAdmin ??
    record.is_staff ??
    record.isStaff ??
    record.is_superuser ??
    record.isSuperuser ??
    record.admin;
  if (typeof flag === "boolean") {
    return flag;
  }
  return fallback;
};

type EditableKeys = {
  nameKey?: string;
};

const resolveEditableKeys = (record: Record<string, unknown>): EditableKeys => {
  const nameKey =
    typeof record.name === "string"
      ? "name"
      : typeof record.full_name === "string"
        ? "full_name"
        : typeof record.fullName === "string"
          ? "fullName"
          : typeof record.display_name === "string"
            ? "display_name"
            : undefined;
  return { nameKey };
};

export default function ProfilePage() {
  const { user, sector, isAdmin, refresh } = useUser();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [keys, setKeys] = useState<EditableKeys>({});
  const [formState, setFormState] = useState({ name: "" });
  const [initialValues, setInitialValues] = useState({ name: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetchProfile();
      const record = response as Record<string, unknown>;
      const nextKeys = resolveEditableKeys(record);
      const nameValue = nextKeys.nameKey ? String(record[nextKeys.nameKey] ?? "") : "";
      setProfile(record);
      setKeys(nextKeys);
      setFormState({ name: nameValue });
      setInitialValues({ name: nameValue });
    } catch {
      setError("Falha ao carregar perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const canSave = useMemo(() => {
    const nameChanged =
      keys.nameKey && formState.name.trim() !== initialValues.name.trim();
    return Boolean(nameChanged);
  }, [formState, initialValues, keys]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!keys.nameKey) {
      setError("Nenhum campo editável disponível.");
      return;
    }
    const payload: Record<string, unknown> = {};
    if (keys.nameKey) {
      const trimmed = formState.name.trim();
      if (trimmed !== initialValues.name.trim()) {
        payload[keys.nameKey] = trimmed;
      }
    }
    if (Object.keys(payload).length === 0) {
      setSuccess("Nada para salvar.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await updateProfile(payload);
      const record = response as Record<string, unknown>;
      const nextKeys = resolveEditableKeys(record);
      const nameValue = nextKeys.nameKey ? String(record[nextKeys.nameKey] ?? "") : "";
      setProfile(record);
      setKeys(nextKeys);
      setFormState({ name: nameValue });
      setInitialValues({ name: nameValue });
      await refresh();
      setSuccess("Perfil atualizado com sucesso.");
    } catch {
      setError("Falha ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormState({ name: initialValues.name });
    setSuccess(null);
    setError(null);
  };

  const emailValue =
    (profile ? getString(profile, ["email"]) : "") || user?.email || "-";
  const sectorName = getSectorName(profile || {}, sector?.name || "Sem setor");
  const adminFlag = resolveAdminFlag(profile || {}, isAdmin);

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Perfil</h1>
          <p className="help-text">Atualize seus dados de usuário.</p>
        </div>
        <Link className="btn btn-ghost" to="/documents">
          Voltar
        </Link>
      </div>
      {loading ? <p className="help-text">Carregando perfil...</p> : null}
      {error ? <p className="error-hint">{error}</p> : null}
      {success ? <p className="notice">{success}</p> : null}
      {!loading ? (
        <form className="settings-form" onSubmit={handleSubmit}>
          {keys.nameKey ? (
            <label className="filter-field">
              <span>Nome completo</span>
              <input
                className="input-text"
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </label>
          ) : null}
          {!keys.nameKey ? (
            <p className="help-text">Nenhum campo editável disponível.</p>
          ) : null}
          <div className="settings-grid">
            <label className="filter-field">
              <span>Email</span>
              <input className="input-text" type="text" value={emailValue} readOnly />
            </label>
            <label className="filter-field">
              <span>Setor</span>
              <input
                className="input-text"
                type="text"
                value={sectorName}
                readOnly
              />
            </label>
            <label className="filter-field">
              <span>Perfil</span>
              <input
                className="input-text"
                type="text"
                value={adminFlag ? "Administrador" : "Usuário"}
                readOnly
              />
            </label>
          </div>
          <div className="filters-actions">
            <button className="btn btn-primary" type="submit" disabled={saving || !canSave}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={handleReset}
              disabled={saving || !canSave}
            >
              Restaurar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
