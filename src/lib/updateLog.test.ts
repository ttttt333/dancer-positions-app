import { describe, expect, it } from "vitest";
import {
  parseUpdateLogBodies,
  pickUpdateLogBody,
  type UpdateLogDoc,
} from "./updateLog";

function doc(over: Partial<UpdateLogDoc> = {}): UpdateLogDoc {
  return {
    body: "日本語本文",
    bodies: {},
    updatedAt: null,
    canEdit: false,
    source: "supabase",
    ...over,
  };
}

describe("update log locales", () => {
  it("parses only known locale keys", () => {
    expect(
      parseUpdateLogBodies({
        ja: "あ",
        en: "a",
        xx: "nope",
        ko: " ",
      })
    ).toEqual({ ja: "あ", en: "a" });
  });

  it("picks the viewer locale, then Japanese, then body", () => {
    expect(
      pickUpdateLogBody(
        doc({
          bodies: { ja: "日", en: "EN" },
        }),
        "en"
      )
    ).toBe("EN");
    expect(
      pickUpdateLogBody(
        doc({
          body: "fallback",
          bodies: { ja: "日" },
        }),
        "fr"
      )
    ).toBe("日");
    expect(pickUpdateLogBody(doc({ bodies: {} }), "ko")).toBe("日本語本文");
  });
});
