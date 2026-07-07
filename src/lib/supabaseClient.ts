import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _accessToken: string | null = null;

export function isSupabaseBackend(): boolean {
  const u = import.meta.env.VITE_SUPABASE_URL;
  const k = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(String(u || "").trim() && String(k || "").trim());
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseBackend()) {
    throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です");
  }
  if (!_client) {
    _client = createClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_ANON_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
    );
  }
  return _client;
}

export function getSupabaseAccessToken(): string | null {
  return _accessToken;
}

export function setSupabaseAccessToken(t: string | null): void {
  _accessToken = t;
}

/** メモリ上のトークンが未設定でも Supabase クライアントのセッションから復元する */
export async function ensureSupabaseAccessToken(): Promise<string | null> {
  if (_accessToken) return _accessToken;
  if (!isSupabaseBackend()) return null;
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token ?? null;
    setSupabaseAccessToken(token);
    return token;
  } catch {
    return null;
  }
}

/**
 * Storage 操作直前に呼ぶ。メモリキャッシュに頼らず getSession でセッションを検証する
 * （autoRefreshToken により期限切れならクライアント側で更新される）。
 */
export async function requireSupabaseAuthSession(): Promise<boolean> {
  if (!isSupabaseBackend()) return false;
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error || !data.session?.access_token) {
      setSupabaseAccessToken(null);
      return false;
    }
    setSupabaseAccessToken(data.session.access_token);
    return true;
  } catch {
    setSupabaseAccessToken(null);
    return false;
  }
}
