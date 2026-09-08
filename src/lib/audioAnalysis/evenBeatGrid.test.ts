import { describe, expect, it } from "vitest";
import { buildEvenBeatGrid, secondsPerBeat } from "./evenBeatGrid";
import {
  cleanseMusicSections,
  mergeAdjacentSameType,
  buildFormRatioSections,
  isDegenerateSectionLayout,
  repairDegenerateSections,
} from "./cleanseSections";
import type { MusicSection } from "../../types/audioAnalysis";

describe("buildEvenBeatGrid", () => {
  it("spaces beats evenly from BPM", () => {
    const beats = buildEvenBeatGrid({
      bpm: 120,
      duration: 4,
      firstDownbeatTime: 0,
    });
    const spb = secondsPerBeat(120);
    expect(spb).toBe(0.5);
    expect(beats[0]!.isDownbeat).toBe(true);
    expect(beats[0]!.beatNumber).toBe(1);
    expect(beats[1]!.timestamp - beats[0]!.timestamp).toBeCloseTo(0.5, 5);
    expect(beats[7]!.beatNumber).toBe(8);
    expect(beats[8]!.isDownbeat).toBe(true);
    // 全ギャップが均等
    for (let i = 1; i < beats.length; i += 1) {
      expect(beats[i]!.timestamp - beats[i - 1]!.timestamp).toBeCloseTo(0.5, 5);
    }
  });

  it("respects firstDownbeat offset", () => {
    const beats = buildEvenBeatGrid({
      bpm: 120,
      duration: 4,
      firstDownbeatTime: 0.25,
    });
    const firstDb = beats.find((b) => b.isDownbeat && b.timestamp >= 0.2)!;
    expect(firstDb.timestamp).toBeCloseTo(0.25, 5);
  });
});

describe("cleanseMusicSections", () => {
  it("merges consecutive same-type chorus fragments", () => {
    const choppy: MusicSection[] = [];
    for (let i = 0; i < 10; i += 1) {
      choppy.push({
        id: `c${i}`,
        type: "chorus",
        label: "サビ",
        startTime: i * 3,
        endTime: i * 3 + 2.5,
        color: "#EF4444",
      });
    }
    const cleaned = cleanseMusicSections(choppy, {
      duration: 30,
      bpm: 120,
      minDurationSec: 8,
    });
    expect(cleaned.length).toBeLessThanOrEqual(2);
    expect(cleaned.some((s) => s.type === "chorus")).toBe(true);
    const chorus = cleaned.find((s) => s.type === "chorus")!;
    expect(chorus.endTime - chorus.startTime).toBeGreaterThanOrEqual(8);
  });

  it("mergeAdjacentSameType joins neighbors", () => {
    const merged = mergeAdjacentSameType([
      {
        id: "a",
        type: "chorus",
        label: "サビ",
        startTime: 0,
        endTime: 5,
        color: "r",
      },
      {
        id: "b",
        type: "chorus",
        label: "サビ",
        startTime: 5,
        endTime: 10,
        color: "r",
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.endTime).toBe(10);
  });
});

describe("buildFormRatioSections", () => {
  it("does not label the entire song as chorus", () => {
    const sections = buildFormRatioSections({
      duration: 120,
      bpm: 120,
      energyByTime: (t) => (t > 40 && t < 70 ? 1 : 0.3),
    });
    const types = new Set(sections.map((s) => s.type));
    expect(types.has("chorus")).toBe(true);
    expect(types.size).toBeGreaterThan(1);
    expect(sections.every((s) => s.endTime - s.startTime >= 2)).toBe(true);
  });
});

describe("isDegenerateSectionLayout / repairDegenerateSections", () => {
  it("flags a single full-track chorus", () => {
    expect(
      isDegenerateSectionLayout(
        [
          {
            id: "c",
            type: "chorus",
            label: "サビ",
            startTime: 0,
            endTime: 100,
            color: "r",
          },
        ],
        100
      )
    ).toBe(true);
  });

  it("repairs whole-track chorus into multi-type form", () => {
    const repaired = repairDegenerateSections({
      sections: [
        {
          id: "c",
          type: "chorus",
          label: "サビ",
          startTime: 0,
          endTime: 96,
          color: "r",
        },
      ],
      duration: 96,
      bpm: 120,
      peaks: Array.from({ length: 96 }, (_, i) =>
        i > 40 && i < 60 ? 1 : 0.2
      ),
    });
    expect(isDegenerateSectionLayout(repaired, 96)).toBe(false);
    expect(new Set(repaired.map((s) => s.type)).size).toBeGreaterThan(1);
  });
});
