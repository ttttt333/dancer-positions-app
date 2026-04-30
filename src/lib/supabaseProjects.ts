import { getSupabase } from "./supabaseClient";

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
};

function newShareToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function errMsg(e: { message?: string; code?: string } | null, fallback: string): string {
  if (e && typeof e.message === "string" && e.message) return e.message;
  return fallback;
}

export async function supabaseListProjects(): Promise<ProjectListItem[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("projects")
    .select("id, name, updated_at, share_token")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(errMsg(error, "作品一覧の取得に失敗しました"));
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    updated_at: String(r.updated_at),
    share_token: r.share_token != null ? String(r.share_token) : null,
  }));
}

export async function supabaseGetProject(id: number): Promise<ProjectRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("projects")
    .select("id, name, json, updated_at, share_token")
    .eq("id", id)
    .single();
  if (error) throw new Error(errMsg(error, "作品の読み込みに失敗しました"));
  if (!data) throw new Error("作品が見つかりません");
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
  const now = new Date().toISOString();
  const share = newShareToken();
  const { data, error } = await sb
    .from("projects")
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
  };
}

export async function supabaseUpdateProject(
  id: number,
  name: string,
  json: unknown
): Promise<ProjectListItem> {
  const sb = getSupabase();
  const { data: cur, error: e1 } = await sb
    .from("projects")
    .select("share_token")
    .eq("id", id)
    .single();
  if (e1) throw new Error(errMsg(e1, "作品の確認に失敗しました"));
  let share: string | null = cur?.share_token != null ? String(cur.share_token) : null;
  if (share == null) {
    share = newShareToken();
  }
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("projects")
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
  };
}

export async function supabaseDeleteProject(id: number): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) throw new Error(errMsg(error, "削除に失敗しました"));
}
