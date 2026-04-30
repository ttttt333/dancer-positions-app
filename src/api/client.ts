import { getSupabaseAccessToken, isSupabaseBackend } from "../lib/supabaseClient";
import {
  supabaseCreateProject,
  supabaseDeleteProject,
  supabaseGetProject,
  supabaseGetProjectByShareToken,
  supabaseListProjects,
  supabaseUpdateProject,
} from "../lib/supabaseProjects";

/** 本番ログイン前の暫定利用。`refresh` は API を呼ばずダミーユーザーを復元する */
export const DEMO_SESSION_TOKEN = "__choreogrid_demo_session__";

export function getToken(): string | null {
  const r = localStorage.getItem("auth_token");
  if (r === DEMO_SESSION_TOKEN) return r;
  if (isSupabaseBackend()) {
    return getSupabaseAccessToken() ?? null;
  }
  return r;
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("auth_token", token);
  else localStorage.removeItem("auth_token");
}

export function isDemoSessionToken(): boolean {
  return localStorage.getItem("auth_token") === DEMO_SESSION_TOKEN;
}

/** 本番で API が別ホストのとき `VITE_API_BASE_URL`（末尾スラッシュなし） */
function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).trim().replace(/\/+$/, "");
}

const base = apiBaseUrl();

const HTML_OR_TEXT_API_HINT =
  "サーバーが JSON ではなく HTML やテキストを返しました（多くの場合、本番で API が同じドメインにありません）。Vercel の環境変数に VITE_API_BASE_URL（例: https://あなたのAPIのホスト）を設定し、再デプロイしてください。";

function parseApiJsonBody(text: string, res: Response): Record<string, unknown> {
  const trimmed = text.trimStart();
  if (trimmed === "") return {};
  if (
    trimmed.startsWith("<") ||
    /^The\s/i.test(trimmed) ||
    /^Not\s/i.test(trimmed) ||
    /^<!DOCTYPE/i.test(trimmed)
  ) {
    throw new Error(HTML_OR_TEXT_API_HINT);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `API の応答を JSON として解釈できませんでした（HTTP ${res.status}）。VITE_API_BASE_URL の設定を確認してください。`
    );
  }
}

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  /** デモセッションではクラウド一覧だけ空配列で返し、JSON エラーを避ける */
  if (
    isDemoSessionToken() &&
    path === "/api/projects" &&
    (options.method === undefined || options.method === "GET")
  ) {
    return [] as T;
  }
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as object),
  };
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  const url = `${base}${path}`;
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  const data = parseApiJsonBody(text, res);
  if (!res.ok) {
    const msg =
      typeof data.error === "string" && data.error
        ? data.error
        : res.statusText || "API error";
    throw new Error(msg);
  }
  return data as T;
}

/** 認証付きでバイナリを取得し、`blob:` URL を返す（呼び出し側で revoke 推奨） */
export async function fetchAuthorizedAudioBlobUrl(assetId: number): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  const res = await fetch(`${base}/api/audio/${assetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text();
    let msg = res.statusText;
    try {
      msg = JSON.parse(t).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const authApi = {
  register: (email: string, password: string) =>
    api<{ token: string; user: { id: number; email: string } }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  login: (email: string, password: string) =>
    api<{ token: string; user: { id: number; email: string } }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  me: () =>
    api<{
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
    }>("/api/auth/me"),
};

export type ProjectListItem = {
  id: number;
  name: string;
  updated_at: string;
  share_token?: string | null;
};

export type ProjectGetRow = {
  id: number;
  name: string;
  json: unknown;
  updated_at: string;
  share_token?: string | null;
};

export const projectApi = {
  list: async (): Promise<ProjectListItem[]> => {
    if (isDemoSessionToken()) return [];
    if (isSupabaseBackend()) {
      if (!getSupabaseAccessToken()) return [];
      return supabaseListProjects();
    }
    return api<ProjectListItem[]>("/api/projects");
  },
  get: async (id: number): Promise<ProjectGetRow> => {
    if (isSupabaseBackend() && !isDemoSessionToken()) {
      if (!getSupabaseAccessToken()) {
        throw new Error("ログインが必要です");
      }
      return supabaseGetProject(id);
    }
    const row = await api<{ id: number; name: string; json: unknown; updated_at: string }>(
      `/api/projects/${id}`
    );
    return { ...row, share_token: null };
  },
  getByShareToken: (shareToken: string) => {
    if (!isSupabaseBackend()) {
      return Promise.reject(
        new Error("共有リンク（閲覧専用）を使うには、VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してください。")
      );
    }
    return supabaseGetProjectByShareToken(shareToken);
  },
  create: async (name: string, json: unknown): Promise<ProjectListItem> => {
    if (isSupabaseBackend() && !isDemoSessionToken() && getSupabaseAccessToken()) {
      return supabaseCreateProject(name, json);
    }
    const row = await api<{ id: number; name: string; updated_at: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, json }),
    });
    return { ...row, share_token: null };
  },
  update: async (id: number, name: string, json: unknown): Promise<ProjectListItem> => {
    if (isSupabaseBackend() && !isDemoSessionToken() && getSupabaseAccessToken()) {
      return supabaseUpdateProject(id, name, json);
    }
    const row = await api<{ id: number; name: string; updated_at: string }>(
      `/api/projects/${id}`,
      { method: "PUT", body: JSON.stringify({ name, json }) }
    );
    return { ...row, share_token: null };
  },
  remove: async (id: number) => {
    if (isSupabaseBackend() && !isDemoSessionToken() && getSupabaseAccessToken()) {
      await supabaseDeleteProject(id);
      return;
    }
    await api<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" });
  },
  /** オーナーのみ。メールで協作者を追加 */
  addCollaborator: (projectId: number, email: string) => {
    if (isSupabaseBackend()) {
      return Promise.reject(
        new Error("共同編集のメール追加は、Supabase 本番接続時は未実装です（従来 API 利用時に利用可能）。")
      );
    }
    return api<{ ok: boolean; userId: number }>(
      `/api/projects/${projectId}/collaborators`,
      { method: "POST", body: JSON.stringify({ email }) }
    );
  },
};

export async function audioApiUpload(formData: FormData): Promise<{ id: number; mime: string }> {
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  const res = await fetch(`${base}/api/audio/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const text = await res.text();
  const data = parseApiJsonBody(text, res);
  if (!res.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) ||
        res.statusText ||
        "アップロード失敗"
    );
  }
  return data as { id: number; mime: string };
}

export const billingApi = {
  /** Stripe Checkout（サブスク）。レスポンスの url へリダイレクト */
  createCheckoutSession: () =>
    api<{ url: string }>("/api/billing/create-checkout-session", {
      method: "POST",
      body: "{}",
    }),
  placeholderPurchase: () =>
    api<{ ok: boolean; message?: string }>("/api/billing/placeholder-purchase", {
      method: "POST",
      body: "{}",
    }),
};
