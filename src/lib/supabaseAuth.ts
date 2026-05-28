import { getSupabase } from "./supabaseClient";

export type SocialAuthProvider = "google";

export const SOCIAL_AUTH_PROVIDERS: {
  id: SocialAuthProvider;
  labelKey: string;
}[] = [{ id: "google", labelKey: "auth.continueGoogle" }];

export function getAuthRedirectUrl(): string {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname || "/login";
  return `${window.location.origin}${path}`;
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(),
    },
  });
  if (error) throw error;
}

/** OAuth リダイレクト後の URL エラーを読み取り、表示用に返す */
export function parseAuthCallbackError(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  const search = window.location.search.startsWith("?")
    ? window.location.search.slice(1)
    : "";
  const params = new URLSearchParams(hash || search);
  const desc = params.get("error_description") || params.get("error");
  if (!desc) return null;
  return decodeURIComponent(desc.replace(/\+/g, " "));
}

export function clearAuthCallbackParams(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.hash && !url.search) return;
  url.hash = "";
  url.search = "";
  window.history.replaceState({}, "", url.pathname);
}

/** OAuth 成功後に残る #access_token=... を消し、再処理ループを防ぐ */
export function clearAuthSessionHashIfPresent(): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  if (
    !hash.includes("access_token=") &&
    !hash.includes("error=") &&
    !hash.includes("error_description=")
  ) {
    return;
  }
  clearAuthCallbackParams();
}
