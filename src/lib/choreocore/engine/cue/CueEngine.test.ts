/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { generateFormationCues } from "./CueEngine";
import { CUE_ANALYSIS_VERSION } from "./cueConfig";
import { cooldownBeatsForPriority } from "./CueScorer";
import { DEFAULT_CUE_ENGINE_CONFIG } from "./cueConfig";
import { analyzeMusicStructure } from "../music/MusicStructureAnalyzer";
import { patternA } from "../music/syntheticPhase1";
import {
  makeCluster,
  makePhase1,
  makeStructure,
  patternCueA,
  patternCueB,
  patternCueC,
  patternCueD,
  patternCueE,
  patternCueTimeline,
} from "./cueFixtures";

function run(
  clusters: ReturnType<typeof makeCluster>[],
  phase1 = makePhase1(80)
) {
  return generateFormationCues(makeStructure(clusters), phase1);
}

function active(result: ReturnType<typeof generateFormationCues>) {
  return result.cues.filter((c) => !c.suppressed);
}

describe("CueEngine", () => {
  it("TEST 01: low priority becomes HOLD or suppressed", () => {
    const result = run([
      makeCluster(8, ["SPECTRAL_CHANGE"], {
        strength: 8,
        confidence: 0.8,
        energyBefore: 40,
        energyAfter: 41,
      }),
    ]);
    const cues = active(result);
    expect(
      cues.length === 0 || cues.every((c) => c.action === "HOLD")
    ).toBe(true);
    expect(
      result.suppressedEvents.some((s) => s.reason === "LOW_PRIORITY") ||
        cues.some((c) => c.action === "HOLD")
    ).toBe(true);
  });

  it("TEST 02: medium priority is MICRO_SHIFT or a contextual action", () => {
    const result = run([
      makeCluster(8, ["HIT"], {
        strength: 42,
        confidence: 0.85,
        energyBefore: 50,
        energyAfter: 58,
      }),
    ]);
    const cue = active(result).find((c) => c.action !== "HOLD");
    expect(cue).toBeTruthy();
    expect(["MICRO_SHIFT", "CENTER", "EXPAND", "LINE"]).toContain(cue!.action);
  });

  it("TEST 03: major energy rise → EXPAND", () => {
    const result = run([
      makeCluster(8, ["ENERGY_RISE"], {
        strength: 88,
        confidence: 0.92,
        energyBefore: 30,
        energyAfter: 82,
        isMajor: true,
      }),
    ]);
    const cue = active(result).find(
      (c) => !c.reasonCodes.includes("ANTICIPATION")
    );
    expect(cue?.action).toBe("EXPAND");
    expect(result.intents[cue!.id]?.secondary).toEqual(
      expect.arrayContaining(["V", "DIAGONAL"])
    );
    expect(result.intents[cue!.id]?.prohibited).toContain("CLUSTER");
  });

  it("TEST 04: energy drop → CONTRACT", () => {
    const result = run([
      makeCluster(8, ["ENERGY_DROP"], {
        strength: 70,
        confidence: 0.9,
        energyBefore: 80,
        energyAfter: 25,
      }),
    ]);
    const cue = active(result).find((c) => c.action !== "HOLD" && !c.reasonCodes.includes("ANTICIPATION"));
    expect(cue?.action).toBe("CONTRACT");
  });

  it("TEST 05: bass entry → EXPAND / CENTER candidate", () => {
    const result = run([
      makeCluster(8, ["BASS_ENTRY"], {
        strength: 70,
        confidence: 0.88,
        energyBefore: 40,
        energyAfter: 72,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(["EXPAND", "CENTER"]).toContain(cue?.action);
    const intent = result.intents[cue!.id];
    expect([intent.primary, ...intent.secondary]).toEqual(
      expect.arrayContaining(["EXPAND", "CENTER"])
    );
  });

  it("TEST 06: drum entry → LINE / EXPAND candidate", () => {
    const result = run([
      makeCluster(8, ["DRUM_ENTRY"], {
        strength: 68,
        confidence: 0.86,
        energyBefore: 40,
        energyAfter: 60,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(["LINE", "EXPAND"]).toContain(cue?.action);
    const intent = result.intents[cue!.id];
    expect([intent.primary, ...intent.secondary]).toEqual(
      expect.arrayContaining(["LINE", "EXPAND"])
    );
  });

  it("TEST 07: drum break → CONTRACT / CLUSTER candidate", () => {
    const result = run([
      makeCluster(8, ["DRUM_BREAK"], {
        strength: 70,
        confidence: 0.87,
        energyBefore: 70,
        energyAfter: 35,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(["CONTRACT", "CLUSTER"]).toContain(cue?.action);
    const intent = result.intents[cue!.id];
    expect([intent.primary, ...intent.secondary]).toEqual(
      expect.arrayContaining(["CONTRACT", "CLUSTER"])
    );
  });

  it("TEST 08: major hit → MAJOR_CHANGE or strong MICRO_SHIFT", () => {
    const result = run([
      makeCluster(8, ["HIT"], {
        strength: 90,
        confidence: 0.95,
        energyBefore: 50,
        energyAfter: 70,
        isMajor: true,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(["MAJOR_CHANGE", "MICRO_SHIFT"]).toContain(cue?.action);
    expect(cue!.priority).toBeGreaterThanOrEqual(70);
  });

  it("TEST 09: section change is a large or major formation candidate", () => {
    const result = run([
      makeCluster(16, ["SECTION_CHANGE", "ENERGY_RISE"], {
        strength: 88,
        confidence: 0.93,
        energyBefore: 30,
        energyAfter: 80,
        isMajor: true,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(["MAJOR_CHANGE", "EXPAND", "V"]).toContain(cue?.action);
    expect(["LARGE", "MAX"]).toContain(cue?.magnitude);
  });

  it("TEST 10: high stable energy → HOLD", () => {
    const result = run([
      makeCluster(8, ["HIT"], {
        strength: 40,
        confidence: 0.8,
        energyBefore: 82,
        energyAfter: 84,
      }),
    ]);
    const cue = active(result)[0];
    expect(cue?.action).toBe("HOLD");
    expect(cue?.reasonCodes).toContain("ENERGY_PLATEAU");
  });

  it("TEST 11: low rising energy → PREPARATION / MICRO_SHIFT", () => {
    const result = run([
      makeCluster(8, ["ENERGY_RISE"], {
        strength: 50,
        confidence: 0.82,
        energyBefore: 18,
        energyAfter: 32,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(cue?.action).toBe("MICRO_SHIFT");
    expect(cue?.reasonCodes).toEqual(
      expect.arrayContaining(["PREPARATION", "LOW_RISING"])
    );
  });

  it("TEST 12: SECTION + HIT + ENERGY_RISE → one major cue", () => {
    const result = run([
      makeCluster(48, ["SECTION_CHANGE", "HIT", "ENERGY_RISE"], {
        strength: 92,
        confidence: 0.95,
        energyBefore: 30,
        energyAfter: 85,
        isMajor: true,
      }),
    ]);
    const majors = active(result).filter(
      (c) => c.isMajor && !c.reasonCodes.includes("ANTICIPATION")
    );
    expect(majors).toHaveLength(1);
    expect(majors[0]?.reasonCodes).toEqual(
      expect.arrayContaining(["SECTION_CHANGE", "HIT", "ENERGY_RISE"])
    );
  });

  it("TEST 13: three events within 0.2s compress to one cue", () => {
    const result = run([
      makeCluster(48.0, ["SECTION_CHANGE"], {
        strength: 92,
        confidence: 0.94,
        energyBefore: 30,
        energyAfter: 80,
        isMajor: true,
      }),
      makeCluster(48.15, ["HIT"], {
        strength: 80,
        confidence: 0.9,
        energyBefore: 32,
        energyAfter: 78,
      }),
      makeCluster(48.25, ["BASS_ENTRY"], {
        strength: 75,
        confidence: 0.88,
        energyBefore: 34,
        energyAfter: 76,
      }),
    ]);
    const clustered = active(result).filter(
      (c) => Math.abs(c.rawTime - 48) <= 0.3 && !c.reasonCodes.includes("ANTICIPATION")
    );
    expect(clustered).toHaveLength(1);
    expect(clustered[0]?.reasonCodes).toEqual(
      expect.arrayContaining(["SECTION_CHANGE", "HIT", "BASS_ENTRY"])
    );
    expect(result.suppressedEvents.some((s) => s.reason === "CLUSTER_MERGE")).toBe(
      true
    );
  });

  it("TEST 14: events more than 0.2s apart stay separate candidates", () => {
    const result = run([
      makeCluster(48.0, ["SECTION_CHANGE", "ENERGY_RISE"], {
        strength: 90,
        confidence: 0.94,
        energyBefore: 30,
        energyAfter: 82,
        isMajor: true,
      }),
      makeCluster(49.0, ["HIT", "ENERGY_RISE"], {
        strength: 88,
        confidence: 0.93,
        energyBefore: 50,
        energyAfter: 86,
        isMajor: true,
      }),
    ]);
    const cues = active(result).filter(
      (c) => !c.reasonCodes.includes("ANTICIPATION") && c.isMajor
    );
    expect(cues.length).toBeGreaterThanOrEqual(2);
  });

  it("TEST 15: low-priority repeats use a long cooldown", () => {
    expect(
      cooldownBeatsForPriority(20, false, DEFAULT_CUE_ENGINE_CONFIG)
    ).toBe(16);
    const result = run([
      makeCluster(8, ["PHRASE_CHANGE"], {
        strength: 36,
        confidence: 0.8,
        energyBefore: 45,
        energyAfter: 55,
      }),
      makeCluster(9, ["PHRASE_CHANGE"], {
        strength: 36,
        confidence: 0.8,
        energyBefore: 46,
        energyAfter: 56,
      }),
    ]);
    expect(result.suppressedEvents.some((s) => s.reason === "COOLDOWN")).toBe(
      true
    );
  });

  it("TEST 16: major override allows close major events", () => {
    const result = run([
      makeCluster(48, ["SECTION_CHANGE", "ENERGY_RISE"], {
        strength: 90,
        confidence: 0.95,
        energyBefore: 30,
        energyAfter: 82,
        isMajor: true,
      }),
      makeCluster(49, ["HIT", "ENERGY_RISE"], {
        strength: 88,
        confidence: 0.94,
        energyBefore: 40,
        energyAfter: 84,
        isMajor: true,
      }),
    ]);
    const majors = active(result).filter(
      (c) => c.isMajor && !c.reasonCodes.includes("ANTICIPATION")
    );
    expect(majors.length).toBeGreaterThanOrEqual(2);
  });

  it("TEST 17: EXPAND → EXPAND is penalized", () => {
    const result = run([
      makeCluster(8, ["ENERGY_RISE"], {
        strength: 72,
        confidence: 0.88,
        energyBefore: 40,
        energyAfter: 70,
      }),
      makeCluster(16, ["ENERGY_RISE"], {
        strength: 72,
        confidence: 0.88,
        energyBefore: 48,
        energyAfter: 78,
      }),
    ]);
    const expands = active(result).filter(
      (c) => c.action === "EXPAND" && !c.reasonCodes.includes("ANTICIPATION")
    );
    if (expands.length >= 2) {
      expect(expands[1]!.priority).toBeLessThan(expands[0]!.priority);
    } else {
      const second = active(result).find((c) => Math.abs(c.rawTime - 16) < 0.2);
      expect(
        second === undefined ||
          second.action === "MICRO_SHIFT" ||
          second.action === "HOLD" ||
          result.suppressedEvents.some((s) => s.reason === "COOLDOWN")
      ).toBe(true);
    }
  });

  it("TEST 18: major EXPAND survives repetition penalty", () => {
    const result = run([
      makeCluster(8, ["ENERGY_RISE"], {
        strength: 70,
        confidence: 0.88,
        energyBefore: 40,
        energyAfter: 68,
      }),
      makeCluster(10, ["ENERGY_RISE", "SECTION_CHANGE"], {
        strength: 92,
        confidence: 0.95,
        energyBefore: 45,
        energyAfter: 88,
        isMajor: true,
      }),
    ]);
    const second = active(result).find(
      (c) =>
        Math.abs(c.rawTime - 10) < 0.3 && !c.reasonCodes.includes("ANTICIPATION")
    );
    expect(second).toBeTruthy();
    expect(["EXPAND", "MAJOR_CHANGE"]).toContain(second!.action);
    expect(second!.isMajor).toBe(true);
  });

  it("TEST 19: high + falling energy → CONTRACT", () => {
    const result = run([
      makeCluster(8, ["SPECTRAL_CHANGE"], {
        strength: 55,
        confidence: 0.85,
        energyBefore: 88,
        energyAfter: 62,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(cue?.action).toBe("CONTRACT");
    expect(cue?.reasonCodes).toContain("HIGH_FALLING");
  });

  it("TEST 20: low + rising energy → PREPARATION / EXPAND candidate", () => {
    const result = run([
      makeCluster(8, ["ENERGY_RISE"], {
        strength: 48,
        confidence: 0.8,
        energyBefore: 16,
        energyAfter: 34,
      }),
    ]);
    const cue = active(result).find((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(cue?.action).toBe("MICRO_SHIFT");
    const intent = result.intents[cue!.id];
    expect([intent.primary, ...intent.secondary]).toContain("EXPAND");
    expect(cue?.reasonCodes).toContain("PREPARATION");
  });

  it("TEST 21: energy plateau (stable high) → HOLD", () => {
    const result = run([
      makeCluster(8, ["HIT"], {
        strength: 38,
        confidence: 0.8,
        energyBefore: 82,
        energyAfter: 83,
      }),
      makeCluster(12, ["HIT"], {
        strength: 36,
        confidence: 0.8,
        energyBefore: 83,
        energyAfter: 85,
      }),
    ]);
    expect(active(result).every((c) => c.action === "HOLD")).toBe(true);
  });

  it("TEST 22: confidence below 0.6 is suppressed or HOLD", () => {
    const result = run([
      makeCluster(8, ["HIT"], {
        strength: 50,
        confidence: 0.4,
        energyBefore: 40,
        energyAfter: 55,
      }),
    ]);
    expect(
      result.suppressedEvents.some((s) => s.reason === "LOW_CONFIDENCE")
    ).toBe(true);
    expect(
      active(result).every(
        (c) => c.action === "HOLD" || c.reasonCodes.includes("ANTICIPATION")
      )
    ).toBe(true);
  });

  it("TEST 23: major change at 48s gets an anticipation cue around 46-47s", () => {
    const result = run(
      [
        makeCluster(48, ["SECTION_CHANGE", "ENERGY_RISE"], {
          strength: 92,
          confidence: 0.95,
          energyBefore: 28,
          energyAfter: 86,
          isMajor: true,
        }),
      ],
      makePhase1(60)
    );
    const prep = active(result).find((c) =>
      c.reasonCodes.includes("ANTICIPATION")
    );
    expect(prep).toBeTruthy();
    expect(prep!.action).toBe("MICRO_SHIFT");
    expect(prep!.rawTime).toBeGreaterThanOrEqual(46);
    expect(prep!.rawTime).toBeLessThanOrEqual(47.5);
  });

  it("TEST 24: no anticipation when already changing at 47s", () => {
    const result = run(
      [
        makeCluster(47, ["DRUM_ENTRY"], {
          strength: 70,
          confidence: 0.9,
          energyBefore: 40,
          energyAfter: 62,
        }),
        makeCluster(48, ["SECTION_CHANGE", "ENERGY_RISE"], {
          strength: 92,
          confidence: 0.95,
          energyBefore: 30,
          energyAfter: 84,
          isMajor: true,
        }),
      ],
      makePhase1(60)
    );
    const prep = active(result).filter((c) =>
      c.reasonCodes.includes("ANTICIPATION")
    );
    expect(prep).toHaveLength(0);
  });

  it("TEST 25: cue generation is deterministic", () => {
    const clusters = [
      makeCluster(16, ["SECTION_CHANGE", "ENERGY_RISE"], {
        strength: 90,
        confidence: 0.94,
        energyBefore: 30,
        energyAfter: 80,
        isMajor: true,
      }),
      makeCluster(24, ["ENERGY_DROP"], {
        strength: 70,
        confidence: 0.88,
        energyBefore: 80,
        energyAfter: 30,
      }),
    ];
    const a = run(clusters);
    const b = run(clusters);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.analysisVersion).toBe(CUE_ANALYSIS_VERSION);
  });

  it("TEST 26: random source order still yields chronological cues", () => {
    const clusters = [
      makeCluster(24, ["ENERGY_DROP"], {
        strength: 80,
        confidence: 0.9,
        energyBefore: 80,
        energyAfter: 20,
        isMajor: true,
      }),
      makeCluster(8, ["ENERGY_RISE"], {
        strength: 80,
        confidence: 0.9,
        energyBefore: 20,
        energyAfter: 70,
        isMajor: true,
      }),
      makeCluster(16, ["HIT"], {
        strength: 50,
        confidence: 0.85,
        energyBefore: 55,
        energyAfter: 62,
      }),
    ];
    const result = run(clusters);
    const times = active(result).map((c) => c.rawTime);
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
  });

  it("TEST 27: cue IDs are unique and deterministic", () => {
    const clusters = [
      makeCluster(8, ["ENERGY_RISE"], {
        strength: 80,
        confidence: 0.9,
        energyBefore: 30,
        energyAfter: 70,
        isMajor: true,
      }),
      makeCluster(20, ["ENERGY_DROP"], {
        strength: 80,
        confidence: 0.9,
        energyBefore: 70,
        energyAfter: 25,
        isMajor: true,
      }),
    ];
    const a = run(clusters);
    const b = run(clusters);
    const ids = a.cues.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(b.cues.map((c) => c.id));
  });

  it("TEST 28: full Phase1 + Phase2 + Phase3 yields a valid CueAnalysisResult", () => {
    const phase1 = patternA();
    const structure = analyzeMusicStructure(phase1);
    const result = generateFormationCues(structure, phase1);
    expect(result.analysisVersion).toBe(CUE_ANALYSIS_VERSION);
    expect(Array.isArray(result.cues)).toBe(true);
    expect(typeof result.confidence).toBe("number");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.cues.length).toBeGreaterThan(0);
    for (const cue of result.cues) {
      expect(result.intents[cue.id]).toBeTruthy();
      expect(cue.priority).toBeGreaterThanOrEqual(0);
      expect(cue.priority).toBeLessThanOrEqual(100);
    }
  });

  it("TEST 29: weak repeated events keep suppression reasons", () => {
    const { phase1, structure } = patternCueE();
    const result = generateFormationCues(structure, phase1);
    expect(result.suppressedEvents.length).toBeGreaterThan(0);
    expect(
      result.suppressedEvents.every((s) => s.reason.length > 0 && s.eventClusterId)
    ).toBe(true);
  });

  it("TEST 30: complex synthetic song does not produce excessive cue density", () => {
    const clusters = [];
    for (let t = 4; t <= 72; t += 2) {
      const major = t === 16 || t === 48;
      clusters.push(
        makeCluster(t, major ? ["SECTION_CHANGE", "ENERGY_RISE"] : ["HIT"], {
          strength: major ? 90 : 25,
          confidence: major ? 0.94 : 0.7,
          energyBefore: major ? 30 : 80,
          energyAfter: major ? 85 : 82,
          isMajor: major,
        })
      );
    }
    const result = run(clusters, makePhase1(80));
    const changes = active(result).filter((c) => c.action !== "HOLD");
    expect(changes.length).toBeLessThanOrEqual(clusters.length);
    const majors = changes.filter((c) => c.isMajor);
    expect(majors.length).toBeLessThanOrEqual(6);
  });

  it("PATTERN_A: HOLD → MAJOR EXPAND → HOLD", () => {
    const { phase1, structure } = patternCueA();
    const result = generateFormationCues(structure, phase1);
    const cues = active(result).filter((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(cues[0]?.action).toBe("HOLD");
    const rise = cues.find((c) => Math.abs(c.rawTime - 16) < 0.2);
    expect(["EXPAND", "MAJOR_CHANGE"]).toContain(rise?.action);
    expect(rise?.magnitude).toMatch(/LARGE|MAX/);
    const later = cues.filter((c) => c.rawTime > 20);
    expect(later.every((c) => c.action === "HOLD" || c.action === "MICRO_SHIFT")).toBe(
      true
    );
  });

  it("PATTERN_B: EXPAND → HOLD → CONTRACT", () => {
    const { phase1, structure } = patternCueB();
    const result = generateFormationCues(structure, phase1);
    const cues = active(result).filter((c) => !c.reasonCodes.includes("ANTICIPATION"));
    expect(cues.find((c) => Math.abs(c.rawTime - 8) < 0.2)?.action).toBe("EXPAND");
    expect(cues.find((c) => Math.abs(c.rawTime - 16) < 0.2)?.action).toBe("HOLD");
    expect(cues.find((c) => Math.abs(c.rawTime - 24) < 0.2)?.action).toBe(
      "CONTRACT"
    );
  });

  it("PATTERN_C: stable high keeps HOLD plus occasional MICRO_SHIFT", () => {
    const { phase1, structure } = patternCueC();
    const result = generateFormationCues(structure, phase1);
    const cues = active(result);
    expect(cues.some((c) => c.action === "HOLD")).toBe(true);
    expect(cues.every((c) => c.action === "HOLD" || c.action === "MICRO_SHIFT")).toBe(
      true
    );
    expect(cues.filter((c) => c.action === "MAJOR_CHANGE")).toHaveLength(0);
  });

  it("PATTERN_D: one major cue per tight cluster", () => {
    const { phase1, structure } = patternCueD();
    const result = generateFormationCues(structure, phase1);
    const majors = active(result).filter(
      (c) => c.isMajor && !c.reasonCodes.includes("ANTICIPATION")
    );
    expect(majors.length).toBe(2);
  });

  it("PATTERN_E: frequent weak events are mostly suppressed", () => {
    const { phase1, structure } = patternCueE();
    const result = generateFormationCues(structure, phase1);
    const changes = active(result).filter((c) => c.action !== "HOLD");
    expect(changes.length).toBeLessThan(4);
    expect(result.suppressedEvents.length).toBeGreaterThan(10);
  });

  it("timeline: 48 major, 56 micro, 64 hold, 72 contract", () => {
    const { phase1, structure } = patternCueTimeline();
    const result = generateFormationCues(structure, phase1);
    const at = (t: number) =>
      active(result).find(
        (c) => Math.abs(c.rawTime - t) < 0.35 && !c.reasonCodes.includes("ANTICIPATION")
      );
    expect(["MAJOR_CHANGE", "EXPAND"]).toContain(at(48)?.action);
    expect(at(48)?.reasonCodes).toEqual(
      expect.arrayContaining([
        "SECTION_CHANGE",
        "ENERGY_RISE",
        "BASS_ENTRY",
        "HIT",
      ])
    );
    expect(["MICRO_SHIFT", "CENTER"]).toContain(at(56)?.action);
    expect(at(64)?.action).toBe("HOLD");
    expect(at(72)?.action).toBe("CONTRACT");
  });

  it("SPLIT / MERGE intents are available from spectral + energy pairs", () => {
    const split = run([
      makeCluster(8, ["SPECTRAL_CHANGE", "ENERGY_RISE"], {
        strength: 60,
        confidence: 0.85,
        energyBefore: 40,
        energyAfter: 62,
      }),
    ]);
    const merge = run([
      makeCluster(8, ["SPECTRAL_CHANGE", "ENERGY_DROP"], {
        strength: 60,
        confidence: 0.85,
        energyBefore: 70,
        energyAfter: 40,
      }),
    ]);
    expect(
      active(split).some((c) => c.action === "SPLIT" || c.action === "EXPAND")
    ).toBe(true);
    expect(
      active(merge).some((c) => c.action === "MERGE" || c.action === "CONTRACT")
    ).toBe(true);
  });
});
