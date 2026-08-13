/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  calculateHumanCeiling,
  calculateHumanCeilingRatio,
  findConsensusReviews,
  groundTruthConfidence,
} from "./HumanCeiling";
import { realWorldPilotDataset } from "./pilotDataset";
import { humanCue } from "../evaluation/syntheticDataset";
import type { RealSongAnnotations } from "../types/RealWorldTypes";
import { ANNOTATION_VERSION } from "../types/EvaluationTypes";

function emptyAnn(songId: string, annotatorId: string): RealSongAnnotations {
  return {
    songId,
    annotatorId,
    annotationVersion: ANNOTATION_VERSION,
    sections: [],
    phrases: [],
    cues: [humanCue(songId, 16, "EXPAND", { annotatorId })],
    formations: [],
    sequence: [],
  };
}

describe("HumanCeiling", () => {
  it("TEST 05: human ceiling from two annotators", () => {
    const { annotations } = realWorldPilotDataset();
    const ceiling = calculateHumanCeiling(annotations, 120, 1);
    expect(ceiling.pairs).toBeGreaterThan(0);
    expect(ceiling.overall).toBeGreaterThan(0.5);
    expect(ceiling.formationTop3).toBeGreaterThan(0.5);
  });

  it("TEST 06: human ceiling ratio", () => {
    const ceiling = { cueMatchRate: 0.85, formationTop3: 0.85, sequenceCorrelation: 0.85, overall: 0.85, pairs: 1 };
    const ratio = calculateHumanCeilingRatio(
      { cue: 0.8, formationTop3: 0.8, sequence: 0.8, overall: 0.8 },
      ceiling
    );
    expect(ratio.overall).toBeCloseTo(0.8 / 0.85, 8);
    expect(ratio.formationTop3).toBeCloseTo(0.8 / 0.85, 8);
  });

  it("TEST 21: ground truth confidence bands", () => {
    expect(groundTruthConfidence(0.9)).toBe("HIGH");
    expect(groundTruthConfidence(0.6)).toBe("MEDIUM");
    expect(groundTruthConfidence(0.2)).toBe("LOW");
  });

  it("TEST 22: consensus review lists split top-1", () => {
    const { annotations } = realWorldPilotDataset();
    const reviews = findConsensusReviews(annotations);
    expect(reviews.some((r) => r.songId === "real-008")).toBe(true);
    const row = reviews.find((r) => r.songId === "real-008");
    expect(new Set(row?.humanChoices.map((c) => c.formationType)).size).toBeGreaterThan(1);
  });

  it("human disagreement lowers ceiling", () => {
    const same = calculateHumanCeiling(
      [
        { ...emptyAnn("s", "a"), cues: [humanCue("s", 16, "EXPAND", { annotatorId: "a" })] },
        { ...emptyAnn("s", "b"), cues: [humanCue("s", 16, "EXPAND", { annotatorId: "b" })] },
      ],
      120,
      1
    );
    const diff = calculateHumanCeiling(
      [
        { ...emptyAnn("s", "a"), cues: [humanCue("s", 16, "EXPAND", { annotatorId: "a" })] },
        { ...emptyAnn("s", "b"), cues: [humanCue("s", 16, "CONTRACT", { annotatorId: "b" })] },
      ],
      120,
      1
    );
    expect(same.cueMatchRate).toBeGreaterThanOrEqual(diff.cueMatchRate);
  });
});
