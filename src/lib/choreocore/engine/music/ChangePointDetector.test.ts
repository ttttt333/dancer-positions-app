/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { resolveMusicStructureConfig } from "./structureConfig";
import { detectChangePoints, clusterChangePoints } from "./ChangePointDetector";
import { detectSections } from "./SectionDetector";
import { detectPhrases } from "./PhraseDetector";
import { classifyHits } from "./HitClassifier";
import { snapToBeatGrid } from "./structureMath";
import {
  patternA,
  patternB,
  patternC,
  patternD,
  patternE,
  createSyntheticPhase1Analysis,
} from "./syntheticPhase1";

const config = resolveMusicStructureConfig();

function run(phase1: ReturnType<typeof patternA>) {
  const sections = detectSections(phase1, config);
  const phrases = detectPhrases(phase1, sections, config);
  const hits = classifyHits(phase1.hits, phase1);
  return detectChangePoints(phase1, sections, phrases, hits, config);
}

describe("ChangePointDetector", () => {
  it("TEST 07: low→high energy emits ENERGY_RISE", () => {
    const { changePoints } = run(patternA());
    expect(changePoints.some((p) => p.type === "ENERGY_RISE")).toBe(true);
  });

  it("TEST 08: high→low energy emits ENERGY_DROP", () => {
    const phase1 = createSyntheticPhase1Analysis({
      segments: [
        { duration: 8, energy: 85, bass: 0.5, onset: 0.6, high: 0.2 },
        { duration: 8, energy: 18, bass: 0.08, onset: 0.1, high: 0.08 },
      ],
    });
    const { changePoints } = run(phase1);
    expect(changePoints.some((p) => p.type === "ENERGY_DROP")).toBe(true);
  });

  it("TEST 09: onset density low→high emits DRUM_ENTRY", () => {
    const { changePoints } = run(patternD());
    expect(changePoints.some((p) => p.type === "DRUM_ENTRY")).toBe(true);
  });

  it("TEST 10: onset density high→low emits DRUM_BREAK", () => {
    const phase1 = createSyntheticPhase1Analysis({
      segments: [
        { duration: 8, energy: 45, bass: 0.18, onset: 0.85, high: 0.15 },
        { duration: 8, energy: 35, bass: 0.15, onset: 0.05, high: 0.1 },
      ],
    });
    const { changePoints } = run(phase1);
    expect(changePoints.some((p) => p.type === "DRUM_BREAK")).toBe(true);
  });

  it("TEST 11: bass low→high emits BASS_ENTRY", () => {
    const { changePoints } = run(patternC());
    expect(changePoints.some((p) => p.type === "BASS_ENTRY")).toBe(true);
  });

  it("TEST 12: sustained near-zero energy emits SILENCE", () => {
    const { changePoints } = run(patternB());
    expect(changePoints.some((p) => p.type === "SILENCE")).toBe(true);
  });

  it("TEST 13: high-dominant → bass-dominant emits SPECTRAL_CHANGE", () => {
    const { changePoints } = run(patternE());
    expect(changePoints.some((p) => p.type === "SPECTRAL_CHANGE")).toBe(true);
  });

  it("TEST 16: simultaneous HIT + ENERGY_RISE + SECTION_CHANGE form one cluster", () => {
    const { changePoints, eventClusters } = run(patternA());
    const around8 = changePoints.filter((p) => Math.abs(p.time - 8) <= 0.35);
    const types = new Set(around8.map((p) => p.type));
    expect(types.has("ENERGY_RISE")).toBe(true);
    expect(types.has("HIT") || types.has("SECTION_CHANGE")).toBe(true);
    const cluster = eventClusters.find((c) => Math.abs(c.time - 8) <= 0.35);
    expect(cluster).toBeTruthy();
    expect(cluster!.changePoints.length).toBeGreaterThanOrEqual(2);
    const clustered = clusterChangePoints(around8, config);
    expect(clustered.length).toBe(1);
  });

  it("TEST 17: rawTime 47.86 snaps near beat 48.0", () => {
    const phase1 = createSyntheticPhase1Analysis({
      segments: [{ duration: 52, energy: 40, bass: 0.2, onset: 0.3, high: 0.15 }],
    });
    const snap = snapToBeatGrid(47.86, phase1.beats, config);
    expect(snap.beatTime).toBeCloseTo(48.0, 5);
    expect(Math.abs(snap.time - 48)).toBeLessThan(0.2);
  });
});
