import { describe, expect, it } from "vitest";
import { countInIntervalSec } from "./playbackCountIn";
import {
  normalizePracticePlaybackRate,
  PRACTICE_PLAYBACK_RATES,
} from "../store/practicePlaybackStore";

describe("countInIntervalSec", () => {
  it("matches 60/bpm", () => {
    expect(countInIntervalSec(120)).toBeCloseTo(0.5, 6);
    expect(countInIntervalSec(60)).toBeCloseTo(1, 6);
  });
});

describe("normalizePracticePlaybackRate", () => {
  it("snaps to allowed practice rates", () => {
    expect(normalizePracticePlaybackRate(1)).toBe(1);
    expect(normalizePracticePlaybackRate(0.74)).toBe(0.75);
    expect(normalizePracticePlaybackRate(1.3)).toBe(1.25);
    expect(PRACTICE_PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.25]);
  });
});
