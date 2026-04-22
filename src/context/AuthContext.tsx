import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authApi, getToken, setToken } from "../api/client";

/** `/api/me` が返らないとき無限に「読み込み中」にならないようにする */
const ME_REQUEST_TIMEOUT_MS = 12_000;

type Me = {
  user: {
    id: number;
    email: string;
    entitlement_lifetime?: number;
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
    subscription_status?: string | null;
  };
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
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setReady(true);
      return;
    }
    const gen = ++refreshGeneration.current;
    try {
      const m = await Promise.race([
        authApi.me(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("me timeout")),
            ME_REQUEST_TIMEOUT_MS
          );
        }),
      ]);
      if (refreshGeneration.current !== gen) return;
      setMe(m);
    } catch {
      if (refreshGeneration.current !== gen) return;
      setToken(null);
      setMe(null);
    } finally {
      if (refreshGeneration.current === gen) {
        setReady(true);
      }
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
