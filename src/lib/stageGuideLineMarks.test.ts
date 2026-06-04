import { describe, expect, it } from "vitest";
import { computeCenterFieldGuideLineMarks } from "./stageGuideLineMarks";

describe("computeCenterFieldGuideLineMarks", () => {
  it("間隔と幅から左右対称の番号位置を返す", () => {
    const marks = computeCenterFieldGuideLineMarks(12000, 1500);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.some((m) => m.k === 1 && m.xp < 50)).toBe(true);
    expect(marks.some((m) => m.k === 1 && m.xp > 50)).toBe(true);
  });

  it("未設定時は空", () => {
    expect(computeCenterFieldGuideLineMarks(12000, null)).toEqual([]);
  });
});
