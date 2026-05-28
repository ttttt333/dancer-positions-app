import { isLegacyApiBaseConfigured } from "../api/client";
import { isSupabaseBackend } from "./supabaseClient";

function collabWsEnv(): string {
  return String(import.meta.env.VITE_COLLAB_WS || "").trim();
}

/** 共同編集 WebSocket の URL が明示設定されている */
export function isCollabWsConfigured(): boolean {
  return collabWsEnv() !== "";
}

/**
 * Yjs 共同編集が使える環境か。
 * Supabase 本番（Vercel 静的ホスト）では WS サーバーがなく、従来 JWT の Express API が必要。
 */
export function isCollabFeatureAvailable(): boolean {
  if (isCollabWsConfigured()) return true;
  if (isSupabaseBackend()) return false;
  if (import.meta.env.PROD) return isLegacyApiBaseConfigured();
  return true;
}
