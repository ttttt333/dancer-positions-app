import { getSupabase } from "./supabaseClient";
import { summarizeProjectJson, type ProjectListSummary } from "./projectListSummary";
import { assertCanCreateSupabaseProject, isFreeLimitError } from "./supabaseBilling";

export type ProjectRow = {
  id: number;
  name: string;
  json: unknown;
  updated_at: string;
  share_token: string | null;
};

export type ProjectListItem = {
  id: number;
  name: string;
  updated_at: string;
  share_token: string | null;
  /** 他のアカウントが作成し、編集用リンクで参加した作品 */
  is_shared?: boolean;
} & ProjectListSummary;

function mapListRow(
  r: {
    id: unknown;
    name: unknown;
    updated_at: unknown;
    share_token: unknown;
    user_id?: unknown;
    json: unknown;
  },
  myUserId: string | null
): ProjectListItem {
  const summary = summarizeProjectJson(r.json);
  return {
    id: Number(r.id),
    name: String(r.name),
    updated_at: String(r.updated_at),
    share_token: r.share_token != null ? String(r.share_token) : null,
    is_shared:
      myUserId != null && r.user_id != null && String(r.user_id) !== myUserId,
    ...summary,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function supabaseListProjects(): Promise<ProjectListItem[]> {
  const sb = getSupabase();
  const [{ data, error }, uid] = await Promise.all([
    sb
      .from("choreocore_projects")
      .select("id, name, updated_at, share_token, user_id, json")
      .order("updated_at", { ascending: false }),
    currentUserId(),
  ]);
  if (error) throw new Error(errMsg(error, "作品一覧の取得に失敗しました"));
  return (data ?? []).map((r) => mapListRow(r, uid));
}

function collabSchemaMissing(e: { message?: string; code?: string } | null): boolean {
  const m = e?.message ?? "";
  return (
    e?.code === "42703" ||
    e?.code === "PGRST202" ||
    e?.code === "42883" ||
    /edit_token|choreocore_join_project/.test(m)
  );
}

const COLLAB_SCHEMA_MISSING_MSG =
  "共同編集の設定がデータベースにまだありません。Supabase の SQL エディタで supabase/migrations/022_project_collaborators.up.sql を実行してください。";

/** 編集用リンクのトークン。未発行なら作成者が発行する（共同編集者は既存のものを読むだけ） */
export async function supabaseEnsureEditToken(
  id: number,
  opts?: { regenerate?: boolean }
): Promise<string | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("choreocore_projects")
    .select("edit_token, user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (collabSchemaMissing(error)) throw new Error(COLLAB_SCHEMA_MISSING_MSG);
    throw new Error(errMsg(error, "編集用リンクの取得に失敗しました"));
  }
  if (!data) throw new Error("作品が見つかりません");
  const current = data.edit_token != null ? String(data.edit_token) : null;
  if (current && !opts?.regenerate) return current;
  const uid = await currentUserId();
  if (uid == null || String(data.user_id) !== uid) return current;
  const next = newShareToken();
  const { error: upErr } = await sb
    .from("choreocore_projects")
    .update({ edit_token: next })
    .eq("id", id);
  if (upErr) throw new Error(errMsg(upErr, "編集用リンクの発行に失敗しました"));
  return next;
}

/** 編集用リンクから共同編集者として参加し、作品 ID を返す */
export async function supabaseJoinProjectByEditToken(token: string): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("choreocore_join_project", { t: token });
  if (error) {
    if (collabSchemaMissing(error)) throw new Error(COLLAB_SCHEMA_MISSING_MSG);
    if (/invalid_token/.test(error.message ?? "")) {
      throw new Error("編集用リンクが無効です。作成者に新しいリンクをもらってください。");
    }
    if (/login_required/.test(error.message ?? "")) {
      throw new Error("ログインが必要です");
    }
    throw new Error(errMsg(error, "共同編集への参加に失敗しました"));
  }
  const id = Number(data);
  if (!Number.isFinite(id) || id <= 0) throw new Error("共同編集への参加に失敗しました");
  return id;
}

function newShareToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function errMsg(e: { message?: string; code?: string } | null, fallback: string): string {
  if (e?.code === "PGRST205" || e?.message?.includes("choreocore_projects")) {
    return "Supabase に choreocore_projects テーブルがありません。Dashboard の SQL エディタで supabase/schema.sql を実行してください。";
  }
  if (e && typeof e.message === "string" && e.message) return e.message;
  return fallback;
}

export async function supabaseGetProject(id: number): Promise<ProjectRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("choreocore_projects")
    .select("id, name, json, updated_at, share_token")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(errMsg(error, "作品の読み込みに失敗しました"));
  if (!data) throw new Error("作品が見つかりません（未ログイン・権限・ID のいずれかの可能性があります）");
  return {
    id: Number(data.id),
    name: String(data.name),
    json: data.json,
    updated_at: String(data.updated_at),
    share_token: data.share_token != null ? String(data.share_token) : null,
  };
}

export async function supabaseGetProjectByShareToken(
  shareToken: string
): Promise<ProjectRow> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("get_project_by_share_token", {
    t: shareToken,
  });
  if (error) throw new Error(errMsg(error, "共有リンクの読み込みに失敗しました"));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.id == null) throw new Error("共有された作品が見つかりません");
  return {
    id: Number((row as { id: number }).id),
    name: String((row as { name: string }).name),
    json: (row as { project_json: unknown }).project_json,
    updated_at: new Date().toISOString(),
    share_token: shareToken,
  };
}

export async function supabaseCreateProject(
  name: string,
  json: unknown
): Promise<ProjectListItem> {
  const sb = getSupabase();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error("ログインが必要です");
  }

  const { count, error: countErr } = await sb
    .from("choreocore_projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userData.user.id);
  if (countErr) throw new Error(errMsg(countErr, "作品数の確認に失敗しました"));
  try {
    await assertCanCreateSupabaseProject(count ?? 0);
  } catch (e) {
    if (isFreeLimitError(e)) {
      throw new Error("free_limit: 無料プランの作品数上限（3作品）に達しました");
    }
    throw e;
  }

  const now = new Date().toISOString();
  const share = newShareToken();
  const { data, error } = await sb
    .from("choreocore_projects")
    .insert({
      user_id: userData.user.id,
      name: name.slice(0, 200),
      json,
      share_token: share,
      updated_at: now,
    })
    .select("id, name, updated_at, share_token")
    .single();
  if (error) throw new Error(errMsg(error, "新規保存に失敗しました"));
  if (!data) throw new Error("新規保存の応答が空です");
  return {
    id: Number(data.id),
    name: String(data.name),
    updated_at: String(data.updated_at),
    share_token: data.share_token != null ? String(data.share_token) : null,
    ...summarizeProjectJson(json),
  };
}

export async function supabaseUpdateProject(
  id: number,
  name: string,
  json: unknown
): Promise<ProjectListItem> {
  const sb = getSupabase();
  const { data: cur, error: e1 } = await sb
    .from("choreocore_projects")
    .select("share_token")
    .eq("id", id)
    .maybeSingle();
  if (e1) throw new Error(errMsg(e1, "作品の確認に失敗しました"));
  if (!cur) throw new Error("作品が見つかりません（上書きの権限がないか、ID が無効です）");
  let share: string | null = cur.share_token != null ? String(cur.share_token) : null;
  if (share == null) {
    share = newShareToken();
  }
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("choreocore_projects")
    .update({
      name: name.slice(0, 200),
      json,
      share_token: share,
      updated_at: now,
    })
    .eq("id", id)
    .select("id, name, updated_at, share_token")
    .single();
  if (error) throw new Error(errMsg(error, "上書き保存に失敗しました"));
  if (!data) throw new Error("上書きの応答が空です");
  return {
    id: Number(data.id),
    name: String(data.name),
    updated_at: String(data.updated_at),
    share_token: data.share_token != null ? String(data.share_token) : null,
    ...summarizeProjectJson(json),
  };
}

/** 作成者なら作品を削除、共同編集者なら自分を共同編集から外す */
export async function supabaseDeleteProject(id: number): Promise<void> {
  const sb = getSupabase();
  const uid = await currentUserId();
  const { data: row } = await sb
    .from("choreocore_projects")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (row && uid && String(row.user_id) !== uid) {
    const { error } = await sb
      .from("choreocore_project_members")
      .delete()
      .eq("project_id", id)
      .eq("user_id", uid);
    if (error) throw new Error(errMsg(error, "共同編集から外れられませんでした"));
    return;
  }
  const { error } = await sb.from("choreocore_projects").delete().eq("id", id);
  if (error) throw new Error(errMsg(error, "削除に失敗しました"));
}
