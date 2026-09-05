/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  generateChoreographicIntent,
  generateChoreographicIntentSequence,
} from "./ChoreographicIntentEngine";
import type { ChoreographicIntentContext } from "./ChoreographicIntentTypes";
import { makeCluster } from "../cue/cueFixtures";
import type { FormationCue } from "../types/CueTypes";
import type { MusicSection } from "../types/MusicTypes";

function cue(partial: Partial<FormationCue> & { id: string; rawTime: number }): FormationCue {
  return {
    beatTime: partial.rawTime,
    barTime: partial.rawTime,
    action: "MICRO_SHIFT",
    magnitude: "MEDIUM",
    priority: 60,
    confidence: 0.88,
    reasonCodes: [],
    sourceEventClusterId: `ec-${Math.round(partial.rawTime * 1000)}`,
    sourceChangePointIds: [],
    energyBefore: 40,
    energyAfter: 55,
    deltaEnergy: 15,
    isMajor: false,
    isLocked: false,
    suppressed: false,
    ...partial,
  };
}

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
    energyMean: 50,
    energyPeak: 70,
    energyDelta: 10,
    rhythmicDensity: 0.4,
    spectralProfile: { bass: 0.2, lowMid: 0.2, mid: 0.2, highMid: 0.2, high: 0.2 },
    confidence: 0.85,
  };
}

function ctx(
  over: Partial<ChoreographicIntentContext> & { cue: FormationCue }
): ChoreographicIntentContext {
  return {
    energyTrend: "RISING",
    energyLevel: "MID",
    timelinePosition: 0.4,
    previousIntent: null,
    ...over,
  };
}

function intentsOf(result: ReturnType<typeof generateChoreographicIntent>) {
  return [result.primary, ...result.alternatives].map((c) => c.intent);
}

describe("ChoreographicIntentEngine", () => {
  it("A. DROP context includes EXPAND among candidates", () => {
    const event = makeCluster(16, ["ENERGY_RISE", "SECTION_CHANGE"], {
      id: "ec-drop",
      isMajor: true,
      strength: 90,
      confidence: 0.94,
      energyBefore: 35,
      energyAfter: 88,
    });
    const result = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c-drop",
          rawTime: 16,
          isMajor: true,
          priority: 88,
          confidence: 0.93,
          sourceEventClusterId: "ec-drop",
          reasonCodes: ["ENERGY_RISE", "SECTION_CHANGE", "MAJOR_CLUSTER"],
          energyBefore: 35,
          energyAfter: 88,
          deltaEnergy: 53,
        }),
        event,
        section: section("DROP", 16, 32),
        energyTrend: "RISING",
        energyLevel: "HIGH",
      })
    );
    expect(intentsOf(result)).toContain("EXPAND");
    expect(result.primary.reasonCodes.length).toBeGreaterThan(0);
    expect(result.primary.confidence).toBeGreaterThan(0.8);
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it("B. BUILD / PRE_CHORUS yields tighten or preparation candidates", () => {
    const result = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c-build",
          rawTime: 12,
          action: "MICRO_SHIFT",
          reasonCodes: ["PREPARATION", "ENERGY_RISE"],
          energyBefore: 28,
          energyAfter: 42,
          deltaEnergy: 14,
        }),
        event: makeCluster(12, ["ENERGY_RISE"], { id: "ec-build", strength: 55 }),
        section: section("PRE_CHORUS", 8, 16),
        energyTrend: "RISING",
        energyLevel: "LOW",
      })
    );
    const set = new Set(intentsOf(result));
    expect(set.has("CONTRACT") || set.has("MICRO_SHIFT") || set.has("TRAVEL")).toBe(
      true
    );
  });

  it("C. BREAK includes HOLD as a candidate", () => {
    const result = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c-break",
          rawTime: 40,
          isMajor: true,
          reasonCodes: ["SECTION_CHANGE"],
          energyBefore: 70,
          energyAfter: 22,
          deltaEnergy: -48,
        }),
        event: makeCluster(40, ["ENERGY_DROP", "SECTION_CHANGE"], {
          id: "ec-break",
          isMajor: true,
          energyBefore: 70,
          energyAfter: 22,
        }),
        section: section("BREAK", 40, 48),
        energyTrend: "FALLING",
        energyLevel: "LOW",
      })
    );
    expect(intentsOf(result)).toContain("HOLD");
  });

  it("D. CHORUS_START offers a major spatial intent", () => {
    const result = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c-chorus",
          rawTime: 32,
          isMajor: true,
          priority: 90,
          reasonCodes: ["SECTION_CHANGE", "MAJOR_CLUSTER"],
          energyBefore: 45,
          energyAfter: 80,
          deltaEnergy: 35,
        }),
        event: makeCluster(32, ["SECTION_CHANGE", "ENERGY_RISE"], {
          id: "ec-chorus",
          isMajor: true,
          strength: 86,
        }),
        section: section("CHORUS", 32, 56),
        previousSection: section("PRE_CHORUS", 24, 32),
        energyTrend: "RISING",
        energyLevel: "HIGH",
      })
    );
    const set = new Set(intentsOf(result));
    expect(
      set.has("EXPAND") || set.has("MAJOR_CHANGE") || set.has("REVEAL")
    ).toBe(true);
  });

  it("E. quiet audio can still yield strong intent when evidence is strong", () => {
    const result = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c-quiet",
          rawTime: 20,
          isMajor: true,
          priority: 86,
          confidence: 0.95,
          reasonCodes: ["SECTION_CHANGE", "MAJOR_CLUSTER"],
          energyBefore: 8,
          energyAfter: 10,
          deltaEnergy: 2,
        }),
        event: makeCluster(20, ["SECTION_CHANGE"], {
          id: "ec-quiet",
          isMajor: true,
          confidence: 0.96,
          strength: 82,
          energyBefore: 8,
          energyAfter: 10,
        }),
        section: section("BREAK", 20, 28),
        energyTrend: "STABLE",
        energyLevel: "LOW",
        musicEnergy: 10,
      })
    );
    expect(result.primary.confidence).toBeGreaterThan(0.9);
    expect(result.primary.intensity).toBeGreaterThan(0.7);
    expect(result.primary.intensity).toBeGreaterThan((10 / 100) * 2);
  });

  it("F. one cue yields one primary and at most two alternatives", () => {
    const event = makeCluster(8, ["ENERGY_RISE"], { id: "ec-one", isMajor: true });
    const result = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c-one",
          rawTime: 8,
          isMajor: true,
          sourceEventClusterId: "ec-one",
        }),
        event,
        section: section("DROP", 8, 16),
      })
    );
    expect(result.primary).toBeTruthy();
    expect(result.alternatives.length).toBeLessThanOrEqual(2);
  });

  it("G. identical context is deterministic", () => {
    const context = ctx({
      cue: cue({
        id: "c-det",
        rawTime: 16,
        isMajor: true,
        sourceEventClusterId: "ec-det",
        reasonCodes: ["ENERGY_RISE"],
      }),
      event: makeCluster(16, ["ENERGY_RISE"], { id: "ec-det", isMajor: true }),
      section: section("DROP", 16, 24),
    });
    const a = generateChoreographicIntent(context);
    const b = generateChoreographicIntent(context);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("H. event and cue confidence reach the intent", () => {
    const result = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c-conf",
          rawTime: 8,
          confidence: 0.8,
          sourceEventClusterId: "ec-conf",
        }),
        event: makeCluster(8, ["HIT"], { id: "ec-conf", confidence: 1 }),
      })
    );
    expect(result.primary.confidence).toBeCloseTo(0.55 * 0.8 + 0.45 * 1, 5);
  });

  it("repeat of the same intent is down-scored when cue is not major", () => {
    const first = generateChoreographicIntent(
      ctx({
        cue: cue({ id: "c1", rawTime: 8, reasonCodes: ["ENERGY_RISE"] }),
        event: makeCluster(8, ["ENERGY_RISE"], { id: "ec-8" }),
        energyTrend: "RISING",
      })
    );
    const second = generateChoreographicIntent(
      ctx({
        cue: cue({
          id: "c2",
          rawTime: 10,
          isMajor: false,
          reasonCodes: ["ENERGY_RISE"],
          sourceEventClusterId: "ec-10",
        }),
        event: makeCluster(10, ["ENERGY_RISE"], { id: "ec-10" }),
        previousIntent: first.primary.intent,
        energyTrend: "RISING",
      })
    );
    if (second.primary.intent === first.primary.intent) {
      expect(second.primary.reasonCodes).toContain("INTENT_REPEAT");
    }
  });

  it("sequence walks cues once and stays ordered", () => {
    const cues = [
      cue({ id: "b", rawTime: 16, isMajor: true, sourceEventClusterId: "ec-16" }),
      cue({ id: "a", rawTime: 8, sourceEventClusterId: "ec-8" }),
    ];
    const seq = generateChoreographicIntentSequence({
      analysis: { cues },
      eventClusters: [
        makeCluster(8, ["ENERGY_RISE"], { id: "ec-8" }),
        makeCluster(16, ["SECTION_CHANGE"], { id: "ec-16", isMajor: true }),
      ],
      sections: [section("VERSE", 0, 16), section("CHORUS", 16, 32)],
      durationSec: 32,
    });
    expect(seq.intents.map((i) => i.cueId)).toEqual(["a", "b"]);
    expect(seq.intents[1]!.previousIntent).toBe(seq.intents[0]!.primary.intent);
  });
});
