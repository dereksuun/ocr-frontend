import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  loginWithCredentials,
  refreshAccessToken,
  subscribeAccessToken,
} from "../lib/api";
import { AuthContext, type AuthContextValue } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState(getAccessToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeAccessToken((token) => {
      setAccessTokenState(token);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        await refreshAccessToken();
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await loginWithCredentials(username, password);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      accessToken,
      isAuthenticated: Boolean(accessToken),
      isLoading,
      login,
      logout,
    }),
    [accessToken, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
