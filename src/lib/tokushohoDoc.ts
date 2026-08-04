import { buildDefaultTokushohoBody } from "./commercialDisclosure";
import { getSupabase, isSupabaseBackend } from "./supabaseClient";
import { canShowUpdateLogEditor } from "./updateLog";

export type TokushohoDoc = {
  body: string;
  updatedAt: string | null;
  canEdit: boolean;
  source: "supabase" | "local" | "default";
};

const LOCAL_KEY = "choreocore_tokushoho_v1";

export const DEFAULT_TOKUSHOHO_BODY = buildDefaultTokushohoBody();

function readLocalDoc(): TokushohoDoc | null {
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

function writeLocalDoc(body: string): TokushohoDoc {
  const updatedAt = new Date().toISOString();
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ body, updatedAt }));
  return { body, updatedAt, canEdit: true, source: "local" };
}

function parseRpcPayload(
  data: unknown,
  source: TokushohoDoc["source"]
): TokushohoDoc | null {
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

export async function fetchTokushoho(
  viewerEmail?: string | null
): Promise<TokushohoDoc> {
  const showEditor = canShowUpdateLogEditor(viewerEmail);

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("choreocore_get_tokushoho");
      if (!error) {
        const doc = parseRpcPayload(data, "supabase");
        if (doc) {
          return {
            ...doc,
            canEdit: doc.canEdit || showEditor,
            body: doc.body.trim() ? doc.body : DEFAULT_TOKUSHOHO_BODY,
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
    body: DEFAULT_TOKUSHOHO_BODY,
    updatedAt: null,
    canEdit: showEditor,
    source: "default",
  };
}

export async function saveTokushoho(
  body: string,
  viewerEmail?: string | null
): Promise<TokushohoDoc> {
  if (!canShowUpdateLogEditor(viewerEmail)) {
    throw new Error("管理者権限がありません");
  }

  if (isSupabaseBackend()) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("choreocore_save_tokushoho", {
        p_body: body,
      });
      if (!error) {
        const doc = parseRpcPayload(data, "supabase");
        if (doc) return { ...doc, canEdit: true };
      }
      if (error) {
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
      return writeLocalDoc(body);
    }
  }

  return writeLocalDoc(body);
}

export function formatTokushohoUpdatedAt(iso: string | null): string {
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
