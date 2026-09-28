import { describe, expect, it } from "vitest";
import { DANCER_COLOR_COUNT, randomDancerColorIndices } from "./dancerColorPalette";

describe("randomDancerColorIndices", () => {
  it("returns valid palette indices without back-to-back repeats", () => {
    const picks = randomDancerColorIndices(DANCER_COLOR_COUNT * 5 + 3);
    expect(picks).toHaveLength(DANCER_COLOR_COUNT * 5 + 3);
    picks.forEach((c, i) => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(DANCER_COLOR_COUNT);
      if (i > 0) expect(c).not.toBe(picks[i - 1]);
    });
  });

  it("uses every color once per palette-sized chunk", () => {
    const picks = randomDancerColorIndices(DANCER_COLOR_COUNT);
    expect(new Set(picks).size).toBe(DANCER_COLOR_COUNT);
  });
});
