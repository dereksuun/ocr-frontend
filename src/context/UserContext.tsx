import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMe, type Sector, type UserSummary } from "../lib/api";
import { useAuth } from "./authContext";
import { UserContext, type UserContextValue } from "./userContext";

export type UserProfile = {
  id?: string | number;
  name?: string;
  email?: string;
  username?: string;
  isAdmin: boolean;
  sector: Sector | null;
};

const normalizeId = (value: unknown): string | number | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value);
};

const normalizeSector = (value: unknown): Sector | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const rawId = record.id ?? record.pk ?? record.uuid ?? record.sector_id;
  const rawName = record.name ?? record.label ?? record.title ?? record.sector_name;
  if (rawId === undefined && rawName === undefined) {
    return null;
  }
  const id = normalizeId(rawId) ?? (typeof rawName === "string" ? rawName : "unknown");
  const name =
    typeof rawName === "string"
      ? rawName
      : rawName === undefined || rawName === null
        ? String(id)
        : String(rawName);
  const rawActive = record.is_active ?? record.active;
  return {
    id,
    name,
    is_active: typeof rawActive === "boolean" ? rawActive : undefined,
  };
};

const extractSector = (record: Record<string, unknown>): Sector | null => {
  if (record.sector) {
    return normalizeSector(record.sector);
  }
  const rawId = record.sector_id ?? record.sectorId ?? record.sector_pk;
  const rawName = record.sector_name ?? record.sectorName ?? record.sector_label;
  if (rawId === undefined && rawName === undefined) {
    return null;
  }
  const id = normalizeId(rawId) ?? (typeof rawName === "string" ? rawName : "unknown");
  const name =
    typeof rawName === "string"
      ? rawName
      : rawName === undefined || rawName === null
        ? String(id)
        : String(rawName);
  const rawActive = record.sector_active ?? record.sectorActive;
  return {
    id,
    name,
    is_active: typeof rawActive === "boolean" ? rawActive : undefined,
  };
};

const normalizeUser = (data: UserSummary | Record<string, unknown>): UserProfile => {
  const record = data as Record<string, unknown>;
  const isAdmin = Boolean(
    record.is_admin ??
      record.isAdmin ??
      record.is_staff ??
      record.isStaff ??
      record.is_superuser ??
      record.isSuperuser ??
      record.admin,
  );
  return {
    id: normalizeId(record.id),
    name:
      typeof record.name === "string"
        ? record.name
        : typeof record.full_name === "string"
          ? record.full_name
          : typeof record.fullName === "string"
            ? record.fullName
            : undefined,
    email: typeof record.email === "string" ? record.email : undefined,
    username: typeof record.username === "string" ? record.username : undefined,
    isAdmin,
    sector: extractSector(record),
  };
};

export function UserProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    if (!accessToken) {
      setUser(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchMe();
      setUser(normalizeUser(response));
    } catch {
      setUser(null);
      setError("Falha ao carregar o perfil do usuário.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const value: UserContextValue = useMemo(
    () => ({
      user,
      isAdmin: user?.isAdmin ?? false,
      sector: user?.sector ?? null,
      isLoading,
      error,
      refresh: loadUser,
    }),
    [user, isLoading, error, loadUser],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
