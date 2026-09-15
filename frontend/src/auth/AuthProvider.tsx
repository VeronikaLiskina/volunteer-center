import { useEffect, useState, type ReactNode } from "react";
import { request } from "../api/client";
import type { AuthUser, LoginResult } from "../types/auth";
import { AuthContext } from "./AuthContext";
import { getToken, sessionEvent, setToken } from "./session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, updateToken] = useState(getToken);
  const [state, setState] = useState<{ token: string | null; user: AuthUser | null; error: string }>({ token: null, user: null, error: "" });
  useEffect(() => {
    const sync = () => updateToken(getToken());
    window.addEventListener(sessionEvent, sync);
    return () => window.removeEventListener(sessionEvent, sync);
  }, []);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    request<AuthUser>("/auth/me", { signal: controller.signal }).then((user) => {
      if (!controller.signal.aborted) setState({ token, user, error: "" });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setState({ token, user: null, error: cause instanceof Error ? cause.message : "Не удалось проверить сессию" });
    });
    return () => controller.abort();
  }, [token]);
  async function login(phone: string, password: string) {
    const result = await request<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify({ phone, password }) });
    setState({ token: result.access_token, user: result.user, error: "" });
    setToken(result.access_token);
  }
  async function logout() {
    await request<void>("/auth/logout", { method: "POST" });
    setToken(null);
  }
  return <AuthContext.Provider value={{ user: token && state.token === token ? state.user : null,
    loading: Boolean(token && state.token !== token), error: token ? state.error : "", login, logout }}>{children}</AuthContext.Provider>;
}
