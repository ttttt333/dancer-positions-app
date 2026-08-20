/** 新規登録通知メール本文 */

import type { SignupGeo, SignupGeoSource } from "./signupCountry";
import { formatSignupCountry, geoFromHints } from "./signupCountry";

export const SIGNUP_NOTIFY_TO = "interush.info@gmail.com";

export type SignupNotifyInfo = {
  email: string;
  userId: string;
  createdAt: string;
  provider: string;
  displayName: string;
  emailConfirmed: boolean;
  sample?: boolean;
  countryCode?: string;
  countryName?: string;
  timezone?: string;
  locale?: string;
  geoSource?: SignupGeoSource;
};

export function signupGeoFromInfo(info: SignupNotifyInfo): SignupGeo | null {
  return geoFromHints({
    countryCode: info.countryCode,
    timezone: info.timezone,
    locale: info.locale,
    source: info.geoSource,
  });
}

export function providerLabel(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p === "google") return "Google";
  if (p === "email" || p === "email_password") return "メール＋パスワード";
  return provider || "不明";
}

export function formatTokyo(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function buildSignupNotifyEmail(info: SignupNotifyInfo): {
  subject: string;
  text: string;
  html: string;
} {
  const when = formatTokyo(info.createdAt);
  const method = providerLabel(info.provider);
  const name = info.displayName.trim() || "（未設定）";
  const country = formatSignupCountry(signupGeoFromInfo(info));
  const prefix = info.sample ? "【サンプル】" : "";
  const countrySubject = info.countryCode
    ? `（${info.countryName || info.countryCode}）`
    : "";
  const subject = `${prefix}【ChoreoCore】新規ユーザー登録: ${info.email}${countrySubject}`;
  const text = [
    info.sample ? "これは通知メールのテスト送信です。" : "ChoreoCore に新しいユーザーが登録しました。",
    "",
    `メール: ${info.email}`,
    `表示名: ${name}`,
    `登録方法: ${method}`,
    `国・地域: ${country}`,
    `ユーザーID: ${info.userId}`,
    `登録日時: ${when}（日本時間）`,
    `メール確認: ${info.emailConfirmed ? "済み" : "未確認"}`,
    "",
    "https://dancer-positions-app.vercel.app/",
  ].join("\n");
  const html = `<!doctype html>
<html lang="ja">
<body style="margin:0;padding:24px;background:#0f1115;color:#e8e4d8;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#1a1c22;border:1px solid #3a3428;border-radius:12px;padding:24px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;color:#d4af37;">CHOREOCORE</p>
    <h1 style="margin:0 0 16px;font-size:18px;color:#f3ead2;">${info.sample ? "新規登録通知のサンプル" : "新規ユーザーが登録しました"}</h1>
    ${info.sample ? `<p style="margin:0 0 16px;font-size:13px;color:#c4bba8;">これはテスト送信です。本番では同じ形式で届きます。</p>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#9a9284;width:120px;">メール</td><td style="padding:8px 0;">${escapeHtml(info.email)}</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">表示名</td><td style="padding:8px 0;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">登録方法</td><td style="padding:8px 0;">${escapeHtml(method)}</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">国・地域</td><td style="padding:8px 0;">${escapeHtml(country)}</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">ユーザーID</td><td style="padding:8px 0;font-family:ui-monospace,monospace;font-size:12px;">${escapeHtml(info.userId)}</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">登録日時</td><td style="padding:8px 0;">${escapeHtml(when)}（日本時間）</td></tr>
      <tr><td style="padding:8px 0;color:#9a9284;">メール確認</td><td style="padding:8px 0;">${info.emailConfirmed ? "済み" : "未確認"}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#9a9284;">
      <a href="https://dancer-positions-app.vercel.app/" style="color:#d4af37;">dancer-positions-app.vercel.app</a>
    </p>
  </div>
</body>
</html>`;
  return { subject, text, html };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function sampleSignupNotifyInfo(): SignupNotifyInfo {
  return {
    email: "sample.user@example.com",
    userId: "00000000-0000-4000-8000-sample000001",
    createdAt: new Date().toISOString(),
    provider: "google",
    displayName: "サンプル 花子",
    emailConfirmed: true,
    sample: true,
    countryCode: "JP",
    countryName: "日本",
    timezone: "Asia/Tokyo",
    locale: "ja-JP",
    geoSource: "ip",
  };
}

export function infoFromAuthRecord(record: {
  id?: string;
  email?: string | null;
  created_at?: string | null;
  email_confirmed_at?: string | null;
  raw_app_meta_data?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}): SignupNotifyInfo {
  const app = record.raw_app_meta_data ?? record.app_metadata ?? {};
  const meta = record.raw_user_meta_data ?? record.user_metadata ?? {};
  const providers = app.providers;
  const providerFromList = Array.isArray(providers) ? String(providers[0] ?? "") : "";
  const provider = String(app.provider ?? providerFromList ?? "email") || "email";
  const displayName = String(meta.full_name ?? meta.name ?? meta.user_name ?? "").trim();
  const rawSource = String(meta.signup_geo_source ?? "").trim();
  const geoSource =
    rawSource === "ip" ||
    rawSource === "timezone" ||
    rawSource === "locale" ||
    rawSource === "unknown"
      ? rawSource
      : undefined;
  const geo = geoFromHints({
    countryCode: String(meta.signup_country_code ?? "").trim(),
    timezone: String(meta.signup_timezone ?? "").trim(),
    locale: String(meta.signup_locale ?? "").trim(),
    source: geoSource,
  });
  return {
    email: String(record.email ?? "").trim() || "(no email)",
    userId: String(record.id ?? ""),
    createdAt: record.created_at || new Date().toISOString(),
    provider,
    displayName,
    emailConfirmed: Boolean(record.email_confirmed_at),
    countryCode: geo?.countryCode,
    countryName: geo?.countryName,
    timezone: geo?.timezone,
    locale: geo?.locale,
    geoSource: geo?.source,
  };
}
