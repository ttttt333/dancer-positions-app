import { describe, expect, it } from "vitest";
import {
  canonicalizeRosterNameImportMode,
  rowsToCrewMembers,
  ROSTER_NAME_IMPORT_MODE_OPTIONS,
} from "./crewCsvImport";

const HEADER = ["姓", "名", "セイ", "メイ"];

function sampleRows(): string[][] {
  return [
    HEADER,
    ["酒井", "武", "サカイ", "タケシ"],
    ["中村", "武", "ナカムラ", "タケシ"],
    ["山田", "花", "ヤマダ", "ハナ"],
  ];
}

describe("roster name import modes", () => {
  it("exposes six canonical display options", () => {
    expect(ROSTER_NAME_IMPORT_MODE_OPTIONS.map((o) => o.value)).toEqual([
      "kanji_full",
      "kanji_family",
      "kanji_given",
      "hiragana_full",
      "hiragana_family",
      "hiragana_given",
    ]);
  });

  it("maps legacy modes to kanji canonical", () => {
    expect(canonicalizeRosterNameImportMode("full")).toBe("kanji_full");
    expect(canonicalizeRosterNameImportMode("family_only")).toBe(
      "kanji_family"
    );
    expect(canonicalizeRosterNameImportMode("given_only")).toBe("kanji_given");
  });

  it("builds kanji full / family / given labels", () => {
    const rows = sampleRows();
    const full = rowsToCrewMembers(rows, { nameMode: "kanji_full" });
    expect(full.map((m) => m.label)).toEqual(["酒井武", "中村武", "山田花"]);

    const family = rowsToCrewMembers(rows, { nameMode: "kanji_family" });
    expect(family.map((m) => m.label)).toEqual(["酒井", "中村", "山田"]);

    const given = rowsToCrewMembers(rows, { nameMode: "kanji_given" });
    // 武が重複 → 苗字頭を前置
    expect(given.map((m) => m.label)).toEqual(["酒武", "中武", "花"]);
  });

  it("builds hiragana full / family / given from furigana columns", () => {
    const rows = sampleRows();
    const full = rowsToCrewMembers(rows, { nameMode: "hiragana_full" });
    expect(full.map((m) => m.label)).toEqual([
      "さかいたけし",
      "なかむらたけし",
      "やまだはな",
    ]);

    const family = rowsToCrewMembers(rows, { nameMode: "hiragana_family" });
    expect(family.map((m) => m.label)).toEqual(["さかい", "なかむら", "やまだ"]);

    const given = rowsToCrewMembers(rows, { nameMode: "hiragana_given" });
    expect(given.map((m) => m.label)).toEqual(["さたけし", "なたけし", "はな"]);
  });

  it("falls back to kanji when hiragana requested but no readings", () => {
    const rows = [
      ["姓", "名"],
      ["佐藤", "一郎"],
    ];
    const members = rowsToCrewMembers(rows, { nameMode: "hiragana_full" });
    expect(members).toHaveLength(1);
    expect(members[0]!.label).toBe("佐藤一郎");
  });

  it("uses kana cells as hiragana when the name column is already kana", () => {
    const rows = [["名前"], ["さかい たけし"]];
    const members = rowsToCrewMembers(rows, { nameMode: "hiragana_family" });
    expect(members[0]!.label).toBe("さかい");
  });
});
