import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  authApi,
  DEMO_SESSION_TOKEN,
  getToken,
  isDemoSessionToken,
  setToken,
} from "../api/client";

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
  /** 成功時 true。失敗時はトークンを消すので false（呼び出し側でエラー表示に使える） */
  refresh: () => Promise<boolean>;
  logout: () => void;
  setAuth: (token: string, me: Me) => void;
  /** ログイン・API 未接続でもライブラリへ進む（暫定。後から本ログインに差し替え可能） */
  skipLoginForNow: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const DEMO_ME: Me = {
  user: {
    id: 0,
    email: "demo@local",
  },
  adminOrganizations: [],
  memberOrganizations: [],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!getToken()) {
      setMe(null);
      setReady(true);
      return false;
    }
    if (isDemoSessionToken()) {
      setMe(DEMO_ME);
      setReady(true);
      return true;
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
      if (refreshGeneration.current !== gen) return false;
      setMe(m);
      return true;
    } catch {
      if (refreshGeneration.current !== gen) return false;
      setToken(null);
      setMe(null);
      return false;
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
    refreshGeneration.current += 1;
    setToken(null);
    setMe(null);
  }, []);

  const setAuth = useCallback((token: string, m: Me) => {
    setToken(token);
    setMe(m);
  }, []);

  const skipLoginForNow = useCallback(() => {
    refreshGeneration.current += 1;
    setToken(DEMO_SESSION_TOKEN);
    setMe(DEMO_ME);
    setReady(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ ready, me, refresh, logout, setAuth, skipLoginForNow }}
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
