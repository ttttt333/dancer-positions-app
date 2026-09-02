import { describe, expect, it } from "vitest";
import {
  alignPositionsByRowCentered,
  clusterPositionsByRow,
  linesToParsedPositions,
  xForColumnCentered,
} from "./linesToParsedPositions";

describe("linesToParsedPositions", () => {
  it("centers a 1-3-4-3 (front 3-4-3-1) formation per row", () => {
    const positions = linesToParsedPositions([
      { count: 1, names: ["かえで"] },
      { count: 3, names: ["りゅうた", "そら", "るな"] },
      { count: 4, names: ["くるみ", "よしの", "みゆ", "りせ"] },
      { count: 3, names: ["あおい", "たけし", "りこ"] },
    ]);

    const rows = new Map<number, typeof positions>();
    for (const p of positions) {
      const y = p.y;
      const arr = rows.get(y) ?? [];
      arr.push(p);
      rows.set(y, arr);
    }
    const counts = [...rows.values()].map((r) => r.length);
    expect(counts).toEqual([1, 3, 4, 3]);

    const front = positions.filter((p) => p.y === Math.max(...positions.map((x) => x.y)));
    expect(front.map((p) => p.name)).toEqual(["あおい", "たけし", "りこ"]);
    expect(front.map((p) => p.x)).toEqual([
      xForColumnCentered(0, 3),
      xForColumnCentered(1, 3),
      xForColumnCentered(2, 3),
    ]);

    const four = positions.filter((p) => p.name === "くるみ" || p.name === "りせ");
    const kurumi = positions.find((p) => p.name === "くるみ");
    const rise = positions.find((p) => p.name === "りせ");
    expect(kurumi?.x).toBe(xForColumnCentered(0, 4));
    expect(rise?.x).toBe(xForColumnCentered(3, 4));
    expect(four).toHaveLength(2);

    const kaede = positions.find((p) => p.name === "かえで");
    expect(kaede?.x).toBe(50);
    expect(kaede?.y).toBeLessThan(front[0]!.y);
  });
});

describe("clusterPositionsByRow", () => {
  it("keeps 1-3-4-3 rows that a 6% tolerance would merge", () => {
    const pts = [
      { name: "かえで", x: 50, y: 18 },
      { name: "りゅうた", x: 35, y: 38 },
      { name: "そら", x: 50, y: 39 },
      { name: "るな", x: 65, y: 40 },
      { name: "くるみ", x: 30, y: 58 },
      { name: "よしの", x: 42, y: 59 },
      { name: "みゆ", x: 55, y: 60 },
      { name: "りせ", x: 68, y: 61 },
      { name: "あおい", x: 38, y: 80 },
      { name: "たけし", x: 50, y: 81 },
      { name: "りこ", x: 62, y: 82 },
    ];
    const rows = clusterPositionsByRow(pts);
    expect(rows.map((r) => r.length)).toEqual([1, 3, 4, 3]);
  });
});

describe("alignPositionsByRowCentered", () => {
  it("centers a 3-person row independently of a 4-person row", () => {
    const aligned = alignPositionsByRowCentered([
      { name: "a", x: 20, y: 20 },
      { name: "b", x: 40, y: 50 },
      { name: "c", x: 55, y: 51 },
      { name: "d", x: 70, y: 52 },
      { name: "e", x: 80, y: 53 },
    ]);
    const back = aligned.filter((p) => p.name === "a");
    const four = aligned.filter((p) => ["b", "c", "d", "e"].includes(p.name));
    expect(back[0]?.x).toBe(50);
    expect(four.map((p) => p.x)).toEqual([
      xForColumnCentered(0, 4),
      xForColumnCentered(1, 4),
      xForColumnCentered(2, 4),
      xForColumnCentered(3, 4),
    ]);
  });
});
