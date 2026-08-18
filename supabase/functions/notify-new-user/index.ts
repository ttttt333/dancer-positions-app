/**
 * notify-new-user — 新規登録を interush.info@gmail.com へ通知
 *
 * Secrets:
 *   RESEND_API_KEY
 *   SIGNUP_NOTIFY_SECRET … DB webhook / サンプル送信用
 *   SIGNUP_NOTIFY_TO … 省略時 interush.info@gmail.com
 *   SIGNUP_NOTIFY_FROM … 省略時 ChoreoCore <beth.t@example.com>
 *
 * 呼び出し:
 *   - ログイン直後のクライアント（JWT）
 *   - auth.users INSERT の pg_net webhook（x-choreocore-notify-secret）
 *   - { "sample": true } + secret（テスト送信）
 */

// @ts-ignore Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS_HEADERS, createServiceClient, jsonResponse } from "../_shared/admin.ts";
import { getUserFromAuthHeader } from "../_shared/billing.ts";
import {
  SIGNUP_NOTIFY_TO,
  buildSignupNotifyEmail,
  infoFromAuthRecord,
  sampleSignupNotifyInfo,
  type SignupNotifyInfo,
} from "../_shared/signupNotifyEmail.ts";

// @ts-ignore Deno
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// @ts-ignore Deno
const SIGNUP_NOTIFY_SECRET = Deno.env.get("SIGNUP_NOTIFY_SECRET") ?? "";
// @ts-ignore Deno
const SIGNUP_NOTIFY_TO_ENV = (Deno.env.get("SIGNUP_NOTIFY_TO") ?? SIGNUP_NOTIFY_TO).trim();
// @ts-ignore Deno
const SIGNUP_NOTIFY_FROM =
  (Deno.env.get("SIGNUP_NOTIFY_FROM") ?? "ChoreoCore <beth.t@example.com>").trim();
// @ts-ignore Deno
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  ...CORS_HEADERS,
  "Access-Control-Allow-Headers":
    `${CORS_HEADERS["Access-Control-Allow-Headers"]}, x-choreocore-notify-secret`,
};

function hasSecret(req: Request): boolean {
  const header = (req.headers.get("x-choreocore-notify-secret") ?? "").trim();
  if (SIGNUP_NOTIFY_SECRET && header && header === SIGNUP_NOTIFY_SECRET) return true;
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return Boolean(SERVICE_ROLE_KEY && auth && auth === SERVICE_ROLE_KEY);
}

async function sendResend(info: SignupNotifyInfo): Promise<{ id?: string }> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const mail = buildSignupNotifyEmail(info);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SIGNUP_NOTIFY_FROM,
      to: [SIGNUP_NOTIFY_TO_ENV],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    throw new Error(json.message || `Resend ${res.status}`);
  }
  return json;
}

async function markSent(userId: string): Promise<boolean> {
  if (!userId) return true;
  const admin = await createServiceClient();
  const { error } = await admin.from("choreocore_signup_notices").insert({ user_id: userId });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[notify-new-user] dedup insert", error);
  return true;
}

async function unmarkSent(userId: string): Promise<void> {
  if (!userId) return;
  const admin = await createServiceClient();
  await admin.from("choreocore_signup_notices").delete().eq("user_id", userId);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    if (body.sample === true) {
      if (!hasSecret(req)) {
        return jsonResponse({ error: "サンプル送信にはシークレットが必要です" }, 401);
      }
      const info = sampleSignupNotifyInfo();
      const sent = await sendResend(info);
      return jsonResponse({ ok: true, sample: true, to: SIGNUP_NOTIFY_TO_ENV, id: sent.id });
    }

    let info: SignupNotifyInfo | null = null;
    const record = (body.record ?? body) as Record<string, unknown>;
    if (hasSecret(req) && typeof record.email === "string") {
      info = infoFromAuthRecord(record);
    } else {
      const user = await getUserFromAuthHeader(req);
      if (!user) {
        return jsonResponse({ error: "ログインが必要です" }, 401);
      }
      const admin = await createServiceClient();
      const { data, error } = await admin.auth.admin.getUserById(user.id);
      if (error || !data.user) {
        return jsonResponse({ error: error?.message ?? "user lookup failed" }, 500);
      }
      const u = data.user;
      info = infoFromAuthRecord({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        raw_app_meta_data: u.app_metadata as Record<string, unknown>,
        raw_user_meta_data: u.user_metadata as Record<string, unknown>,
      });
      const createdAt = Date.parse(info.createdAt);
      if (Number.isFinite(createdAt) && Date.now() - createdAt > 30 * 60 * 1000) {
        return jsonResponse({ ok: true, skipped: "not_new" });
      }
    }

    if (!info?.userId) {
      return jsonResponse({ error: "user id missing" }, 400);
    }

    const first = await markSent(info.userId);
    if (!first) {
      return jsonResponse({ ok: true, skipped: "already_notified" });
    }

    try {
      const sent = await sendResend(info);
      return jsonResponse({ ok: true, to: SIGNUP_NOTIFY_TO_ENV, id: sent.id });
    } catch (sendErr) {
      await unmarkSent(info.userId);
      throw sendErr;
    }
  } catch (e) {
    console.error("[notify-new-user]", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "通知に失敗しました" },
      500
    );
  }
});
