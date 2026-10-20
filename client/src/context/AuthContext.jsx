import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, tokenStore } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) { setReady(true); return; }
    api.get("/auth/me").then((d) => setUser(d.user)).catch(() => tokenStore.clear()).finally(() => setReady(true));
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    window.addEventListener("djjs:logout", logout);
    return () => window.removeEventListener("djjs:logout", logout);
  }, [logout]);

  const login = async (email, password) => {
    const d = await api.post("/auth/login", { email, password });
    tokenStore.set(d.token);
    setUser(d.user);
    return d.user;
  };

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const ROLE_HOME = { Admin: "/", "Front Desk": "/", Housekeeping: "/housekeeping", Restaurant: "/pos" };
