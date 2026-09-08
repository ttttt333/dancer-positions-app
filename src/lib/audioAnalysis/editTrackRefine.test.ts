import { describe, expect, it } from "vitest";
import {
  detectSilenceCuts,
  refineSectionsForEditTrack,
} from "./editTrackRefine";
import type { MusicSection } from "../../types/audioAnalysis";

describe("detectSilenceCuts", () => {
  it("finds a quiet gap in peaks", () => {
    const peaks = Array.from({ length: 100 }, (_, i) =>
      i >= 40 && i < 50 ? 0.01 : 0.6
    );
    const cuts = detectSilenceCuts(peaks, 100, {
      threshold: 0.05,
      minSilenceSec: 0.5,
    });
    expect(cuts.length).toBeGreaterThanOrEqual(1);
    expect(cuts[0]!.endSec).toBeGreaterThan(cuts[0]!.startSec);
  });
});

describe("refineSectionsForEditTrack", () => {
  it("splits a long chorus at silence resume and demotes quiet chorus", () => {
    const peaks = Array.from({ length: 200 }, (_, i) => {
      if (i >= 80 && i < 95) return 0.01;
      if (i >= 95 && i < 140) return 0.9;
      return 0.25;
    });
    const sections: MusicSection[] = [
      {
        id: "c",
        type: "chorus",
        label: "サビ",
        startTime: 0,
        endTime: 200,
        color: "r",
      },
    ];
    const next = refineSectionsForEditTrack({
      sections,
      peaks,
      duration: 200,
      bpm: 120,
    });
    expect(next.length).toBeGreaterThan(1);
    expect(next.some((s) => s.type === "chorus")).toBe(true);
  });

  it("detects rising energy onsets as vocal-ish cues", async () => {
    const { detectVocalEnergyOnsets } = await import("./editTrackRefine");
    const peaks = Array.from({ length: 200 }, (_, i) => (i < 50 ? 0.05 : 0.85));
    const onsets = detectVocalEnergyOnsets(peaks, 100, {
      minRise: 0.15,
      minGapSec: 2,
    });
    expect(onsets.length).toBeGreaterThanOrEqual(1);
  });
});
