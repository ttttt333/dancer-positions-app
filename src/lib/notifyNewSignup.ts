import { getSupabase } from "./supabaseClient";

const NEW_USER_WINDOW_MS = 15 * 60 * 1000;

/** 新規登録直後だけ notify-new-user を呼ぶ。失敗しても登録自体は止めない。 */
export function notifyNewSignupIfNeeded(user: {
  id?: string;
  created_at?: string;
}): void {
  const userId = String(user.id ?? "").trim();
  if (!userId) return;
  const created = Date.parse(String(user.created_at ?? ""));
  if (!Number.isFinite(created) || Date.now() - created > NEW_USER_WINDOW_MS) {
    return;
  }
  try {
    const key = `choreocore-signup-notified:${userId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode でも通知は試みる */
  }
  try {
    void getSupabase()
      .functions.invoke("notify-new-user", { body: {} })
      .catch(() => {});
  } catch {
    /* 未設定・オフラインでも登録は止めない */
  }
}
