// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as Auth from "@/services/auth";

type Status = "idle" | "loading" | "authenticated" | "unauthenticated";

type AuthContextType = {
  user: Auth.User | null;
  status: Status;
  /** true until the initial session check (/auth/me) has finished */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  // Hydrate session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus("loading");
      try {
        const u = await Auth.me();
        if (!cancelled) {
          setUser(u);
          setStatus(u ? "authenticated" : "unauthenticated");
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const u = await Auth.login(email, password);
    setUser(u);
    setStatus("authenticated");
  };

  const register = async (name: string, email: string, password: string) => {
    const u = await Auth.register(name, email, password);
    setUser(u);
    setStatus("authenticated");
  };

  // Re-check the session without flipping `loading` (which would unmount the app shell).
  const refresh = async () => {
    try {
      const u = await Auth.me();
      setUser(u);
      setStatus(u ? "authenticated" : "unauthenticated");
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  };

  const logout = async () => {
    await Auth.logout();
    setUser(null);
    setStatus("unauthenticated");
  };

  const loading = status === "idle" || status === "loading";

  const value = useMemo(
    () => ({ user, status, loading, login, register, refresh, logout }),
    [user, status, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
