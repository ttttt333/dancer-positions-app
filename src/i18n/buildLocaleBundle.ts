import type { MessageBundle } from "./translations";
import esStrings from "./localeStrings/es.json";
import frStrings from "./localeStrings/fr.json";
import deStrings from "./localeStrings/de.json";
import ptStrings from "./localeStrings/pt.json";

export type ExtendedLocale = "es" | "fr" | "de" | "pt";

const TABLES: Record<ExtendedLocale, Record<string, string>> = {
  es: esStrings,
  fr: frStrings,
  de: deStrings,
  pt: ptStrings,
};

export function buildLocaleBundle(en: MessageBundle, locale: ExtendedLocale): MessageBundle {
  const table = TABLES[locale];
  return Object.fromEntries(
    Object.entries(en).map(([key, value]) => [key, table[key] ?? value])
  ) as MessageBundle;
}
