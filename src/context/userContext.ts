import { createContext, useContext } from "react";
import type { Sector } from "../lib/api";
import type { UserProfile } from "./UserContext";

export type UserContextValue = {
  user: UserProfile | null;
  isAdmin: boolean;
  sector: Sector | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const UserContext = createContext<UserContextValue | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
};
