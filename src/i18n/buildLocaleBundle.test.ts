import { describe, expect, it } from "vitest";
import { buildLocaleBundle } from "./buildLocaleBundle";
import { TRANSLATIONS } from "./translations";
import { EDITOR_LAYOUT_TRANSLATIONS } from "./editorLayoutTranslations";
import { EDITOR_COMPONENT_TRANSLATIONS } from "./editorComponentTranslations";
import { APP_LOCALES } from "./types";

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{[A-Za-z0-9_]+\}/g)].map((m) => m[0]).sort();
}

describe("buildLocaleBundle", () => {
  it("applies Spanish strings for base, layout, and component keys", () => {
    expect(TRANSLATIONS.es["dashboard.login"]).toBe("Iniciar sesión");
    expect(EDITOR_LAYOUT_TRANSLATIONS.es["editor.layout.play"]).toBe("Reproducir");
    expect(EDITOR_COMPONENT_TRANSLATIONS.es["editor.comp.k019"]).toBe("Lista de cues");
  });

  it("covers every English key in es/fr/de/pt without dropping placeholders", () => {
    const en = TRANSLATIONS.en;
    for (const locale of ["es", "fr", "de", "pt"] as const) {
      for (const key of Object.keys(en)) {
        const value = TRANSLATIONS[locale][key];
        expect(value, `${locale} missing ${key}`).toBeTruthy();
        expect(placeholders(value), `${locale} ${key}`).toEqual(
          placeholders(en[key])
        );
      }
    }
  });

  it("does not leave sampled marketing/editor strings in English", () => {
    const sampleKeys = [
      "common.loading",
      "landing.ctaTry",
      "billing.confirm.title",
      "editor.layout.close",
      "editor.comp.k111",
    ] as const;
    for (const locale of ["es", "fr", "de", "pt"] as const) {
      for (const key of sampleKeys) {
        expect(TRANSLATIONS[locale][key]).not.toBe(TRANSLATIONS.en[key]);
      }
    }
  });

  it("gives Korean and Chinese their own editor-layout strings", () => {
    const key = "editor.layout.viewerNoAudioConfigured";
    expect(EDITOR_LAYOUT_TRANSLATIONS.ko[key]).not.toBe(EDITOR_LAYOUT_TRANSLATIONS.en[key]);
    expect(EDITOR_LAYOUT_TRANSLATIONS.zh[key]).not.toBe(EDITOR_LAYOUT_TRANSLATIONS.en[key]);
    for (const loc of APP_LOCALES) {
      expect(EDITOR_LAYOUT_TRANSLATIONS[loc][key]).toBeTruthy();
    }
  });

  it("preserves interpolation placeholders", () => {
    const en = { "editor.layout.cueName": "Cue {n}" };
    const es = buildLocaleBundle(en, "es");
    expect(es["editor.layout.cueName"]).toMatch(/\{n\}/);
  });
});
