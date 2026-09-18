/** ログイン後に戻してよいアプリ内パスか */
export function isSafePostLoginPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.startsWith("/login") || path.startsWith("/register")) return false;
  return true;
}

const REDIRECT_KEY = "choreocore.postLoginRedirect";
const SAVE_INTENT_KEY = "choreocore.saveIntentAfterLogin";

export function stashPostLoginRedirect(path: string): void {
  if (!isSafePostLoginPath(path)) return;
  try {
    sessionStorage.setItem(REDIRECT_KEY, path);
  } catch {
    /* ignore */
  }
}

/** 消費して返す。無ければ fallback */
export function consumePostLoginRedirect(fallback = "/"): string {
  try {
    const raw = sessionStorage.getItem(REDIRECT_KEY);
    sessionStorage.removeItem(REDIRECT_KEY);
    if (raw && isSafePostLoginPath(raw)) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** ログイン後にクラウド保存を続けたいとき */
export function stashSaveIntentAfterLogin(): void {
  try {
    sessionStorage.setItem(SAVE_INTENT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function consumeSaveIntentAfterLogin(): boolean {
  try {
    const v = sessionStorage.getItem(SAVE_INTENT_KEY);
    sessionStorage.removeItem(SAVE_INTENT_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

/** location.state.from と session の両方から復帰先を決める */
export function resolvePostLoginTarget(
  stateFrom: unknown,
  fallback = "/"
): string {
  if (typeof stateFrom === "string" && isSafePostLoginPath(stateFrom)) {
    try {
      sessionStorage.removeItem(REDIRECT_KEY);
    } catch {
      /* ignore */
    }
    return stateFrom;
  }
  return consumePostLoginRedirect(fallback);
}
