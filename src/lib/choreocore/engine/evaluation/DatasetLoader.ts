import type { BenchmarkDataset, BenchmarkDatasetItem, SongGroundTruth } from "../types/EvaluationTypes";
import { parseAnnotationJson, validateGroundTruth } from "./GroundTruthValidator";

export function loadAnnotation(raw: unknown): SongGroundTruth {
  return parseAnnotationJson(raw);
}

export function loadDataset(items: BenchmarkDatasetItem[], annotationVersion = "1.0.0"): BenchmarkDataset {
  return { annotationVersion, items: [...items].sort((a, b) => a.song.id.localeCompare(b.song.id)) };
}

export function assertDataset(dataset: BenchmarkDataset): void {
  for (const item of dataset.items) {
    const check = validateGroundTruth(item.groundTruth, item.song.duration);
    if (!check.ok) {
      throw new Error(`Invalid ground truth for ${item.song.id}: ${check.issues[0]?.message}`);
    }
  }
}
