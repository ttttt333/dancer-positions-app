/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { MusicSection } from "../types/MusicTypes";
import {
  ensurePreChorusBeforeChorus,
  finalizeProductionTimeline,
  sortTimelineArrays,
  timelineFromPhase2,
  timelineToMusicStructure,
  type UnifiedMusicTimeline,
} from "./productionTimeline";
import { STRUCTURE_ANALYSIS_VERSION } from "./structureConfig";

const emptyProfile = {
  bass: 0.2,
  lowMid: 0.2,
  mid: 0.2,
  highMid: 0.2,
  high: 0.2,
};

function section(
  type: MusicSection["type"],
  start: number,
  end: number
): MusicSection {
  return {
    id: `sec-${type}-${start}`,
    type,
    startTime: start,
    endTime: end,
    startBar: 0,
    endBar: 1,
    barCount: 1,
    energyMean: type === "CHORUS" ? 80 : 40,
    energyPeak: 90,
    energyDelta: 10,
    rhythmicDensity: 0.4,
    spectralProfile: emptyProfile,
    confidence: 0.8,
  };
}

function baseTimeline(sections: MusicSection[]): UnifiedMusicTimeline {
  return {
    beats: [
      { time: 1, index: 1, strength: 0.5, beatInBar: 1, barIndex: 0 },
      { time: 0, index: 0, strength: 0.5, beatInBar: 0, barIndex: 0 },
    ],
    sections,
    phrases: [
      {
        id: "ph-1",
        type: "DEVELOPMENT",
        startTime: 8,
        endTime: 16,
        startBar: 4,
        endBar: 8,
        barCount: 4,
        energyStart: 40,
        energyEnd: 50,
        energyDelta: 10,
        confidence: 0.7,
      },
      {
        id: "ph-0",
        type: "PREPARATION",
        startTime: 0,
        endTime: 8,
        startBar: 0,
        endBar: 4,
        barCount: 4,
        energyStart: 30,
        energyEnd: 40,
        energyDelta: 10,
        confidence: 0.7,
      },
    ],
    changePoints: [
      {
        id: "cp-b",
        time: 16,
        rawTime: 16,
        beatTime: 16,
        barTime: 16,
        barIndex: 8,
        beatIndex: 32,
        type: "SECTION_CHANGE",
        strength: 80,
        confidence: 0.8,
        sourceEventIds: [],
        energyBefore: 40,
        energyAfter: 80,
        deltaEnergy: 40,
        priority: 40,
      },
      {
        id: "cp-a",
        time: 8,
        rawTime: 8,
        beatTime: 8,
        barTime: 8,
        barIndex: 4,
        beatIndex: 16,
        type: "ENERGY_RISE",
        strength: 60,
        confidence: 0.7,
        sourceEventIds: [],
        energyBefore: 30,
        energyAfter: 50,
        deltaEnergy: 20,
        priority: 30,
      },
    ],
    eventClusters: [
      {
        id: "ec-1",
        time: 16,
        changePoints: [],
        dominantType: "SECTION_CHANGE",
        totalStrength: 80,
        confidence: 0.8,
        isMajor: true,
      },
      {
        id: "ec-0",
        time: 8,
        changePoints: [],
        dominantType: "ENERGY_RISE",
        totalStrength: 60,
        confidence: 0.7,
        isMajor: false,
      },
    ],
    hits: [],
    confidence: 0.8,
    source: "engine-phase12",
    analysisVersion: STRUCTURE_ANALYSIS_VERSION,
    phase1Provenance: "real",
  };
}

describe("Stage 3 production timeline", () => {
  it("A. Real Phase2 maps to UnifiedMusicTimeline then MusicStructure", () => {
    const timeline = timelineFromPhase2(
      {
        sections: [section("VERSE", 0, 16), section("CHORUS", 16, 32)],
        phrases: [],
        hits: [],
        changePoints: [],
        eventClusters: [],
        confidence: 0.7,
        analysisVersion: STRUCTURE_ANALYSIS_VERSION,
      },
      [],
      undefined,
      "engine-phase12",
      "real"
    );
    const finalized = finalizeProductionTimeline(timeline, { bpm: 120 });
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) return;
    const structure = timelineToMusicStructure(finalized.timeline);
    expect(structure.sections.length).toBeGreaterThan(0);
    expect(structure.analysisVersion).toBe(STRUCTURE_ANALYSIS_VERSION);
    expect(finalized.timeline.phase1Provenance).toBe("real");
    expect(finalized.timeline.source).toBe("engine-phase12");
  });

  it("G. arrays are timestamp-ascending after finalize", () => {
    const sorted = sortTimelineArrays(baseTimeline([section("VERSE", 0, 32)]));
    expect(sorted.beats.map((b) => b.time)).toEqual([0, 1]);
    expect(sorted.phrases.map((p) => p.startTime)).toEqual([0, 8]);
    expect(sorted.changePoints.map((c) => c.time)).toEqual([8, 16]);
    expect(sorted.eventClusters.map((c) => c.time)).toEqual([8, 16]);
  });

  it("F. PRE_CHORUS is kept when Phase2 already has it before chorus", () => {
    const { sections, source } = ensurePreChorusBeforeChorus(
      [
        section("VERSE", 0, 12),
        section("PRE_CHORUS", 12, 16),
        section("CHORUS", 16, 32),
      ],
      120
    );
    expect(source).toBe("phase2");
    const pre = sections.find((s) => s.type === "PRE_CHORUS");
    const chorus = sections.find((s) => s.type === "CHORUS");
    expect(pre).toBeTruthy();
    expect(chorus).toBeTruthy();
    expect(pre!.startTime).toBeLessThan(chorus!.startTime);
  });

  it("F. PRE_CHORUS heuristic is chorus minus 2 eights when missing", () => {
    const { sections, source } = ensurePreChorusBeforeChorus(
      [section("VERSE", 0, 16), section("CHORUS", 16, 32)],
      120
    );
    expect(source).toBe("legacy-heuristic");
    const pre = sections.find((s) => s.type === "PRE_CHORUS");
    const chorus = sections.find((s) => s.type === "CHORUS");
    expect(pre).toBeTruthy();
    expect(pre!.startTime).toBeLessThan(chorus!.startTime);
    expect(chorus!.startTime - pre!.startTime).toBeCloseTo(8, 5);
  });

  it("never emits PRE_CHORUS at or after CHORUS_START", () => {
    const { sections } = ensurePreChorusBeforeChorus(
      [
        section("CHORUS", 8, 24),
        section("PRE_CHORUS", 10, 14),
      ],
      120
    );
    const chorus = sections.find((s) => s.type === "CHORUS")!;
    for (const s of sections.filter((x) => x.type === "PRE_CHORUS")) {
      expect(s.startTime).toBeLessThan(chorus.startTime);
    }
  });

  it("H. synthetic provenance is not a usable production timeline", () => {
    const timeline = baseTimeline([section("VERSE", 0, 8)]);
    timeline.phase1Provenance = "synthetic";
    const finalized = finalizeProductionTimeline(timeline, { bpm: 120 });
    expect(finalized.ok).toBe(false);
  });
});
