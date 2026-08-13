/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  RealWorldDatasetError,
  assertRealWorldDataset,
  bpmBucket,
  validateRealSongMetadata,
  validateRealWorldDataset,
} from "./RealDatasetValidator";
import { realWorldPilotDataset } from "./pilotDataset";
import { ANNOTATION_VERSION } from "../types/EvaluationTypes";
import type { RealSongMetadata, RealWorldDataset } from "../types/RealWorldTypes";

function validMeta(extra: Partial<RealSongMetadata> = {}): RealSongMetadata {
  return {
    id: "real-001",
    title: "Test",
    bpm: 120,
    duration: 32,
    category: "ENERGY_DRIVEN",
    difficulty: "EASY",
    audioHash: "hash-1",
    rightsConfirmed: true,
    ...extra,
  };
}

describe("RealDatasetValidator", () => {
  it("TEST 01: real dataset metadata validation", () => {
    const issues = validateRealSongMetadata(validMeta());
    expect(issues).toEqual([]);
  });

  it("TEST 02: rightsConfirmed validation", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    dataset.items[0]!.song.rightsConfirmed = false;
    const check = validateRealWorldDataset(dataset, annotations);
    expect(check.eligible.every((i) => i.song.rightsConfirmed)).toBe(true);
    expect(check.eligible.length).toBe(9);
  });

  it("TEST 03: category validation", () => {
    const issues = validateRealSongMetadata(validMeta({ category: "POP" as RealSongMetadata["category"] }));
    expect(issues.some((i) => i.field === "category")).toBe(true);
  });

  it("TEST 04: difficulty validation", () => {
    const issues = validateRealSongMetadata(validMeta({ difficulty: "INSANE" as RealSongMetadata["difficulty"] }));
    expect(issues.some((i) => i.field === "difficulty")).toBe(true);
  });

  it("TEST 30: invalid dataset throws", () => {
    const dataset: RealWorldDataset = { annotationVersion: "", items: [] };
    expect(() => assertRealWorldDataset(dataset, [])).toThrow(RealWorldDatasetError);
  });

  it("TEST 31: no rights-confirmed songs", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    for (const item of dataset.items) item.song.rightsConfirmed = false;
    const check = validateRealWorldDataset(dataset, annotations);
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.field === "rightsConfirmed")).toBe(true);
  });

  it("TEST 32: duplicate song ids", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    dataset.items[1]!.song.id = dataset.items[0]!.song.id;
    const check = validateRealWorldDataset(dataset, annotations);
    expect(check.issues.some((i) => i.message === "duplicate song")).toBe(true);
  });

  it("TEST 33: missing annotation", () => {
    const { dataset } = realWorldPilotDataset();
    const check = validateRealWorldDataset(dataset, []);
    expect(check.issues.some((i) => i.message === "missing annotation")).toBe(true);
  });

  it("TEST 34: invalid annotation time", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    annotations[0]!.cues[0]!.time = 9999;
    const check = validateRealWorldDataset(dataset, annotations);
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.field === "annotations")).toBe(true);
  });

  it("maps BPM buckets", () => {
    expect(bpmBucket(80)).toBe("60-90");
    expect(bpmBucket(100)).toBe("90-120");
    expect(bpmBucket(130)).toBe("120-150");
    expect(bpmBucket(160)).toBe("150+");
    expect(bpmBucket(undefined)).toBeUndefined();
  });

  it("accepts annotationVersion on a valid pilot", () => {
    const { dataset, annotations } = realWorldPilotDataset();
    expect(dataset.annotationVersion).toBe(ANNOTATION_VERSION);
    expect(assertRealWorldDataset(dataset, annotations).length).toBe(10);
  });
});
