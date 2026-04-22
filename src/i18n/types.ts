export type AppLocale = "ja" | "en" | "ko" | "zh";

export const APP_LOCALES: readonly AppLocale[] = ["ja", "en", "ko", "zh"] as const;

export const LOCALE_STORAGE_KEY = "choreogrid_locale";

export function isAppLocale(v: string | null | undefined): v is AppLocale {
  return v === "ja" || v === "en" || v === "ko" || v === "zh";
}
