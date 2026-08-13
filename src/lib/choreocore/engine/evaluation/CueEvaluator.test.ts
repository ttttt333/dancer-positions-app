/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { evaluateCues } from "./CueEvaluator";
import { makeCue } from "../formation/formationFixtures";
import { humanCue } from "./syntheticDataset";

const bpm = 120;

describe("CueEvaluator", () => {
  it("TEST 01: perfect cue match is precision=recall=f1=1", () => {
    const human = [humanCue("s", 48, "MAJOR_CHANGE", { importance: 90 })];
    const ai = [makeCue("MAJOR_CHANGE", "MAX", { rawTime: 48, isMajor: true })];
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(1);
    expect(m.f1).toBe(1);
  });

  it("TEST 02: ±0.2s timing has low error", () => {
    const human = [humanCue("s", 48, "EXPAND")];
    const ai = [makeCue("EXPAND", "LARGE", { rawTime: 47.8 })];
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.timingErrorMean).toBeCloseTo(0.2, 5);
    expect(m.f1).toBe(1);
  });

  it("TEST 03: a missed cue lowers recall", () => {
    const human = [humanCue("s", 16, "EXPAND"), humanCue("s", 32, "MAJOR_CHANGE", { importance: 90 })];
    const ai = [makeCue("EXPAND", "LARGE", { rawTime: 16 })];
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.recall).toBeLessThan(1);
    expect(m.underGenerationRate).toBeGreaterThan(0);
  });

  it("TEST 04: a false positive lowers precision", () => {
    const human = [humanCue("s", 16, "EXPAND")];
    const ai = [
      makeCue("EXPAND", "LARGE", { rawTime: 16, id: "a" }),
      makeCue("MICRO_SHIFT", "SMALL", { rawTime: 20, id: "b" }),
    ];
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.precision).toBeLessThan(1);
  });

  it("TEST 05: major cue recall counts importance >= 80", () => {
    const human = [
      humanCue("s", 16, "EXPAND", { importance: 40 }),
      humanCue("s", 32, "MAJOR_CHANGE", { importance: 90 }),
    ];
    const ai = [
      makeCue("EXPAND", "MEDIUM", { rawTime: 16, id: "a", isMajor: false }),
      makeCue("MAJOR_CHANGE", "MAX", { rawTime: 32, id: "b", isMajor: true }),
    ];
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.majorCueRecall).toBe(1);
  });

  it("TEST 06: overgeneration rate is high when AI emits extra cues", () => {
    const human = [humanCue("s", 16, "EXPAND")];
    const ai = [8, 12, 16, 20, 24].map((t, i) =>
      makeCue("MICRO_SHIFT", "SMALL", { rawTime: t, id: `c${i}` })
    );
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.overgenerationRate).toBeGreaterThan(0.5);
  });

  it("TEST 07: under-generation rate is high when AI misses cues", () => {
    const human = [8, 16, 24, 32].map((t) => humanCue("s", t, "EXPAND"));
    const ai = [makeCue("EXPAND", "LARGE", { rawTime: 16 })];
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.underGenerationRate).toBeGreaterThan(0.5);
  });

  it("TEST 33: beat error is 0 on the same beat", () => {
    const human = [humanCue("s", 8, "EXPAND")];
    const ai = [makeCue("EXPAND", "LARGE", { rawTime: 8 })];
    const m = evaluateCues(ai, human, bpm, 1, 80);
    expect(m.beatErrorMean).toBe(0);
  });

  it("TEST 34: median timing is robust to an outlier", () => {
    const human = [16, 32, 48].map((t) => humanCue("s", t, "EXPAND"));
    const ai = [
      makeCue("EXPAND", "LARGE", { rawTime: 16, id: "a" }),
      makeCue("EXPAND", "LARGE", { rawTime: 32.1, id: "b" }),
      makeCue("EXPAND", "LARGE", { rawTime: 51, id: "c" }),
    ];
    const m = evaluateCues(ai, human, bpm, 16, 80);
    expect(m.timingErrorMedian).toBeLessThan(m.timingErrorMean);
  });
});
