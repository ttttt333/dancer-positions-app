/** 管理者向け Edge Function 共通 */

// @ts-ignore Deno
import { CORS_HEADERS, getUserFromAuthHeader, jsonResponse } from "./billing.ts";

// @ts-ignore Deno
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// @ts-ignore Deno
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// @ts-ignore Deno
const ADMIN_EMAILS_RAW = Deno.env.get("CHOREOCORE_ADMIN_EMAILS") ?? "";

export type GrantType = "complimentary" | "beta" | "partner" | "staff";

export type AdminGrantBody = {
  action?: "grant" | "revoke" | "list";
  email?: string;
  userId?: string;
  grantId?: number;
  grantType?: GrantType;
  expiresAt?: string | null;
  note?: string;
  limit?: number;
};

export function requireAdminConfig(): string | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return "Supabase service role not configured";
  }
  if (!parseAdminEmails().length) {
    return "CHOREOCORE_ADMIN_EMAILS not configured";
  }
  return null;
}

export function parseAdminEmails(): string[] {
  return ADMIN_EMAILS_RAW.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = parseAdminEmails();
  if (!admins.length) return false;
  return admins.includes(email.trim().toLowerCase());
}

export async function requireAdminUser(
  req: Request
): Promise<{ id: string; email: string } | Response> {
  const user = await getUserFromAuthHeader(req);
  if (!user) {
    return jsonResponse({ error: "ログインが必要です" }, 401);
  }
  if (!isAdminEmail(user.email)) {
    return jsonResponse({ error: "管理者権限がありません" }, 403);
  }
  return user;
}

export async function createServiceClient() {
  // @ts-ignore Deno
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function resolveTargetUserId(
  admin: Awaited<ReturnType<typeof createServiceClient>>,
  opts: { email?: string; userId?: string }
): Promise<string | null> {
  const userId = opts.userId?.trim();
  if (userId) return userId;

  const email = opts.email?.trim();
  if (!email) return null;

  const { data, error } = await admin.rpc("choreocore_lookup_user_id_by_email", {
    p_email: email,
  });
  if (error) throw new Error(error.message);
  return typeof data === "string" && data.length > 0 ? data : null;
}

export { CORS_HEADERS, jsonResponse };
