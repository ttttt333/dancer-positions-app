/**
 * notify-new-user — 新規登録を interush.info@gmail.com へ通知
 *
 * Secrets:
 *   RESEND_API_KEY
 *   SIGNUP_NOTIFY_SECRET … DB webhook / サンプル送信用
 *   SIGNUP_NOTIFY_TO … 省略時 interush.info@gmail.com
 *   SIGNUP_NOTIFY_FROM … 省略時 ChoreoCore <onboarding@resend.dev>
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
import {
  countryDisplayName,
  geoFromHints,
  normalizeCountryCode,
  parseClientIp,
  type SignupGeo,
} from "../_shared/signupCountry.ts";

// @ts-ignore Deno
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// @ts-ignore Deno
const SIGNUP_NOTIFY_SECRET = Deno.env.get("SIGNUP_NOTIFY_SECRET") ?? "";
// @ts-ignore Deno
const SIGNUP_NOTIFY_TO_ENV = (Deno.env.get("SIGNUP_NOTIFY_TO") ?? SIGNUP_NOTIFY_TO).trim();
// @ts-ignore Deno
const SIGNUP_NOTIFY_FROM =
  (Deno.env.get("SIGNUP_NOTIFY_FROM") ?? "ChoreoCore <onboarding@resend.dev>").trim();
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

async function lookupCountryByIp(ip: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      country_code?: string;
    };
    if (json.success === false) return "";
    return normalizeCountryCode(json.country_code);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function resolveGeo(opts: {
  req: Request;
  allowIpLookup: boolean;
  timezone?: string;
  locale?: string;
  existing?: SignupNotifyInfo | null;
}): Promise<SignupGeo | null> {
  const timezone = String(opts.timezone || opts.existing?.timezone || "").trim();
  const locale = String(opts.locale || opts.existing?.locale || "").trim();
  let ipCountry = "";
  if (opts.allowIpLookup) {
    ipCountry = normalizeCountryCode(
      opts.req.headers.get("cf-ipcountry") ||
        opts.req.headers.get("x-vercel-ip-country") ||
        opts.req.headers.get("x-country-code")
    );
    if (!ipCountry) {
      const ip = parseClientIp(opts.req.headers);
      if (ip) ipCountry = await lookupCountryByIp(ip);
    }
  }
  return geoFromHints({
    countryCode: ipCountry || opts.existing?.countryCode,
    timezone,
    locale,
    source: ipCountry ? "ip" : opts.existing?.geoSource,
  });
}

function applyGeo(info: SignupNotifyInfo, geo: SignupGeo | null): SignupNotifyInfo {
  if (!geo) return info;
  return {
    ...info,
    countryCode: geo.countryCode || info.countryCode,
    countryName: geo.countryName || info.countryName || countryDisplayName(geo.countryCode),
    timezone: geo.timezone || info.timezone,
    locale: geo.locale || info.locale,
    geoSource: geo.source || info.geoSource,
  };
}

async function persistGeo(userId: string, geo: SignupGeo | null, meta: Record<string, unknown>) {
  if (!userId || !geo) return;
  try {
    const admin = await createServiceClient();
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...meta,
        signup_country_code: geo.countryCode || meta.signup_country_code,
        signup_country_name: geo.countryName || meta.signup_country_name,
        signup_timezone: geo.timezone || meta.signup_timezone,
        signup_locale: geo.locale || meta.signup_locale,
        signup_geo_source: geo.source || meta.signup_geo_source,
      },
    });
  } catch (e) {
    console.error("[notify-new-user] persist geo", e);
  }
}

async function markSent(userId: string, geo: SignupGeo | null): Promise<boolean> {
  if (!userId) return true;
  const admin = await createServiceClient();
  const payload = {
    user_id: userId,
    country_code: geo?.countryCode || null,
    country_name: geo?.countryName || null,
    timezone: geo?.timezone || null,
    locale: geo?.locale || null,
    geo_source: geo?.source || null,
  };
  const { data: existing } = await admin
    .from("choreocore_signup_notices")
    .select("user_id, country_code")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    if (!existing.country_code && geo?.countryCode) {
      await admin.from("choreocore_signup_notices").update(payload).eq("user_id", userId);
    }
    return false;
  }
  const { error } = await admin.from("choreocore_signup_notices").insert(payload);
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
    let existingMeta: Record<string, unknown> = {};
    const webhookRecord = body.record;
    const isWebhook =
      hasSecret(req) &&
      webhookRecord !== null &&
      typeof webhookRecord === "object" &&
      typeof (webhookRecord as { email?: unknown }).email === "string";
    const timezone = String(body.timezone ?? "").trim();
    const locale = String(body.locale ?? "").trim();

    if (isWebhook) {
      info = infoFromAuthRecord(webhookRecord as Record<string, unknown>);
      existingMeta =
        ((webhookRecord as { raw_user_meta_data?: Record<string, unknown> }).raw_user_meta_data ??
          {}) as Record<string, unknown>;
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
      existingMeta = (u.user_metadata ?? {}) as Record<string, unknown>;
      info = infoFromAuthRecord({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        raw_app_meta_data: u.app_metadata as Record<string, unknown>,
        raw_user_meta_data: existingMeta,
      });
      const createdAt = Date.parse(info.createdAt);
      if (Number.isFinite(createdAt) && Date.now() - createdAt > 30 * 60 * 1000) {
        return jsonResponse({ ok: true, skipped: "not_new" });
      }
    }

    if (!info?.userId) {
      return jsonResponse({ error: "user id missing" }, 400);
    }

    const geo = await resolveGeo({
      req,
      allowIpLookup: !isWebhook,
      timezone,
      locale,
      existing: info,
    });
    info = applyGeo(info, geo);
    await persistGeo(info.userId, geo, existingMeta);

    const first = await markSent(info.userId, geo);
    if (!first) {
      return jsonResponse({
        ok: true,
        skipped: "already_notified",
        country: info.countryCode || null,
      });
    }

    try {
      const sent = await sendResend(info);
      return jsonResponse({
        ok: true,
        to: SIGNUP_NOTIFY_TO_ENV,
        id: sent.id,
        country: info.countryCode || null,
      });
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
