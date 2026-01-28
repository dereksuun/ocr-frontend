import axios, { type InternalAxiosRequestConfig } from "axios";

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
const baseURL = rawBaseUrl.replace(/\/$/, "");
const AUTH_REQUIRED_EVENT = "auth:required";
const REFRESH_TOKEN_KEY = "ocr_refresh_token";

const isDebugAuth = () => {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (typeof window === "undefined") {
    return false;
  }
  const flag = window.localStorage.getItem("debug_auth");
  return flag === "1" || import.meta.env.VITE_DEBUG_AUTH === "true";
};

const authLog = (...args: unknown[]) => {
  if (isDebugAuth()) {
    console.info("[auth]", ...args);
  }
};

const authWarn = (...args: unknown[]) => {
  if (isDebugAuth()) {
    console.warn("[auth]", ...args);
  }
};

type TokenListener = (token: string | null) => void;
type AuthRequiredDetail = { status?: number };

let accessToken: string | null = null;
const tokenListeners = new Set<TokenListener>();

export const api = axios.create({
  baseURL,
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

const authApi = axios.create({
  baseURL,
  withCredentials: true,
});

const notifyTokenListeners = (token: string | null) => {
  tokenListeners.forEach((listener) => listener(token));
};

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  notifyTokenListeners(token);
};

export const subscribeAccessToken = (listener: TokenListener) => {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
};

export const getRefreshToken = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setRefreshToken = (token: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const clearTokens = () => {
  setAccessToken(null);
  setRefreshToken(null);
};

const emitAuthRequired = (detail: AuthRequiredDetail) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<AuthRequiredDetail>(AUTH_REQUIRED_EVENT, { detail }));
};

export const onAuthRequired = (handler: (detail: AuthRequiredDetail) => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<AuthRequiredDetail>;
    handler(customEvent.detail);
  };
  window.addEventListener(AUTH_REQUIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_REQUIRED_EVENT, listener);
};

type TokenResponse = { access: string; refresh: string };
type RefreshResponse = { access: string; refresh?: string };

export const loginWithCredentials = async (username: string, password: string) => {
  authLog("loginWithCredentials:start", {
    username,
    baseURL,
    withCredentials: authApi.defaults.withCredentials,
  });
  try {
    const response = await authApi.post<TokenResponse>("/api/auth/token/", {
      username,
      password,
    });
    const { access, refresh } = response.data;
    setAccessToken(access);
    setRefreshToken(refresh);
    authLog("loginWithCredentials:success", {
      status: response.status,
      hasAccess: Boolean(access),
      accessLength: access?.length ?? 0,
      hasRefresh: Boolean(refresh),
      refreshLength: refresh?.length ?? 0,
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      authWarn("loginWithCredentials:error", {
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      authWarn("loginWithCredentials:error", { error: err });
    }
    throw err;
  }
};

export const refreshAccessToken = async () => {
  const refresh = getRefreshToken();
  if (!refresh) {
    authWarn("refreshAccessToken:missing_refresh");
    return null;
  }
  authLog("refreshAccessToken:start", {
    baseURL,
    refreshLength: refresh.length,
  });
  try {
    const response = await authApi.post<RefreshResponse>("/api/auth/token/refresh/", {
      refresh,
    });
    const { access, refresh: nextRefresh } = response.data;
    if (access) {
      setAccessToken(access);
    }
    if (nextRefresh) {
      setRefreshToken(nextRefresh);
    }
    authLog("refreshAccessToken:success", {
      status: response.status,
      hasAccess: Boolean(access),
      accessLength: access?.length ?? 0,
      hasRefresh: Boolean(nextRefresh),
      refreshLength: nextRefresh?.length ?? 0,
    });
    return access;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      authWarn("refreshAccessToken:error", {
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      authWarn("refreshAccessToken:error", { error: err });
    }
    throw err;
  }
};

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  const url = config.url || "";
  if (
    isDebugAuth() &&
    (url.includes("/api/auth/") ||
      url.includes("/api/me/") ||
      url.includes("/api/profile/"))
  ) {
    authLog("request", {
      method: config.method,
      url,
      hasAuthHeader: Boolean(
        config.headers && "Authorization" in config.headers,
      ),
      hasToken: Boolean(token),
    });
  }
  if (token) {
    config.headers = config.headers ?? {};
    if (!("Authorization" in config.headers)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
    }) | null;
    const requestUrl = originalRequest?.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/api/auth/token/") ||
      requestUrl.includes("/api/auth/token/refresh/");

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      authWarn("response:401:attempt_refresh", { url: requestUrl });
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        clearTokens();
        emitAuthRequired({ status });
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      try {
        const newAccess = await refreshPromise;
        if (newAccess) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          authLog("response:401:retry_with_new_access", { url: requestUrl });
          return api(originalRequest);
        }
      } catch {
        // handled below
      }
      clearTokens();
      emitAuthRequired({ status });
      return Promise.reject(error);
    }

    if (status === 401 || status === 403) {
      authWarn("response:auth_required", { status, url: requestUrl });
      emitAuthRequired({ status });
    }
    return Promise.reject(error);
  },
);

export type DocumentStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export type Document = {
  id: string;
  filename: string;
  status: DocumentStatus;
  extracted_age_years: number | null;
  extracted_experience_years: number | null;
  error_message: string;
  contact_phone?: string | null;
  match_snippets?: string[];
  search_snippet?: string;
  created_at: string;
  updated_at: string;
};

export type Sector = {
  id: string | number;
  name: string;
  is_active?: boolean;
  active?: boolean;
};

export type UserSummary = {
  id: string | number;
  name?: string;
  full_name?: string;
  username?: string;
  email?: string;
  sector?: Sector | null;
  sector_id?: string | number | null;
  sector_name?: string | null;
  is_admin?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
  active?: boolean;
};

export type Preset = {
  id: string;
  name: string;
  keywords: string[];
  exclude_terms_text: string;
  keywords_mode: "all" | "any";
  exclude_unknowns: boolean;
  experience_min_years: number | null;
  experience_max_years: number | null;
  age_min_years: number | null;
  age_max_years: number | null;
  created_at: string;
  updated_at: string;
};

export type EnabledFieldsResponse = {
  enabled_fields: string[];
};

export type ExtractionField = {
  key: string;
  label: string;
  group: string;
  enabled_by_default: boolean;
  is_active: boolean;
  value_type: string;
};

export type ExtractionKeyword = {
  id: number;
  keyword_key: string;
  label: string;
  field_key: string;
  match_strategy: string;
  matcher: string;
  is_active: boolean;
  value_type: string;
  inferred_type: string;
  resolved_kind: string;
  strategy: string;
  strategy_params: Record<string, unknown>;
  anchors: string[];
  confidence: number | null;
};

export type ExtractionSettingsResponse = {
  enabled_fields: string[];
  available_fields: ExtractionField[];
  keywords: ExtractionKeyword[];
};

export type DocumentFilters = {
  presetId?: string;
  query?: string;
  exclude?: string;
  mode?: "all" | "any";
  excludeUnknowns?: boolean;
  ageMin?: string;
  ageMax?: string;
  expMin?: string;
  status?: string;
  page?: number;
  pageSize?: number;
};

type ListResponse<T> = {
  items: T[];
  status: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  status: number;
  count: number;
  next: string | null;
  previous: string | null;
};

const normalizeList = <T,>(data: unknown, keys: string[]) => {
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (data && typeof data === "object") {
    for (const key of keys) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }
  }
  return [];
};

const normalizePaginated = <T,>(data: unknown, keys: string[]) => {
  const items = normalizeList<T>(data, keys);
  let count = items.length;
  let next: string | null = null;
  let previous: string | null = null;

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const countValue = record.count;
    if (typeof countValue === "number") {
      count = countValue;
    }
    const nextValue = record.next;
    if (typeof nextValue === "string") {
      next = nextValue;
    } else if (nextValue === null) {
      next = null;
    }
    const previousValue = record.previous;
    if (typeof previousValue === "string") {
      previous = previousValue;
    } else if (previousValue === null) {
      previous = null;
    }
  }

  return { items, count, next, previous };
};

export const fetchMe = async (): Promise<UserSummary> => {
  try {
    const response = await api.get<UserSummary>("/api/me/");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const response = await api.get<UserSummary>("/api/profile/");
      return response.data;
    }
    throw error;
  }
};

export type ProfileResponse = UserSummary & Record<string, unknown>;

export const fetchProfile = async (): Promise<ProfileResponse> => {
  const response = await api.get<ProfileResponse>("/api/profile/");
  return response.data;
};

export const updateProfile = async (payload: Record<string, unknown>) => {
  const response = await api.patch<ProfileResponse>("/api/profile/", payload);
  return response.data;
};

export type BillingOverviewResponse = Record<string, unknown>;

export const fetchBillingOverview = async (): Promise<BillingOverviewResponse> => {
  const response = await api.get<BillingOverviewResponse>("/api/billing/overview/");
  return response.data;
};

export type SectorPayload = {
  name: string;
  is_active?: boolean;
  active?: boolean;
};

export const fetchSectors = async (): Promise<ListResponse<Sector>> => {
  const response = await api.get("/api/sectors/");
  const items = normalizeList<Sector>(response.data, ["results", "sectors", "items"]);
  return { items, status: response.status };
};

export const createSector = async (payload: SectorPayload) => {
  const response = await api.post<Sector>("/api/sectors/", payload);
  return response.data;
};

export const updateSector = async (
  id: string | number,
  payload: Partial<SectorPayload>,
) => {
  const response = await api.patch<Sector>(`/api/sectors/${id}/`, payload);
  return response.data;
};

export const deleteSector = async (id: string | number) => {
  await api.delete(`/api/sectors/${id}/`);
};

export type UpdateUserPayload = {
  sector_id?: string | number | null;
  name?: string;
  full_name?: string;
  password?: string;
  is_admin?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
  active?: boolean;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  email?: string;
  sector_id?: string | number | null;
  is_admin?: boolean;
};

export const fetchUsers = async (): Promise<ListResponse<UserSummary>> => {
  const response = await api.get("/api/users/");
  const items = normalizeList<UserSummary>(response.data, ["results", "users", "items"]);
  return { items, status: response.status };
};

export const createUser = async (payload: CreateUserPayload) => {
  const response = await api.post<UserSummary>("/api/users/", payload);
  return response.data;
};

export const updateUser = async (id: string | number, payload: UpdateUserPayload) => {
  const response = await api.patch<UserSummary>(`/api/users/${id}/`, payload);
  return response.data;
};

export const deleteUser = async (id: string | number) => {
  await api.delete(`/api/users/${id}/`);
};

export type ResetPasswordResponse = {
  temp_password?: string;
  temporary_password?: string;
  password?: string;
  message?: string;
};

export const resetUserPassword = async (id: string | number) => {
  const response = await api.post<ResetPasswordResponse>(
    `/api/users/${id}/reset-password/`,
  );
  return response.data;
};

export const fetchPresets = async (): Promise<ListResponse<Preset>> => {
  const response = await api.get("/api/presets/");
  const items = normalizeList<Preset>(response.data, ["results", "presets"]);
  return { items, status: response.status };
};

export const fetchDocuments = async (
  filters: DocumentFilters,
): Promise<PaginatedResponse<Document>> => {
  const params: Record<string, string> = {};

  if (filters.presetId) {
    params.preset = filters.presetId;
    params.preset_id = filters.presetId;
  }
  if (filters.query) {
    params.q = filters.query;
  }
  if (filters.exclude) {
    params.exclude = filters.exclude;
  }
  if (filters.mode) {
    params.mode = filters.mode;
  }
  if (filters.ageMin !== undefined && filters.ageMin !== "") {
    params.age_min_years = filters.ageMin;
    params.age_min = filters.ageMin;
  }
  if (filters.ageMax !== undefined && filters.ageMax !== "") {
    params.age_max_years = filters.ageMax;
    params.age_max = filters.ageMax;
  }
  if (filters.expMin !== undefined && filters.expMin !== "") {
    params.experience_min_years = filters.expMin;
    params.exp_min = filters.expMin;
  }
  if (filters.excludeUnknowns !== undefined) {
    params.exclude_unknowns = filters.excludeUnknowns ? "true" : "false";
  }
  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.page) {
    params.page = String(filters.page);
  }
  if (filters.pageSize) {
    params.page_size = String(filters.pageSize);
  }

  const response = await api.get("/api/documents/", { params });
  const { items, count, next, previous } = normalizePaginated<Document>(
    response.data,
    ["results", "documents"],
  );
  return { items, count, next, previous, status: response.status };
};

export const fetchDocument = async (id: string) => {
  const response = await api.get<Document>(`/api/documents/${id}/`);
  return response.data;
};

export const fetchDocumentJson = async (id: string) => {
  const response = await api.get(`/api/documents/${id}/download-json/`, {
    responseType: "text",
  });
  try {
    return JSON.parse(response.data);
  } catch {
    return { raw: response.data };
  }
};

export const fetchExtractionSettings = async () => {
  const response = await api.get<ExtractionSettingsResponse>(
    "/api/extraction-settings/",
  );
  return response.data;
};

export const updateExtractionSettings = async (enabledFields: string[]) => {
  const response = await api.put<ExtractionSettingsResponse>(
    "/api/extraction-settings/",
    { enabled_fields: enabledFields },
  );
  return response.data;
};

export type CreateKeywordPayload = {
  label: string;
  value_type?: string;
  strategy?: string;
  strategy_params?: Record<string, unknown>;
};

export const createKeyword = async (payload: CreateKeywordPayload) => {
  const response = await api.post<ExtractionKeyword>("/api/keywords/", payload);
  return response.data;
};

export const deleteKeyword = async (id: number) => {
  await api.delete(`/api/keywords/${id}/`);
};

export const fetchEnabledFields = async () => {
  const response = await fetchExtractionSettings();
  return { enabled_fields: response.enabled_fields };
};

export const uploadDocument = async (file: File, selectedFields?: string[]) => {
  const formData = new FormData();
  formData.append("file", file);
  if (selectedFields && selectedFields.length > 0) {
    selectedFields.forEach((field) => formData.append("selected_fields", field));
  }
  const response = await api.post<{ id: string; status: DocumentStatus }>(
    "/api/documents/",
    formData,
  );
  return response.data;
};

export const reprocessDocument = async (id: string) => {
  const response = await api.post<{ id: string; status: DocumentStatus }>(
    `/api/documents/${id}/reprocess/`,
  );
  return response.data;
};

export const bulkReprocessDocuments = async (ids: string[]) => {
  const response = await api.post<{ queued: number }>(
    "/api/documents/bulk-reprocess/",
    { ids },
  );
  return response.data;
};

export const bulkDownloadJson = async (ids: string[]) => {
  const response = await api.post<Blob>(
    "/api/documents/bulk-download-json/",
    { ids },
    { responseType: "blob" },
  );
  return response.data;
};

export const bulkDownloadFiles = async (ids: string[]) => {
  const response = await api.post<Blob>(
    "/api/documents/bulk-download-files/",
    { ids },
    { responseType: "blob" },
  );
  return response.data;
};

export type PresetPayload = {
  name: string;
  keywords: string[];
  exclude_terms_text: string;
  keywords_mode: "all" | "any";
  exclude_unknowns: boolean;
  experience_min_years: number | null;
  experience_max_years: number | null;
  age_min_years: number | null;
  age_max_years: number | null;
};

export const createPreset = async (payload: PresetPayload) => {
  const response = await api.post<Preset>("/api/presets/", payload);
  return response.data;
};

export const updatePreset = async (id: string, payload: PresetPayload) => {
  const response = await api.put<Preset>(`/api/presets/${id}/`, payload);
  return response.data;
};

export const deletePreset = async (id: string) => {
  await api.delete(`/api/presets/${id}/`);
};

export const logout = async () => {
  clearTokens();
};

export const getApiBaseUrl = () => baseURL;
