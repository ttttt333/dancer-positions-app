/**
 * 新規登録通知のサンプルを interush.info@gmail.com へ送る。
 *
 * 優先順:
 *   1. RESEND_API_KEY があれば Resend で直接送信
 *   2. SIGNUP_NOTIFY_SECRET があれば Edge Function を呼ぶ
 *
 * 使い方: node scripts/send-signup-notify-sample.mjs
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function tokyo(iso) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

loadEnvFile();

const TO = (process.env.SIGNUP_NOTIFY_TO || "interush.info@gmail.com").trim();
const FROM = (
  process.env.SIGNUP_NOTIFY_FROM || "ChoreoCore <onboarding@resend.dev>"
).trim();
const createdAt = new Date().toISOString();
const when = tokyo(createdAt);
const subject = "【サンプル】【ChoreoCore】新規ユーザー登録: sample.user@example.com（日本）";
const text = [
  "これは通知メールのテスト送信です。",
  "",
  "メール: sample.user@example.com",
  "表示名: サンプル 花子",
  "登録方法: Google",
  "国・地域: 日本（JP）・接続元IPから推定",
  "ユーザーID: 00000000-0000-4000-8000-sample000001",
  `登録日時: ${when}（日本時間）`,
  "メール確認: 済み",
  "",
  "https://dancer-positions-app.vercel.app/",
].join("\n");
const html = `<!doctype html>
<html lang="ja">
<body style="margin:0;padding:24px;background:#0f1115;color:#e8e4d8;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#1a1c22;border:1px solid #3a3428;border-radius:12px;padding:24px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;color:#d4af37;">CHOREOCORE</p>
    <h1 style="margin:0 0 16px;font-size:18px;color:#f3ead2;">新規登録通知のサンプル</h1>
    <p style="margin:0 0 16px;font-size:13px;color:#c4bba8;">これはテスト送信です。本番では同じ形式で届きます。</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#9a9284;width:120px;">メール</td><td style="padding:8px 0;">sample.user@example.com</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">表示名</td><td style="padding:8px 0;">サンプル 花子</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">登録方法</td><td style="padding:8px 0;">Google</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">国・地域</td><td style="padding:8px 0;">日本（JP）・接続元IPから推定</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">ユーザーID</td><td style="padding:8px 0;font-family:ui-monospace,monospace;font-size:12px;">00000000-0000-4000-8000-sample000001</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">登録日時</td><td style="padding:8px 0;">${when}（日本時間）</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">メール確認</td><td style="padding:8px 0;">済み</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#9a9284;">
      <a href="https://dancer-positions-app.vercel.app/" style="color:#d4af37;">dancer-positions-app.vercel.app</a>
    </p>
  </div>
</body>
</html>`;

async function sendViaResend(apiKey) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, text }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `Resend ${res.status}`);
  }
  return json;
}

async function sendViaEdge(secret) {
  const url = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://iiziplsgfoijvnrsehms.supabase.co"
  ).replace(/\/+$/, "");
  const anon = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const res = await fetch(`${url}/functions/v1/notify-new-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-choreocore-notify-secret": secret,
      ...(anon ? { Authorization: `Bearer ${anon}`, apikey: anon } : {}),
    },
    body: JSON.stringify({ sample: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || json.message || `Edge ${res.status}`);
  }
  return json;
}

const resendKey = String(process.env.RESEND_API_KEY || "").trim();
const notifySecret = String(process.env.SIGNUP_NOTIFY_SECRET || "").trim();

try {
  if (resendKey) {
    const sent = await sendViaResend(resendKey);
    console.log(`sent via Resend to ${TO} id=${sent.id || "?"}`);
    process.exit(0);
  }
  if (notifySecret) {
    const sent = await sendViaEdge(notifySecret);
    console.log(`sent via Edge Function to ${sent.to || TO} id=${sent.id || "?"}`);
    process.exit(0);
  }
  console.error(
    "RESEND_API_KEY も SIGNUP_NOTIFY_SECRET もありません。.env に Resend の API キーを入れて再実行してください。"
  );
  process.exit(2);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
