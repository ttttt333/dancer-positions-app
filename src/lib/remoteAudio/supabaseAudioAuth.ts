import { getToken } from "../../api/client";
import { ensureSupabaseAccessToken } from "../supabaseClient";
import { reportWaveLoadError } from "../waveLoadProgress";

/** エディタ向け Supabase 音源ロードの認証ゲート */
export async function ensureSupabaseAudioAuth(
  authReady: boolean
): Promise<boolean> {
  if (!authReady) return false;
  if ((await ensureSupabaseAccessToken()) || getToken()) return true;
  reportWaveLoadError("ログイン後に音源を読み込めます");
  return false;
}
