import { getToken, isDemoSessionToken } from "../api/client";
import { ensureSupabaseAccessToken } from "./supabaseClient";

const LOGIN_REQUIRED_MSG =
  "ログインが必要です（写真解析はクラウドログイン後に利用できます）";

/** 立ち位置・名簿の Vision API 向け Authorization 付きヘッダー */
export async function parseApiRequestHeaders(): Promise<HeadersInit> {
  await ensureSupabaseAccessToken();
  const token = getToken();
  if (!token || isDemoSessionToken()) {
    throw new Error(LOGIN_REQUIRED_MSG);
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}
