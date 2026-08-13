/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { evaluateSections } from "./SectionEvaluator";
import { section } from "../cue/cueFixtures";

describe("SectionEvaluator", () => {
  it("TEST 08: perfect sections have high accuracy", () => {
    const human = [
      { songId: "s", annotatorId: "a", startTime: 0, endTime: 16, type: "INTRO" as const, confidence: 1 },
      { songId: "s", annotatorId: "a", startTime: 16, endTime: 32, type: "CHORUS" as const, confidence: 1 },
    ];
    const ai = [section("INTRO", 0, 16), section("CHORUS", 16, 32)];
    const m = evaluateSections(ai, human, 120);
    expect(m.classificationAccuracy).toBe(1);
    expect(m.meanBoundaryError).toBe(0);
  });

  it("TEST 09: offset sections produce boundary error", () => {
    const human = [
      { songId: "s", annotatorId: "a", startTime: 16, endTime: 32, type: "CHORUS" as const, confidence: 1 },
    ];
    const ai = [section("CHORUS", 17.5, 32)];
    const m = evaluateSections(ai, human, 120);
    expect(m.meanBoundaryError).toBeGreaterThan(0.5);
  });

  it("TEST 10: matching types are classified correctly", () => {
    const human = [
      { songId: "s", annotatorId: "a", startTime: 0, endTime: 16, type: "VERSE" as const, confidence: 1 },
    ];
    const ai = [section("VERSE", 0, 16)];
    expect(evaluateSections(ai, human, 120).classificationAccuracy).toBe(1);
  });

  it("TEST 32: UNKNOWN gets partial credit", () => {
    const human = [
      { songId: "s", annotatorId: "a", startTime: 0, endTime: 16, type: "CHORUS" as const, confidence: 1 },
    ];
    const unknown = evaluateSections([section("UNKNOWN", 0, 16)], human, 120);
    const wrong = evaluateSections([section("VERSE", 0, 16)], human, 120);
    expect(unknown.classificationAccuracy).toBe(0.5);
    expect(unknown.classificationAccuracy).toBeGreaterThan(wrong.classificationAccuracy);
  });
});
