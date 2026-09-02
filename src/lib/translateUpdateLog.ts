import type { AppLocale } from "../i18n/types";
import { APP_LOCALES } from "../i18n/types";
import {
  ensureSupabaseAccessToken,
  isSupabaseBackend,
} from "./supabaseClient";
import type { UpdateLogBodies } from "./updateLog";

const TARGETS = APP_LOCALES.filter((l): l is Exclude<AppLocale, "ja"> => l !== "ja");

/**
 * 日本語ソースを他言語へ翻訳する。失敗時は空（ja 以外なし）。
 * 公開自体は止めない。
 */
export async function translateUpdateLogBodies(
  japaneseSource: string
): Promise<UpdateLogBodies> {
  const ja = japaneseSource.trim();
  if (!ja) return { ja: japaneseSource };
  if (!isSupabaseBackend()) return { ja: japaneseSource };

  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseKey) return { ja: japaneseSource };

  const token = (await ensureSupabaseAccessToken()) || supabaseKey;
  const res = await fetch(`${supabaseUrl}/functions/v1/translate-update-log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body: japaneseSource }),
  });
  if (!res.ok) {
    throw new Error(`translate-update-log ${res.status}`);
  }
  const data = (await res.json()) as { bodies?: unknown };
  const raw =
    data.bodies && typeof data.bodies === "object" && !Array.isArray(data.bodies)
      ? (data.bodies as Record<string, unknown>)
      : {};
  const out: UpdateLogBodies = { ja: japaneseSource };
  for (const loc of TARGETS) {
    const v = raw[loc];
    if (typeof v === "string" && v.trim()) out[loc] = v;
  }
  return out;
}

export function updateLogHasOtherLocales(bodies: UpdateLogBodies): boolean {
  return TARGETS.some((loc) => Boolean(bodies[loc]?.trim()));
}
