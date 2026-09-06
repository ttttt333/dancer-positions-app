import { describe, expect, it } from "vitest";
import type { FormationCue } from "../types/CueTypes";
import {
  buildPhraseTimestamps,
  findClosestTimestamp,
  quantizeCueTimings,
} from "./phraseGridQuantizer";

function cue(
  partial: Partial<FormationCue> & Pick<FormationCue, "id" | "rawTime">
): FormationCue {
  return {
    beatTime: null,
    barTime: null,
    action: "MICRO_SHIFT",
    magnitude: "SMALL",
    priority: 40,
    confidence: 0.7,
    reasonCodes: [],
    sourceEventClusterId: "ec",
    sourceChangePointIds: [],
    energyBefore: 40,
    energyAfter: 45,
    deltaEnergy: 5,
    isMajor: false,
    isLocked: false,
    suppressed: false,
    ...partial,
  };
}

describe("phraseGridQuantizer", () => {
  it("buildPhraseTimestamps uses every 8th beat when beats are provided", () => {
    const beats = Array.from({ length: 33 }, (_, i) => i * 0.5); // 120bpm
    const ts = buildPhraseTimestamps({
      beats,
      bpm: 120,
      durationSec: 16,
      phraseBeats: 8,
    });
    expect(ts[0]).toBe(0);
    expect(ts).toContain(4); // beat index 8 → 4.0s
    expect(ts).toContain(8);
  });

  it("buildPhraseTimestamps falls back to BPM virtual grid", () => {
    const ts = buildPhraseTimestamps({
      bpm: 120,
      durationSec: 16,
      phraseBeats: 8,
    });
    // 8 beats @ 120bpm = 4s
    expect(ts[0]).toBe(0);
    expect(ts[1]).toBeCloseTo(4, 3);
    expect(ts[2]).toBeCloseTo(8, 3);
  });

  it("snaps fractional cue times onto 8-count heads", () => {
    const cues = [
      cue({ id: "a", rawTime: 0.1 }),
      cue({ id: "b", rawTime: 14.23 }),
      cue({ id: "c", rawTime: 16.4 }),
    ];
    const out = quantizeCueTimings({
      cues,
      bpm: 120,
      durationSec: 64,
      phraseBeats: 8,
      minGapBeats: 16,
    });
    const active = out.filter((c) => !c.suppressed);
    expect(active[0]!.rawTime).toBe(0);
    // 14.23 → nearest 8-count head (12 or 16); 16 is closer
    expect(active.find((c) => c.id === "b")!.rawTime).toBeCloseTo(16, 3);
    expect(active.every((c) => c.reasonCodes.includes("PHRASE_GRID_SNAP"))).toBe(
      true
    );
  });

  it("drops non-boundary cues closer than 2 eights after snap", () => {
    const cues = [
      cue({ id: "a", rawTime: 8.1 }),
      cue({ id: "b", rawTime: 10.2 }), // snaps near a within < 16 beats
      cue({ id: "c", rawTime: 20.0 }),
    ];
    const out = quantizeCueTimings({
      cues,
      bpm: 120,
      durationSec: 64,
      phraseBeats: 8,
      minGapBeats: 16,
    });
    const ids = out.filter((c) => !c.suppressed).map((c) => c.id);
    expect(ids).toContain("a");
    expect(ids).not.toContain("b");
    expect(ids).toContain("c");
  });

  it("keeps section-boundary cues even when inside min gap", () => {
    const cues = [
      cue({ id: "a", rawTime: 8 }),
      cue({
        id: "chorus",
        rawTime: 10,
        isMajor: true,
        action: "MAJOR_CHANGE",
        reasonCodes: ["PROMOTED_SECTION_CHANGE", "SECTION_CHANGE"],
      }),
    ];
    const out = quantizeCueTimings({
      cues,
      bpm: 120,
      durationSec: 64,
      phraseBeats: 8,
      minGapBeats: 16,
    });
    const ids = out.filter((c) => !c.suppressed).map((c) => c.id);
    expect(ids).toContain("chorus");
  });

  it("preserves suppressed cues", () => {
    const cues = [
      cue({ id: "a", rawTime: 8 }),
      cue({ id: "s", rawTime: 9, suppressed: true }),
    ];
    const out = quantizeCueTimings({
      cues,
      bpm: 120,
      durationSec: 32,
    });
    expect(out.some((c) => c.id === "s" && c.suppressed)).toBe(true);
  });

  it("findClosestTimestamp picks nearest neighbor", () => {
    expect(findClosestTimestamp(5.1, [0, 4, 8, 12])).toBe(4);
    expect(findClosestTimestamp(6.1, [0, 4, 8, 12])).toBe(8);
  });
});
