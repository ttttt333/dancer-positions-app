import { describe, expect, it } from "vitest";
import { refineParsedPositions } from "./refineParsedPositions";

describe("refineParsedPositions", () => {
  it("engine path keeps marker spacing instead of an even name grid", () => {
    const refined = refineParsedPositions(
      {
        positions: [
          { name: "かえで", x: 50, y: 12, markerX: 50, markerY: 12 },
          { name: "りゅうた", x: 32, y: 38, markerX: 32, markerY: 38 },
          { name: "そら", x: 50, y: 39, markerX: 50, markerY: 39 },
          { name: "るな", x: 68, y: 38, markerX: 68, markerY: 38 },
          { name: "くるみ", x: 22, y: 62, markerX: 22, markerY: 62 },
          { name: "よしの", x: 40, y: 63, markerX: 40, markerY: 63 },
          { name: "みゆ", x: 58, y: 62, markerX: 58, markerY: 62 },
          { name: "りせ", x: 76, y: 63, markerX: 76, markerY: 63 },
          { name: "あおい", x: 32, y: 88, markerX: 32, markerY: 88 },
          { name: "たけし", x: 50, y: 89, markerX: 50, markerY: 89 },
          { name: "りこ", x: 68, y: 88, markerX: 68, markerY: 88 },
        ],
        lines: [
          { count: 1, names: ["かえで"] },
          { count: 3, names: ["りゅうた", "そら", "るな"] },
          { count: 4, names: ["くるみ", "よしの", "みゆ", "りせ"] },
          { count: 3, names: ["あおい", "たけし", "りこ"] },
        ],
      },
      [
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
        "かんな",
      ],
      { useFormationEngine: true, placement: "raw" }
    );

    expect(refined.lines?.map((l) => l.names.length)).toEqual([1, 3, 4, 3]);
    const kurumi = refined.positions.find((p) => p.name === "くるみ");
    const rise = refined.positions.find((p) => p.name === "りせ");
    const yoshino = refined.positions.find((p) => p.name === "よしの");
    expect(kurumi && rise && yoshino).toBeTruthy();
    const leftGap = (yoshino?.x ?? 0) - (kurumi?.x ?? 0);
    const wideGap = (rise?.x ?? 0) - (yoshino?.x ?? 0);
    expect(wideGap).toBeGreaterThan(leftGap);
    expect(refined.rawPositions?.length).toBe(11);
    expect(refined.suggestedPositions?.length).toBe(11);
    expect(refined.positions.find((p) => p.name === "かんな")).toBeUndefined();
  });

  it("rebuilds a 3-4-3-1 layout from lines even if positions are a 1-3-5-2 mess", () => {
    const projectRoster = [
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
    const photoRoster = [
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

    const refined = refineParsedPositions(
      {
        positions: [
          { name: "かんな", x: 50, y: 12 },
          { name: "りせ", x: 30, y: 28 },
          { name: "みお", x: 50, y: 30 },
          { name: "たいち", x: 70, y: 32 },
          { name: "くれあ", x: 20, y: 48 },
          { name: "ありす", x: 35, y: 50 },
          { name: "あいき", x: 50, y: 51 },
          { name: "ゆづき", x: 65, y: 52 },
          { name: "りせ", x: 80, y: 54 },
          { name: "あんじゅ", x: 40, y: 78 },
          { name: "ひなた", x: 60, y: 80 },
        ],
        lines: [
          { count: 1, names: ["かえで"] },
          { count: 3, names: ["りゅうた", "そら", "るな"] },
          { count: 4, names: ["くるみ", "よしの", "みゆ", "りせ"] },
          { count: 3, names: ["あおい", "たけし", "りこ"] },
        ],
      },
      [...projectRoster, ...photoRoster]
    );

    const byY = new Map<number, string[]>();
    for (const p of refined.positions) {
      const arr = byY.get(p.y) ?? [];
      arr.push(p.name);
      byY.set(p.y, arr);
    }
    expect([...byY.values()].map((r) => r.length)).toEqual([1, 3, 4, 3]);
    expect(refined.positions.map((p) => p.name)).toEqual([
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
    ]);
    expect(refined.positions.find((p) => p.name === "かんな")).toBeUndefined();
    expect(refined.positions.find((p) => p.name === "たいち")).toBeUndefined();
  });

  it("drops invented kanji and lookalikes when a roster is present", () => {
    const roster = ["はなか", "さくら", "みゆ"];
    const refined = refineParsedPositions(
      {
        positions: [
          { name: "花香", x: 20, y: 50, markerX: 20, markerY: 50 },
          { name: "ほなか", x: 50, y: 50, markerX: 50, markerY: 50 },
          { name: "はなか", x: 80, y: 50, markerX: 80, markerY: 50 },
        ],
      },
      roster,
      { useFormationEngine: true, placement: "raw" }
    );
    const names = refined.positions.map((p) => p.name);
    expect(names).toHaveLength(3);
    expect(names.filter((n) => n === "はなか")).toHaveLength(1);
    expect(names).not.toContain("花香");
    expect(names).not.toContain("ほなか");
    expect(names.every((n) => n === "" || roster.includes(n))).toBe(true);
  });
});
