import {
  ensureSupabaseAccessToken,
  getSupabaseAccessToken,
  isSupabaseBackend,
} from "../lib/supabaseClient";
import { compressAudioFileToMp3ForUpload } from "../lib/compressAudioToMp3";
import { supabaseUploadProjectAudio } from "../lib/supabaseAudio";
import {
  supabaseCreateProject,
  supabaseDeleteProject,
  supabaseGetProject,
  supabaseGetProjectByShareToken,
  supabaseListProjects,
  supabaseUpdateProject,
  type ProjectListItem as SupabaseProjectListItem,
} from "../lib/supabaseProjects";
import {
  supabaseCreateCheckoutSession,
  supabaseOpenCustomerPortal,
  supabaseVerifyCheckoutSession,
} from "../lib/supabaseBilling";
import { summarizeProjectJson } from "../lib/projectListSummary";

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

/**
 * 従来 Express API を **別 URL** に向けている（ローカル以外の本番用）。
 * 未設定時は `fetch("/api/...")`（Vite 開発のプロキシ用）。静的ホスト単体では API なし。
 */
export function isLegacyApiBaseConfigured(): boolean {
  return apiBaseUrl() !== "";
}

/**
 * 本番で静的ホスティングかつ Supabase も従来 API も未設定。開発では常に false（Vite プロキシ利用のため）。
 */
export function isProdBuildMissingCloudAuth(): boolean {
  return import.meta.env.PROD && !isSupabaseBackend() && !isLegacyApiBaseConfigured();
}

const CONFIG_MISSING_MSG =
  "このデプロイのビルドに Supabase の URL・キーが含まれていません。Vercel（など）の Project → Settings → Environment Variables に " +
  "VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を入れ、Production にチェックを付け、Save 後「Redeploy」を実行してください。";

/** ログイン/登録画面用。Vercel に VITE_SUPABASE_* が焼いていないとき案内文として表示 */
export const CLOUD_AUTH_CONFIG_MISSING_MESSAGE = CONFIG_MISSING_MSG;

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
  const { blobUrl } = await fetchAuthorizedAudio(assetId);
  return blobUrl;
}

/** 認証付き音源を 1 回の取得で blob URL と ArrayBuffer の両方返す（再生・必要時のみデコード用） */
export async function fetchAuthorizedAudio(
  assetId: number,
  onDownloadProgress?: (ratio: number) => void,
  signal?: AbortSignal
): Promise<{ blobUrl: string; buffer: ArrayBuffer }> {
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  if (signal?.aborted) {
    throw new DOMException("Fetch aborted", "AbortError");
  }

  const {
    getCachedAudioBlob,
    putCachedAudioBlob,
    waveMediaCacheKeyForServerAsset,
  } = await import("../lib/waveMediaCache");
  const mediaCacheKey = waveMediaCacheKeyForServerAsset(assetId);
  const cached = await getCachedAudioBlob(mediaCacheKey);
  if (cached) {
    if (signal?.aborted) {
      throw new DOMException("Fetch aborted", "AbortError");
    }
    onDownloadProgress?.(1);
    const buffer = await cached.blob.arrayBuffer();
    const blobUrl = URL.createObjectURL(
      new Blob([buffer], { type: cached.mime })
    );
    return { blobUrl, buffer };
  }

  const res = await fetch(`${base}/api/audio/${assetId}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
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
  const { readResponseArrayBufferWithProgress } = await import(
    "../lib/fetchWithProgress"
  );
  const buffer = await readResponseArrayBufferWithProgress(
    res,
    onDownloadProgress,
    signal
  );
  const mime = res.headers.get("content-type") || "audio/mpeg";
  const blob = new Blob([buffer], { type: mime });
  void putCachedAudioBlob(mediaCacheKey, blob, mime);
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, buffer };
}

/** 従来 API の音源バイナリ（`VITE_API_BASE_URL` プレフィックス付き） */
export async function fetchLegacyAudioArrayBuffer(assetId: number): Promise<ArrayBuffer> {
  const { buffer } = await fetchAuthorizedAudio(assetId);
  return buffer;
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

export type ProjectListItem = SupabaseProjectListItem;

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
      if (!(await ensureSupabaseAccessToken())) return [];
      return supabaseListProjects();
    }
    const rows = await api<
      Array<{ id: number; name: string; updated_at: string; json: unknown }>
    >("/api/projects");
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      updated_at: r.updated_at,
      share_token: null,
      ...summarizeProjectJson(r.json),
    }));
  },
  get: async (id: number): Promise<ProjectGetRow> => {
    if (isSupabaseBackend() && !isDemoSessionToken()) {
      if (!(await ensureSupabaseAccessToken())) {
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
    if (isSupabaseBackend() && !isDemoSessionToken() && (await ensureSupabaseAccessToken())) {
      return supabaseCreateProject(name, json);
    }
    const row = await api<{ id: number; name: string; updated_at: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name, json }),
    });
    return { ...row, share_token: null, ...summarizeProjectJson(json) };
  },
  update: async (id: number, name: string, json: unknown): Promise<ProjectListItem> => {
    if (isSupabaseBackend() && !isDemoSessionToken() && (await ensureSupabaseAccessToken())) {
      return supabaseUpdateProject(id, name, json);
    }
    const row = await api<{ id: number; name: string; updated_at: string }>(
      `/api/projects/${id}`,
      { method: "PUT", body: JSON.stringify({ name, json }) }
    );
    return { ...row, share_token: null, ...summarizeProjectJson(json) };
  },
  remove: async (id: number) => {
    if (isSupabaseBackend() && !isDemoSessionToken() && (await ensureSupabaseAccessToken())) {
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

export type AudioApiUploadResult =
  | { kind: "legacy"; id: number; mime: string }
  | { kind: "supabase"; path: string; mime: string };

export async function audioApiUpload(
  formData: FormData,
  onMp3Progress?: (ratio: number, message: string) => void
): Promise<AudioApiUploadResult> {
  const token = getToken();
  if (!token) throw new Error("ログインが必要です");
  const file = formData.get("file");
  const projectIdRaw = formData.get("projectId");
  if (!(file instanceof File)) {
    throw new Error("ファイルがありません");
  }
  if (isSupabaseBackend()) {
    const pid = Number(projectIdRaw);
    if (!Number.isFinite(pid) || pid <= 0) {
      throw new Error("作品を保存してから音源を取り込んでください（作品 ID が必要です）");
    }
    onMp3Progress?.(0.05, "MP3 に変換中…");
    const mp3File = await compressAudioFileToMp3ForUpload(file, (ratio, msg) => {
      onMp3Progress?.(0.05 + ratio * 0.35, msg);
    });
    const { path, mime } = await supabaseUploadProjectAudio({
      projectId: pid,
      file: mp3File,
      filename: mp3File.name || "audio.mp3",
      contentType: "audio/mpeg",
    });
    return { kind: "supabase", path, mime };
  }
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
  const row = data as { id?: unknown; mime?: unknown };
  const id = typeof row.id === "number" ? row.id : Number(row.id);
  const mime = typeof row.mime === "string" ? row.mime : "audio/mpeg";
  if (!Number.isFinite(id)) {
    throw new Error("アップロード結果が不正です");
  }
  return { kind: "legacy", id, mime };
}

export const billingApi = {
  /** Stripe Checkout（サブスク）。レスポンスの url へリダイレクト */
  createCheckoutSession: () =>
    isSupabaseBackend()
      ? supabaseCreateCheckoutSession()
      : api<{ url: string }>("/api/billing/create-checkout-session", {
          method: "POST",
          body: "{}",
        }),
  verifyCheckoutSession: (sessionId: string) =>
    isSupabaseBackend()
      ? supabaseVerifyCheckoutSession(sessionId)
      : api<{ ok: boolean; status?: string }>("/api/billing/verify-session", {
          method: "POST",
          body: JSON.stringify({ session_id: sessionId }),
        }),
  openCustomerPortal: () =>
    isSupabaseBackend()
      ? supabaseOpenCustomerPortal()
      : Promise.reject(
          new Error(
            "契約管理は Supabase バックエンドでのみ利用できます"
          )
        ),
  placeholderPurchase: () =>
    api<{ ok: boolean; message?: string }>("/api/billing/placeholder-purchase", {
      method: "POST",
      body: "{}",
    }),
};
