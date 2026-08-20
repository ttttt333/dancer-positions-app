/** 登録時の国・地域推定（パスポート上の国籍ではない） */

export type SignupGeoSource = "ip" | "timezone" | "locale" | "unknown";

export type SignupGeo = {
  countryCode: string;
  countryName: string;
  timezone: string;
  locale: string;
  source: SignupGeoSource;
};

const TZ_COUNTRY: Record<string, string> = {
  "Africa/Cairo": "EG",
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Mexico_City": "MX",
  "America/New_York": "US",
  "America/Sao_Paulo": "BR",
  "America/Santiago": "CL",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "Asia/Bangkok": "TH",
  "Asia/Dubai": "AE",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Hong_Kong": "HK",
  "Asia/Jakarta": "ID",
  "Asia/Kolkata": "IN",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Manila": "PH",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Singapore": "SG",
  "Asia/Taipei": "TW",
  "Asia/Tokyo": "JP",
  "Australia/Melbourne": "AU",
  "Australia/Sydney": "AU",
  "Europe/Amsterdam": "NL",
  "Europe/Berlin": "DE",
  "Europe/London": "GB",
  "Europe/Madrid": "ES",
  "Europe/Moscow": "RU",
  "Europe/Paris": "FR",
  "Europe/Rome": "IT",
  "Europe/Stockholm": "SE",
  "Europe/Warsaw": "PL",
  "Pacific/Auckland": "NZ",
  "Pacific/Honolulu": "US",
};

export function normalizeCountryCode(raw: string | null | undefined): string {
  const code = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return "";
  return code;
}

export function countryDisplayName(code: string): string {
  const cc = normalizeCountryCode(code);
  if (!cc) return "";
  try {
    const name = new Intl.DisplayNames(["ja"], { type: "region" }).of(cc);
    return String(name ?? cc);
  } catch {
    return cc;
  }
}

export function countryFromLocale(locale: string | null | undefined): string {
  const raw = String(locale ?? "").trim();
  if (!raw) return "";
  try {
    const region = new Intl.Locale(raw).maximize().region;
    return normalizeCountryCode(region);
  } catch {
    const m = raw.match(/[-_]([A-Za-z]{2})$/);
    return normalizeCountryCode(m?.[1]);
  }
}

export function countryFromTimezone(timeZone: string | null | undefined): string {
  const tz = String(timeZone ?? "").trim();
  if (!tz) return "";
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  const city = tz.split("/").pop() ?? "";
  for (const [key, code] of Object.entries(TZ_COUNTRY)) {
    if (key.endsWith(`/${city}`)) return code;
  }
  return "";
}

export function isPublicIp(ip: string): boolean {
  const v = ip.trim().replace(/^::ffff:/i, "");
  if (!v) return false;
  if (v === "::1") return false;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:")) return false;
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    return v.includes(":");
  }
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  return true;
}

export function parseClientIp(headers: {
  get(name: string): string | null;
}): string {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
    headers.get("x-vercel-forwarded-for")?.split(",")[0],
  ];
  for (const raw of candidates) {
    const ip = String(raw ?? "")
      .trim()
      .replace(/^\[|\]$/g, "");
    if (ip && isPublicIp(ip)) return ip;
  }
  return "";
}

export function geoFromHints(input: {
  countryCode?: string | null;
  timezone?: string | null;
  locale?: string | null;
  source?: SignupGeoSource;
}): SignupGeo | null {
  const timezone = String(input.timezone ?? "").trim();
  const locale = String(input.locale ?? "").trim();
  const fromInput = normalizeCountryCode(input.countryCode);
  const code =
    fromInput ||
    (input.source === "timezone" ? countryFromTimezone(timezone) : "") ||
    (input.source === "locale" ? countryFromLocale(locale) : "") ||
    countryFromTimezone(timezone) ||
    countryFromLocale(locale);
  if (!code) {
    if (!timezone && !locale) return null;
    return {
      countryCode: "",
      countryName: "",
      timezone,
      locale,
      source: "unknown",
    };
  }
  let source: SignupGeoSource = input.source ?? "unknown";
  if (!input.source || input.source === "unknown") {
    if (fromInput) source = "ip";
    else if (countryFromTimezone(timezone) === code) source = "timezone";
    else source = "locale";
  }
  return {
    countryCode: code,
    countryName: countryDisplayName(code),
    timezone,
    locale,
    source,
  };
}

export function formatSignupCountry(geo: SignupGeo | null | undefined): string {
  if (!geo?.countryCode) return "（未検出）";
  const name = geo.countryName || geo.countryCode;
  const src =
    geo.source === "ip"
      ? "接続元IPから推定"
      : geo.source === "timezone"
        ? "タイムゾーンから推定"
        : geo.source === "locale"
          ? "言語設定から推定"
          : "推定";
  return `${name}（${geo.countryCode}）・${src}`;
}

export function collectBrowserSignupHints(): { timezone: string; locale: string } {
  let timezone = "";
  let locale = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    timezone = "";
  }
  try {
    locale = typeof navigator !== "undefined" ? navigator.language || "" : "";
  } catch {
    locale = "";
  }
  return { timezone, locale };
}
