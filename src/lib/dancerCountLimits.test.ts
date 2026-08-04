import { describe, expect, it } from "vitest";
import {
  clampDancerCount,
  DANCER_COUNT_QUICK_PICKS,
  MAX_DANCERS_PER_FORMATION,
  MIN_DANCERS_PER_FORMATION,
} from "./dancerCountLimits";

describe("dancerCountLimits", () => {
  it("clamps to 1..100", () => {
    expect(clampDancerCount(0)).toBe(MIN_DANCERS_PER_FORMATION);
    expect(clampDancerCount(-3)).toBe(MIN_DANCERS_PER_FORMATION);
    expect(clampDancerCount(30)).toBe(30);
    expect(clampDancerCount(100)).toBe(MAX_DANCERS_PER_FORMATION);
    expect(clampDancerCount(101)).toBe(MAX_DANCERS_PER_FORMATION);
    expect(clampDancerCount(12.9)).toBe(12);
  });

  it("includes 100 in quick picks", () => {
    expect(DANCER_COUNT_QUICK_PICKS).toContain(100);
    expect(Math.max(...DANCER_COUNT_QUICK_PICKS)).toBe(MAX_DANCERS_PER_FORMATION);
  });
});
