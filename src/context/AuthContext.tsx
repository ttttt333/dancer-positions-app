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
import {
  buildMeFromSupabaseUser,
  buildMeFromSupabaseUserWithBilling,
} from "../lib/buildSupabaseMe";
import { notifyNewSignupIfNeeded } from "../lib/notifyNewSignup";
import { clearAuthSessionHashIfPresent } from "../lib/supabaseAuth";
import {
  getSupabase,
  isSupabaseBackend,
  setSupabaseAccessToken,
} from "../lib/supabaseClient";
import type { Me } from "../types/authMe";

/** `/api/me` が返らないとき無限に「読み込み中」にならないようにする */
const ME_REQUEST_TIMEOUT_MS = 12_000;

export type { Me };

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
    id: "0",
    email: "demo@local",
  },
  adminOrganizations: [],
  memberOrganizations: [],
};

export function mapApiMeToContextMe(m: {
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
}): Me {
  return {
    user: { ...m.user, id: String(m.user.id) },
    adminOrganizations: m.adminOrganizations,
    memberOrganizations: m.memberOrganizations,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const refreshGeneration = useRef(0);
  const meUserIdRef = useRef<string | null>(null);
  const billingEnrichGen = useRef(0);

  const applySupabaseSession = useCallback(
    (
      session: import("@supabase/supabase-js").Session | null,
      opts?: { enrichBilling?: boolean; tokenOnly?: boolean }
    ) => {
      if (isDemoSessionToken()) {
        setMe(DEMO_ME);
        meUserIdRef.current = DEMO_ME.user.id;
        return;
      }
      setSupabaseAccessToken(session?.access_token ?? null);
      if (!session) {
        setMe(null);
        meUserIdRef.current = null;
        return;
      }

      // トークン更新だけなら me を作り直さない（エディタ再読込の連鎖を防ぐ）
      if (opts?.tokenOnly) {
        return;
      }

      notifyNewSignupIfNeeded(session.user);

      // セッションがあるあいだは同期的に me を立てる（課金待ちでゲスト画面に落ちない）
      const base = buildMeFromSupabaseUser(session.user);
      const sameUser = meUserIdRef.current === base.user.id;
      if (!sameUser) {
        setMe(base);
        meUserIdRef.current = base.user.id;
      } else {
        // 同一ユーザーなら email など最小限だけ同期（オブジェクト差し替えを避ける）
        setMe((prev) => {
          if (!prev || prev.user.id !== base.user.id) return base;
          if (prev.user.email === base.user.email) return prev;
          return {
            ...prev,
            user: { ...prev.user, email: base.user.email },
          };
        });
      }
      clearAuthSessionHashIfPresent();

      if (opts?.enrichBilling === false) return;

      const gen = ++billingEnrichGen.current;
      void (async () => {
        const enriched = await buildMeFromSupabaseUserWithBilling(session.user);
        if (billingEnrichGen.current !== gen) return;
        if (meUserIdRef.current !== enriched.user.id) return;
        setMe((prev) => {
          if (!prev || prev.user.id !== enriched.user.id) return enriched;
          // 課金フィールドだけマージ（参照安定を優先）
          const pu = prev.user;
          const eu = enriched.user;
          if (
            pu.entitlement_lifetime === eu.entitlement_lifetime &&
            pu.stripe_customer_id === eu.stripe_customer_id &&
            pu.stripe_subscription_id === eu.stripe_subscription_id &&
            pu.subscription_status === eu.subscription_status &&
            pu.is_pro === eu.is_pro
          ) {
            return prev;
          }
          return { ...prev, user: { ...pu, ...eu } };
        });
      })();
    },
    []
  );

  const refresh = useCallback(async (): Promise<boolean> => {
    if (isSupabaseBackend()) {
      if (isDemoSessionToken()) {
        setMe(DEMO_ME);
        meUserIdRef.current = DEMO_ME.user.id;
        return true;
      }
      const gen = ++refreshGeneration.current;
      try {
        const { data } = await getSupabase().auth.getSession();
        if (refreshGeneration.current !== gen) return false;
        const session = data.session;
        applySupabaseSession(session, { enrichBilling: true });
        return !!session;
      } catch {
        if (refreshGeneration.current !== gen) return false;
        setMe(null);
        meUserIdRef.current = null;
        setSupabaseAccessToken(null);
        return false;
      } finally {
        if (refreshGeneration.current === gen) {
          setReady(true);
        }
      }
    }

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
      setMe(mapApiMeToContextMe(m));
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
  }, [applySupabaseSession]);

  useEffect(() => {
    if (isSupabaseBackend()) {
      const s = getSupabase();
      s.auth
        .getSession()
        .then(({ data: { session } }) => {
          applySupabaseSession(session, { enrichBilling: true });
          setReady(true);
        })
        .catch(() => {
          setMe(null);
          meUserIdRef.current = null;
          setSupabaseAccessToken(null);
          setReady(true);
        });
      const { data: sub } = s.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED") {
          applySupabaseSession(session, { tokenOnly: true });
          return;
        }
        if (event === "SIGNED_OUT") {
          applySupabaseSession(null);
          return;
        }
        // INITIAL_SESSION / SIGNED_IN / USER_UPDATED / PASSWORD_RECOVERY など
        applySupabaseSession(session, {
          enrichBilling: event !== "INITIAL_SESSION" || !meUserIdRef.current,
        });
      });
      return () => {
        sub.subscription.unsubscribe();
      };
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回のみ: Supabase は別途 subscribe
  }, []);

  const logout = useCallback(() => {
    refreshGeneration.current += 1;
    billingEnrichGen.current += 1;
    if (isSupabaseBackend()) {
      void getSupabase().auth.signOut();
      setSupabaseAccessToken(null);
    }
    setToken(null);
    setMe(null);
    meUserIdRef.current = null;
  }, []);

  const setAuth = useCallback((token: string, m: Me) => {
    if (!isSupabaseBackend()) {
      setToken(token);
    }
    setMe(m);
    meUserIdRef.current = m.user.id;
  }, []);

  const skipLoginForNow = useCallback(() => {
    refreshGeneration.current += 1;
    billingEnrichGen.current += 1;
    (async () => {
      if (isSupabaseBackend()) {
        await getSupabase().auth.signOut();
        setSupabaseAccessToken(null);
      }
    })();
    setToken(DEMO_SESSION_TOKEN);
    setMe(DEMO_ME);
    meUserIdRef.current = DEMO_ME.user.id;
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
