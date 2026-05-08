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
