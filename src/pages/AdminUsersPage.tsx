import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { Sector, UserSummary } from "../lib/api";
import { createUser, fetchSectors, fetchUsers, resetUserPassword, updateUser } from "../lib/api";

const toIdString = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

const getUserLabel = (user: UserSummary) =>
  user.name || user.full_name || user.username || user.email || `Usuário ${user.id}`;

const getUserContact = (user: UserSummary) => user.email || user.username || "-";

const getUserName = (user: UserSummary) => user.full_name || user.name || "";

const getAdminFlag = (user: UserSummary) =>
  Boolean(user.is_admin ?? user.is_staff ?? user.is_superuser);

const resolveAdminKey = (user: UserSummary) => {
  if (typeof user.is_admin === "boolean") {
    return "is_admin";
  }
  if (typeof user.is_staff === "boolean") {
    return "is_staff";
  }
  if (typeof user.is_superuser === "boolean") {
    return "is_superuser";
  }
  return "is_admin";
};

const resolveNameKey = (user: UserSummary) => {
  if (typeof user.full_name === "string") {
    return "full_name";
  }
  if (typeof user.name === "string") {
    return "name";
  }
  return "name";
};

const resolveActiveKey = (user: UserSummary) => {
  if (typeof user.is_active === "boolean") {
    return "is_active";
  }
  if (typeof user.active === "boolean") {
    return "active";
  }
  return undefined;
};

const getUserSectorId = (user: UserSummary) => {
  if (user.sector && user.sector.id !== undefined && user.sector.id !== null) {
    return toIdString(user.sector.id);
  }
  if (user.sector_id !== undefined && user.sector_id !== null) {
    return toIdString(user.sector_id);
  }
  return "";
};

const coerceSectorId = (value: string, sectors: Sector[]) => {
  if (!value) {
    return null;
  }
  const match = sectors.find((sector) => toIdString(sector.id) === value);
  if (match) {
    return match.id;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
};

const getSectorLabel = (sector: Sector) => sector.name || `Setor ${sector.id}`;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{
    userLabel: string;
    password: string;
    message: string;
  } | null>(null);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [editMeta, setEditMeta] = useState<{
    nameKey?: "name" | "full_name";
    adminKey: "is_admin" | "is_staff" | "is_superuser";
    activeKey?: "is_active" | "active";
  } | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    password: "",
    isAdmin: false,
    isActive: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    sectorId: "",
    isAdmin: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, sectorsResponse] = await Promise.all([
        fetchUsers(),
        fetchSectors(),
      ]);
      setUsers(usersResponse.items);
      setSectors(sectorsResponse.items);
    } catch {
      setError("Falha ao carregar usuários ou setores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setCreateForm({
      username: "",
      email: "",
      password: "",
      sectorId: "",
      isAdmin: false,
    });
    setError(null);
    setCreateOpen(true);
  };

  const closeCreate = useCallback(() => {
    if (isCreating) {
      return;
    }
    setCreateOpen(false);
  }, [isCreating]);

  useEffect(() => {
    if (!createOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCreate();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [createOpen, closeCreate]);

  const closeReset = useCallback(() => {
    if (resettingId) {
      return;
    }
    setResetOpen(false);
  }, [resettingId]);

  const closeEdit = useCallback(() => {
    if (savingEdit) {
      return;
    }
    setEditOpen(false);
  }, [savingEdit]);

  useEffect(() => {
    if (!resetOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReset();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [resetOpen, closeReset]);

  useEffect(() => {
    if (!editOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeEdit();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [editOpen, closeEdit]);

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = createForm.username.trim();
    const email = createForm.email.trim();
    const password = createForm.password.trim();
    if (!username || !password) {
      setError("Usuário e senha são obrigatórios.");
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      const sectorIdValue = coerceSectorId(createForm.sectorId, sectors);
      await createUser({
        username,
        password,
        email: email || undefined,
        sector_id: sectorIdValue,
        is_admin: createForm.isAdmin,
      });
      await loadData();
      setCreateOpen(false);
    } catch {
      setError("Falha ao criar usuário.");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      if (sectorFilter) {
        const userSector = getUserSectorId(user);
        if (sectorFilter === "none") {
          if (userSector) {
            return false;
          }
        } else if (userSector !== sectorFilter) {
          return false;
        }
      }
      if (!query) {
        return true;
      }
      const fields = [
        user.name,
        user.full_name,
        user.username,
        user.email,
        user.sector?.name,
        user.sector_name,
      ];
      return fields
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query));
    });
  }, [users, searchTerm, sectorFilter]);


  const openEdit = (user: UserSummary) => {
    const nameKey = resolveNameKey(user);
    const adminKey = resolveAdminKey(user);
    const activeKey = resolveActiveKey(user);
    setEditingUser(user);
    setEditMeta({ nameKey, adminKey, activeKey });
    setEditForm({
      name: getUserName(user),
      password: "",
      isAdmin: getAdminFlag(user),
      isActive: activeKey ? Boolean((user as Record<string, unknown>)[activeKey]) : true,
    });
    setError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser || !editMeta) {
      return;
    }
    const payload: Record<string, unknown> = {};
    const trimmedName = editForm.name.trim();
    if (editMeta.nameKey) {
      const currentName = getUserName(editingUser).trim();
      if (trimmedName !== currentName) {
        payload[editMeta.nameKey] = trimmedName;
      }
    }
    if (editForm.password.trim()) {
      payload.password = editForm.password.trim();
    }
    const adminKey = editMeta.adminKey;
    if (typeof editForm.isAdmin === "boolean") {
      payload[adminKey] = editForm.isAdmin;
    }
    if (editMeta.activeKey) {
      payload[editMeta.activeKey] = editForm.isActive;
    }
    if (Object.keys(payload).length === 0) {
      setError("Nenhuma alteração para salvar.");
      return;
    }
    setSavingEdit(true);
    setError(null);
    try {
      const response = await updateUser(editingUser.id, payload);
      setUsers((prev) =>
        prev.map((item) =>
          toIdString(item.id) === toIdString(editingUser.id)
            ? { ...item, ...response }
            : item,
        ),
      );
      setEditOpen(false);
    } catch {
      setError("Falha ao atualizar usuário.");
    } finally {
      setSavingEdit(false);
    }
  };


  const handleResetPassword = async (user: UserSummary) => {
    const userId = toIdString(user.id);
    setResettingId(userId);
    setError(null);
    setResetResult(null);
    try {
      const response = await resetUserPassword(user.id);
      const password =
        response.temp_password ||
        response.temporary_password ||
        response.password ||
        "";
      const message = response.message || "Senha temporária gerada.";
      setResetResult({
        userLabel: getUserLabel(user),
        password,
        message,
      });
      setResetOpen(true);
    } catch {
      setError("Falha ao resetar senha.");
    } finally {
      setResettingId(null);
    }
  };

  const renderSectorOptions = () => [
    <option key="none" value="">
      Sem setor
    </option>,
    ...sectors.map((sector) => (
      <option key={toIdString(sector.id)} value={toIdString(sector.id)}>
        {getSectorLabel(sector)}
      </option>
    )),
  ];

  return (
    <div className="card">
      <div className="page-header">
        <div>
          <h1>Usuários</h1>
          <p className="help-text">Vincule cada usuário ao setor correto.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            Novo usuário
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={loadData}
            disabled={loading}
          >
            Recarregar
          </button>
          <Link className="btn btn-ghost" to="/documents">
            Voltar
          </Link>
        </div>
      </div>
      {createOpen ? (
        <div className="modal-backdrop" onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeCreate();
          }
        }}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Novo usuário</h2>
                <p className="help-text">
                  Informe os dados básicos para criar um usuário.
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={closeCreate}
                disabled={isCreating}
              >
                Fechar
              </button>
            </div>
            {error ? <p className="error-hint">{error}</p> : null}
            <form className="settings-form" onSubmit={handleCreateSubmit}>
              <label className="filter-field">
                <span>Usuário</span>
                <input
                  className="input-text"
                  type="text"
                  value={createForm.username}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="filter-field">
                <span>Email</span>
                <input
                  className="input-text"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="filter-field">
                <span>Senha</span>
                <input
                  className="input-text"
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="filter-field">
                <span>Setor</span>
                <select
                  className="input-select"
                  value={createForm.sectorId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      sectorId: event.target.value,
                    }))
                  }
                >
                  {renderSectorOptions()}
                </select>
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={createForm.isAdmin}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      isAdmin: event.target.checked,
                    }))
                  }
                />
                <span>Administrador</span>
              </label>
              <div className="filters-actions">
                <button className="btn btn-primary" type="submit" disabled={isCreating}>
                  {isCreating ? "Criando..." : "Criar usuário"}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={closeCreate}
                  disabled={isCreating}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {resetOpen && resetResult ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeReset();
            }
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Senha temporária</h2>
                <p className="help-text">
                  Usuário: {resetResult.userLabel}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={closeReset}
                disabled={resettingId !== null}
              >
                Fechar
              </button>
            </div>
            <div className="settings-form">
              <p className="notice">{resetResult.message}</p>
              <label className="filter-field">
                <span>Senha</span>
                <input
                  className="input-text"
                  type="text"
                  value={resetResult.password || ""}
                  readOnly
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}
      {editOpen && editingUser && editMeta ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeEdit();
            }
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Editar usuário</h2>
                <p className="help-text">{getUserLabel(editingUser)}</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={closeEdit}
                disabled={savingEdit}
              >
                Fechar
              </button>
            </div>
            {error ? <p className="error-hint">{error}</p> : null}
            <form className="settings-form" onSubmit={handleEditSubmit}>
              <label className="filter-field">
                <span>Nome</span>
                <input
                  className="input-text"
                  type="text"
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="filter-field">
                <span>Senha</span>
                <input
                  className="input-text"
                  type="password"
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Digite para alterar"
                />
              </label>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={editForm.isAdmin}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      isAdmin: event.target.checked,
                    }))
                  }
                />
                <span>Administrador</span>
              </label>
              {editMeta.activeKey ? (
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  <span>Usuário ativo</span>
                </label>
              ) : null}
              <div className="filters-actions">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Salvando..." : "Salvar alterações"}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={closeEdit}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {error ? <p className="error-hint">{error}</p> : null}
      <div className="settings-toolbar">
        <label className="search-field">
          <span>Buscar</span>
          <input
            className="input-text"
            type="search"
            placeholder="Nome, email ou setor"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>
        <label className="filter-field">
          <span>Setor</span>
          <select
            className="input-select"
            value={sectorFilter}
            onChange={(event) => setSectorFilter(event.target.value)}
            disabled={loading}
          >
            <option value="">Todos os setores</option>
            <option value="none">Sem setor</option>
            {sectors.map((sector) => (
              <option key={toIdString(sector.id)} value={toIdString(sector.id)}>
                {getSectorLabel(sector)}
              </option>
            ))}
          </select>
        </label>
        {sectors.length === 0 ? (
          <p className="help-text">Cadastre setores antes de vincular usuários.</p>
        ) : null}
      </div>
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Contato</th>
              <th>Setor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>Carregando usuários...</td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={4}>Nenhum usuário encontrado.</td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const userId = toIdString(user.id);
                const isResetting = resettingId === userId;
                const sectorLabel =
                  user.sector?.name || user.sector_name || getUserSectorId(user) || "—";
                return (
                  <tr key={userId}>
                    <td>
                      <div className="doc-name">{getUserLabel(user)}</div>
                      <span className="info-empty">
                        {user.username ? `@${user.username}` : ""}
                      </span>
                    </td>
                    <td>{getUserContact(user)}</td>
                    <td>
                      <span className="info-value">{sectorLabel}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => openEdit(user)}
                        disabled={isResetting}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => handleResetPassword(user)}
                        disabled={isResetting}
                      >
                        {isResetting ? "Resetando..." : "Resetar"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
