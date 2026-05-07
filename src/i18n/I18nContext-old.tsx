import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { interpolate } from "./interpolate";
import { EXTENDED_TRANSLATIONS } from "./translations-extended";
import { isAppLocale, LOCALE_STORAGE_KEY, type AppLocale } from "./types";
import { getBrowserLocale } from "./locales";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

import { safeGetItem, safeSetItem } from "../utils/storage";

function readInitialLocale(): AppLocale {
  try {
    // 1. ユーザーが明示的に設定した言語を優先
    const saved = safeGetItem(LOCALE_STORAGE_KEY, null as any);
    if (isAppLocale(saved)) return saved;
    
    // 2. ブラウザの言語設定を次に優先
    const browserLocale = getBrowserLocale();
    if (isAppLocale(browserLocale)) return browserLocale;
  } catch {
    /* ignore */
  }
  return "ja";
}

function htmlLangFor(locale: AppLocale): string {
  if (locale === "zh") return "zh-Hans";
  return locale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(readInitialLocale);

  useEffect(() => {
    document.documentElement.lang = htmlLangFor(locale);
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    safeSetItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = htmlLangFor(next);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const bundle = EXTENDED_TRANSLATIONS[locale] ?? EXTENDED_TRANSLATIONS.ja;
      const fallback = EXTENDED_TRANSLATIONS.ja[key];
      const raw = bundle[key] ?? fallback ?? key;
      return interpolate(raw, params);
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
