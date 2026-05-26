import { describe, expect, it } from "vitest";
import { buildLocaleBundle } from "./buildLocaleBundle";
import { TRANSLATIONS } from "./translations";
import { EDITOR_LAYOUT_TRANSLATIONS } from "./editorLayoutTranslations";
import { EDITOR_COMPONENT_TRANSLATIONS } from "./editorComponentTranslations";

describe("buildLocaleBundle", () => {
  it("applies Spanish strings for base, layout, and component keys", () => {
    expect(TRANSLATIONS.es["dashboard.login"]).toBe("Iniciar sesión");
    expect(EDITOR_LAYOUT_TRANSLATIONS.es["editor.layout.play"]).toBe("Reproducir");
    expect(EDITOR_COMPONENT_TRANSLATIONS.es["editor.comp.k019"]).toBe("Lista de cues");
  });

  it("covers all extended locales without English fallbacks on sampled keys", () => {
    const sampleKeys = [
      "common.loading",
      "editor.layout.close",
      "editor.comp.k111",
    ] as const;
    for (const locale of ["es", "fr", "de", "pt"] as const) {
      for (const key of sampleKeys) {
        const value = TRANSLATIONS[locale][key] ?? EDITOR_LAYOUT_TRANSLATIONS[locale][key];
        expect(value).toBeTruthy();
        expect(value).not.toBe(TRANSLATIONS.en[key]);
      }
    }
  });

  it("preserves interpolation placeholders", () => {
    const en = { "editor.layout.cueName": "Cue {n}" };
    const es = buildLocaleBundle(en, "es");
    expect(es["editor.layout.cueName"]).toMatch(/\{n\}/);
  });
});
