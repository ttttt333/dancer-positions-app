import { getSupabase, isSupabaseBackend } from "./supabaseClient";

export type UpdateLogDoc = {
  body: string;
  updatedAt: string | null;
  canEdit: boolean;
  /** supabase / local / default */
  source: "supabase" | "local" | "default";
};

const LOCAL_KEY = "choreocore_update_log_v1";

export const DEFAULT_UPDATE_LOG_BODY = `# ChoreoCore アップデートログ

アプリのバージョンアップや修正内容をここに掲載します。

## 使い方
- 全員: このページで最新の状況を確認できます
- 管理人: 「編集」を押して文章を書き、「更新する」で保存できます

## 最近の更新
- （ここに追記してください）
`;

function parseAdminEmailsFromEnv(): string[] {
  const raw = String(import.meta.env.VITE_CHOREOCORE_ADMIN_EMAILS ?? "");
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** 編集 UI を出すか（保存権限はサーバ側 RPC が最終判定） */
export function canShowUpdateLogEditor(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  const admins = parseAdminEmailsFromEnv();
  const normalized = email.trim().toLowerCase();
  if (admins.length > 0) return admins.includes(normalized);
  // env 未設定時: 開発ビルドのみログインユーザーに編集 UI を出す
  return Boolean(import.meta.env.DEV);
}

function readLocalDoc(): UpdateLogDoc | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { body?: unknown; updatedAt?: unknown };
    if (typeof parsed.body !== "string") return null;
    return {
      body: parsed.body,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      canEdit: false,
      source: "local",
    };
  } catch {
    return null;
  }
}

function writeLocalDoc(body: string): UpdateLogDoc {
  const updatedAt = new Date().toISOString();
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ body, updatedAt }));
  return { body, updatedAt, canEdit: true, source: "local" };
}

function parseRpcPayload(
  data: unknown,
  source: UpdateLogDoc["source"]
): UpdateLogDoc | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (typeof o.body !== "string") return null;
  return {
    body: o.body,
    updatedAt:
      typeof o.updatedAt === "string"
        ? o.updatedAt
        : o.updatedAt != null
          ? String(o.updatedAt)
          : null,
    canEdit: o.canEdit === true,
    source,
  };
}

export async function fetchUpdateLog(
  viewerEmail?: string | null
): Promise<UpdateLogDoc> {
  const showEditor = canShowUpdateLogEditor(viewerEmail);

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("choreocore_get_update_log");
      if (!error) {
        const doc = parseRpcPayload(data, "supabase");
        if (doc) {
          return {
            ...doc,
            // サーバ canEdit か、クライアント管理者表示のどちらか
            canEdit: doc.canEdit || showEditor,
          };
        }
      }
    } catch {
      /* fall through */
    }
  }

  const local = readLocalDoc();
  if (local) {
    return { ...local, canEdit: showEditor };
  }

  return {
    body: DEFAULT_UPDATE_LOG_BODY,
    updatedAt: null,
    canEdit: showEditor,
    source: "default",
  };
}

export async function saveUpdateLog(
  body: string,
  viewerEmail?: string | null
): Promise<UpdateLogDoc> {
  if (!canShowUpdateLogEditor(viewerEmail)) {
    throw new Error("管理者権限がありません");
  }

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("choreocore_save_update_log", {
        p_body: body,
      });
      if (!error) {
        const doc = parseRpcPayload(data, "supabase");
        if (doc) return { ...doc, canEdit: true };
      }
      if (error) {
        // テーブル未作成時などはローカルへフォールバック
        const msg = error.message || "";
        if (!/permission|権限|管理者|ログイン/i.test(msg)) {
          return writeLocalDoc(body);
        }
        throw new Error(msg);
      }
    } catch (e) {
      if (e instanceof Error && /権限|ログイン|管理者/.test(e.message)) {
        throw e;
      }
      // ネットワーク等 → ローカル保存
      return writeLocalDoc(body);
    }
  }

  return writeLocalDoc(body);
}

export function formatUpdateLogUpdatedAt(iso: string | null): string {
  if (!iso) return "未更新";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
