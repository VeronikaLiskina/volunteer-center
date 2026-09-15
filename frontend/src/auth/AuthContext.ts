import { createContext, useContext } from "react";
import type { AuthUser } from "../types/auth";

export const AuthContext = createContext<{
  user: AuthUser | null; loading: boolean; error: string;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}>({ user: null, loading: true, error: "", login: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(AuthContext);
