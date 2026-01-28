import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import type { Sector } from "../lib/api";
import { createSector, fetchSectors, updateSector } from "../lib/api";

type SectorFormState = {
  name: string;
  isActive: boolean;
};

const emptyForm: SectorFormState = {
  name: "",
  isActive: true,
};

const isSectorActive = (sector: Sector) => {
  if (typeof sector.is_active === "boolean") {
    return sector.is_active;
  }
  if (typeof sector.active === "boolean") {
    return sector.active;
  }
  return true;
};

const getSectorLabel = (sector: Sector) => sector.name || `Setor ${sector.id}`;

export default function AdminSectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [formState, setFormState] = useState<SectorFormState>(emptyForm);

  const loadSectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSectors();
      setSectors(response.items);
    } catch {
      setError("Falha ao carregar setores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSectors();
  }, [loadSectors]);

  const openCreate = () => {
    setEditingSector(null);
    setFormState(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (sector: Sector) => {
    setEditingSector(sector);
    setFormState({
      name: sector.name || "",
      isActive: isSectorActive(sector),
    });
    setError(null);
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [modalOpen, closeModal]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formState.name.trim();
    if (!name) {
      setError("Informe o nome do setor.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingSector) {
        await updateSector(editingSector.id, {
          name,
          is_active: formState.isActive,
        });
      } else {
        await createSector({ name, is_active: formState.isActive });
      }
      await loadSectors();
      setModalOpen(false);
    } catch {
      setError("Falha ao salvar setor.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (sector: Sector) => {
    const nextActive = !isSectorActive(sector);
    setSaving(true);
    setError(null);
    try {
      await updateSector(sector.id, { is_active: nextActive });
      setSectors((prev) =>
        prev.map((item) =>
          item.id === sector.id ? { ...item, is_active: nextActive } : item,
        ),
      );
    } catch {
      setError("Falha ao atualizar status do setor.");
    } finally {
      setSaving(false);
    }
  };

  const sortedSectors = useMemo(
    () =>
      [...sectors].sort((a, b) =>
        getSectorLabel(a).localeCompare(getSectorLabel(b), "pt-BR"),
      ),
    [sectors],
  );

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Setores</h1>
          <p className="help-text">Gerencie os setores disponíveis no sistema.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            Novo setor
          </button>
          <Link className="btn btn-ghost" to="/documents">
            Voltar
          </Link>
        </div>
      </div>
      {error ? <p className="error-hint">{error}</p> : null}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Setor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3}>Carregando setores...</td>
              </tr>
            ) : sortedSectors.length === 0 ? (
              <tr>
                <td colSpan={3}>Nenhum setor cadastrado.</td>
              </tr>
            ) : (
              sortedSectors.map((sector) => {
                const isActive = isSectorActive(sector);
                return (
                  <tr key={String(sector.id)}>
                    <td>{getSectorLabel(sector)}</td>
                    <td>{isActive ? "Ativo" : "Inativo"}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          type="button"
                          onClick={() => openEdit(sector)}
                          disabled={saving}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() => handleToggleActive(sector)}
                          disabled={saving}
                        >
                          {isActive ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {modalOpen ? (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>{editingSector ? "Editar setor" : "Novo setor"}</h2>
                <p className="help-text">
                  {editingSector
                    ? "Atualize o nome ou status do setor."
                    : "Informe o nome para criar um novo setor."}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={closeModal}
              >
                Fechar
              </button>
            </div>
            <form className="settings-form" onSubmit={handleSubmit}>
              <label className="filter-field">
                <span>Nome</span>
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
                  required
                />
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                <span>Setor ativo</span>
              </label>
              <div className="filters-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
