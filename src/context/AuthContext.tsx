import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, getToken, setToken } from "../api/client";

type Me = {
  user: { id: number; email: string; entitlement_lifetime?: number };
  adminOrganizations: { id: number; name: string }[];
  memberOrganizations: { id: number; name: string }[];
};

type AuthState = {
  ready: boolean;
  me: Me | null;
  refresh: () => Promise<void>;
  logout: () => void;
  setAuth: (token: string, me: Me) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setReady(true);
      return;
    }
    try {
      const m = await authApi.me();
      setMe(m);
    } catch {
      setToken(null);
      setMe(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  const setAuth = useCallback((token: string, m: Me) => {
    setToken(token);
    setMe(m);
  }, []);

  return (
    <AuthContext.Provider
      value={{ ready, me, refresh, logout, setAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
