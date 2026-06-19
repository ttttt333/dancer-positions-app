import { createClient } from "@supabase/supabase-js";

/** base64 文字列の上限（おおよそ 9MB の生画像相当） */
export const MAX_IMAGE_BASE64_LEN = 12 * 1024 * 1024;

const DEMO_SESSION_TOKEN = "__choreogrid_demo_session__";

/** @type {Map<string, { count: number; resetAt: number }>} */
const rateBuckets = new Map();

function supabaseAuthClient() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).trim();
  const key = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function extractBearerToken(req) {
  const h = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) {
    return h.slice(7).trim();
  }
  return null;
}

export function validateImageBase64(imageBase64) {
  if (!imageBase64) {
    return { ok: false, status: 400, error: "Image data is required" };
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LEN) {
    return {
      ok: false,
      status: 413,
      error: "Image is too large (max ~9MB)",
    };
  }
  return { ok: true };
}

/**
 * Supabase JWT を検証。本番 Vercel 向け。
 * @returns {Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }>}
 */
export async function verifyParseRouteAuth(req) {
  const token = extractBearerToken(req);
  if (!token || token === DEMO_SESSION_TOKEN) {
    return { ok: false, status: 401, error: "ログインが必要です" };
  }

  const sb = supabaseAuthClient();
  if (!sb) {
    return {
      ok: false,
      status: 503,
      error: "認証設定が未構成です（Supabase URL / anon key）",
    };
  }

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, error: "ログインが必要です" };
  }

  return { ok: true, userId: data.user.id };
}

export function checkParseRateLimit(clientKey, opts = {}) {
  const max = opts.max ?? 30;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  let bucket = rateBuckets.get(clientKey);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(clientKey, bucket);
  }
  bucket.count += 1;
  return bucket.count <= max;
}

function collectAllowedOrigins() {
  /** @type {string[]} */
  const allowed = [];
  for (const raw of [
    process.env.APP_BASE,
    process.env.PARSE_API_ALLOWED_ORIGINS,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ]) {
    if (!raw) continue;
    for (const part of String(raw).split(",")) {
      const trimmed = part.trim().replace(/\/+$/, "");
      if (trimmed) allowed.push(trimmed);
    }
  }
  return allowed;
}

/** 同一オリジンまたは許可リストのみ CORS を返す（`*` は使わない） */
export function setParseRouteCors(req, res) {
  const origin = req.headers?.origin;
  const allowed = collectAllowedOrigins();
  if (origin) {
    const normalized = origin.replace(/\/+$/, "");
    if (
      allowed.length === 0 ||
      allowed.some((a) => normalized === a || normalized.startsWith(`${a}/`))
    ) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
}
