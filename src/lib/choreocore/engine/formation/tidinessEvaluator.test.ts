import { describe, expect, it } from "vitest";
import { evaluateTidiness } from "./tidinessEvaluator";

describe("tidinessEvaluator", () => {
  it("scores a regular grid as tidy (low CV)", () => {
    const grid = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ];
    const r = evaluateTidiness(grid);
    expect(r.spacingCv).toBeLessThan(0.2);
    expect(r.tidinessScore).toBeGreaterThan(0.8);
  });

  it("penalizes uneven nearest-neighbor spacing", () => {
    // 3人が密着、1人だけ遠く孤立 → 最近傍距離のばらつき大
    const messy = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0 },
      { x: 0.2, y: 0 },
      { x: 8, y: 0 },
    ];
    const r = evaluateTidiness(messy);
    expect(r.spacingCv).toBeGreaterThan(0.4);
    expect(r.tidinessScore).toBeLessThan(0.7);
  });

  it("returns perfect score for a single dancer", () => {
    expect(evaluateTidiness([{ x: 0, y: 0 }])).toEqual({
      spacingCv: 0,
      tidinessScore: 1,
    });
  });
});
