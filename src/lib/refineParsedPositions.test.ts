import { describe, expect, it } from "vitest";
import { refineParsedPositions } from "./refineParsedPositions";

describe("refineParsedPositions", () => {
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
});
