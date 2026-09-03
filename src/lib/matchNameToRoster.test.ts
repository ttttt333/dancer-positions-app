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
    expect(matchNameToRoster("かえで", PROJECT_ROSTER).name).toBe("");
    expect(matchNameToRoster("たけし", PROJECT_ROSTER).matched).toBe(false);
    expect(matchNameToRoster("あおい", PROJECT_ROSTER).matched).toBe(false);
  });

  it("does not treat a 1-edit slip as the same person", () => {
    expect(matchNameToRoster("かえご", PHOTO_ROSTER).matched).toBe(false);
    expect(matchNameToRoster("かえご", PHOTO_ROSTER).name).toBe("");
    expect(matchNameToRoster("はなか", ["ほなか"]).matched).toBe(false);
    expect(matchNameToRoster("はなか", ["ほなか"]).name).toBe("");
  });

  it("recovers handwriting quirks onto the unique roster spelling", () => {
    expect(matchNameToRoster("ほのあ", ["ほのか", "はなか", "さくら"])).toMatchObject({
      matched: true,
      name: "ほのか",
    });
    expect(matchNameToRoster("うあ", ["うめ", "くれあ"])).toMatchObject({
      matched: true,
      name: "うめ",
    });
  });

  it("does not invent kanji when the roster is hiragana", () => {
    const m = matchNameToRoster("花香", ["はなか", "さくら"]);
    expect(m.matched).toBe(false);
    expect(m.name).toBe("");
  });

  it("uses the roster spelling, not the OCR spelling", () => {
    expect(matchNameToRoster("リセ", PHOTO_ROSTER)).toMatchObject({
      matched: true,
      name: "りせ",
    });
  });

  it("keeps an exact given name from the roster", () => {
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
    expect(names[1]?.name).toBe("");
    expect(names[1]?.matched).toBe(false);
  });

  it("does not treat みゆ and みお as the same person", () => {
    const names = matchNamesToRosterUnique(["みゆ", "みお"], [
      "みゆ",
      "みお",
      "りせ",
    ]);
    expect(names.map((m) => m.name)).toEqual(["みゆ", "みお"]);
  });

  it("does not invent a lookalike that is missing from the roster", () => {
    const names = matchNamesToRosterUnique(["みゆ", "みお"], PHOTO_ROSTER);
    expect(names.map((m) => m.name)).toEqual(["みゆ", ""]);
  });

  it("never returns a name that is not on the roster", () => {
    const names = matchNamesToRosterUnique(
      ["はなか", "ほなか", "花香"],
      ["さくら", "みゆ"]
    );
    expect(names.every((m) => m.name === "" || ["さくら", "みゆ"].includes(m.name))).toBe(
      true
    );
    expect(names.every((m) => !m.matched)).toBe(true);
  });

  it("assigns cramped OCR to unique roster names without swapping はなか", () => {
    const names = matchNamesToRosterUnique(
      ["ほのあ", "はなか", "ゆあ"],
      ["ほのか", "はなか", "ゆうゆ", "うめ"]
    );
    expect(names.map((m) => m.name)).toEqual(["ほのか", "はなか", ""]);
  });
});
