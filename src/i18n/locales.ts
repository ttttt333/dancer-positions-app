import type { AppLocale } from "./types";

export interface LocaleInfo {
  code: AppLocale;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
  region: string;
}

export const LOCALE_INFO: Record<AppLocale, LocaleInfo> = {
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    rtl: false,
    region: "Asia",
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    rtl: false,
    region: "Global",
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    flag: "🇰🇷",
    rtl: false,
    region: "Asia",
  },
  zh: {
    code: "zh",
    name: "Chinese (Simplified)",
    nativeName: "简体中文",
    flag: "🇨🇳",
    rtl: false,
    region: "Asia",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    rtl: false,
    region: "Europe/Americas",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    rtl: false,
    region: "Europe",
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    rtl: false,
    region: "Europe",
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    flag: "🇮🇹",
    rtl: false,
    region: "Europe",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    flag: "🇵🇹",
    rtl: false,
    region: "Europe/Americas",
  },
  ru: {
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
    flag: "🇷🇺",
    rtl: false,
    region: "Europe/Asia",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    rtl: true,
    region: "Middle East/Africa",
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    rtl: false,
    region: "Asia",
  },
};

export function getBrowserLocale(): AppLocale {
  const browserLang = navigator.language.split("-")[0];
  return LOCALE_INFO[browserLang as AppLocale] ? browserLang as AppLocale : "en";
}

export function getLocaleByRegion(region: string): AppLocale[] {
  return Object.values(LOCALE_INFO)
    .filter(locale => locale.region.includes(region))
    .map(locale => locale.code);
}

export function isRTLLocale(locale: AppLocale): boolean {
  return LOCALE_INFO[locale].rtl;
}
