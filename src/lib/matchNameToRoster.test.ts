import { describe, expect, it } from "vitest";
import {
  matchNameToRoster,
  matchNamesToRosterUnique,
} from "./matchNameToRoster";

const PROJECT_ROSTER = [
  "かんな",
  "りせ",
  "みお",
  "たいち",
  "くれあ",
  "ありす",
  "あいき",
  "ゆづき",
  "あんじゅ",
  "ひなた",
];

const PHOTO_ROSTER = [
  "かえで",
  "りゅうた",
  "そら",
  "るな",
  "くるみ",
  "よしの",
  "みゆ",
  "りせ",
  "あおい",
  "たけし",
  "りこ",
];

describe("matchNameToRoster", () => {
  it("does not map 3-mora lookalikes onto the wrong roster names", () => {
    expect(matchNameToRoster("かえで", PROJECT_ROSTER).matched).toBe(false);
    expect(matchNameToRoster("かえで", PROJECT_ROSTER).name).toBe("かえで");
    expect(matchNameToRoster("たけし", PROJECT_ROSTER).matched).toBe(false);
    expect(matchNameToRoster("あおい", PROJECT_ROSTER).matched).toBe(false);
  });

  it("maps a 1-edit OCR slip onto the unique roster name", () => {
    const m = matchNameToRoster("かえご", PHOTO_ROSTER);
    expect(m).toMatchObject({ matched: true, name: "かえで" });
  });

  it("keeps an exact given name", () => {
    expect(matchNameToRoster("りせ", PHOTO_ROSTER)).toMatchObject({
      matched: true,
      name: "りせ",
    });
  });
});

describe("matchNamesToRosterUnique", () => {
  it("predicts the photo roster without stealing project lookalikes", () => {
    const mixed = [...PROJECT_ROSTER, ...PHOTO_ROSTER];
    const ocr = [
      "かえで",
      "りゅうた",
      "そら",
      "るな",
      "くるみ",
      "よしの",
      "みゆ",
      "りせ",
      "あおい",
      "たけし",
      "りこ",
    ];
    const names = matchNamesToRosterUnique(ocr, mixed).map((m) => m.name);
    expect(names).toEqual(ocr);
    expect(matchNamesToRosterUnique(ocr, mixed).every((m) => m.matched)).toBe(
      true
    );
  });

  it("does not assign the same roster name to two people", () => {
    const names = matchNamesToRosterUnique(["みゆ", "みゆ"], ["みゆ", "みお"]);
    const matched = names.filter((m) => m.matched);
    expect(matched).toHaveLength(1);
    expect(matched[0]?.name).toBe("みゆ");
    expect(names[1]?.name).toBe("みゆ");
    expect(names[1]?.matched).toBe(false);
  });

  it("does not treat みゆ and みお as the same person", () => {
    const names = matchNamesToRosterUnique(["みゆ", "みお"], PHOTO_ROSTER);
    expect(names.map((m) => m.name)).toEqual(["みゆ", "みお"]);
  });
});
