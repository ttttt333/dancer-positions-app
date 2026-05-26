export type AppLocale = "ja" | "en" | "ko" | "zh" | "es" | "fr" | "de" | "pt";

export const APP_LOCALES: readonly AppLocale[] = [
  "ja",
  "en",
  "ko",
  "zh",
  "es",
  "fr",
  "de",
  "pt",
] as const;

export const LOCALE_STORAGE_KEY = "choreogrid_locale";

export function isAppLocale(v: string | null | undefined): v is AppLocale {
  return (
    v === "ja" ||
    v === "en" ||
    v === "ko" ||
    v === "zh" ||
    v === "es" ||
    v === "fr" ||
    v === "de" ||
    v === "pt"
  );
}
