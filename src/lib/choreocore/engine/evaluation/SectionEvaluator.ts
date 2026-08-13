import type { MusicSection } from "../types/MusicTypes";
import type { HumanSectionAnnotation, SectionMetrics } from "../types/EvaluationTypes";
import { beatPeriodSec } from "./EvaluationConfig";
import { clamp, finite, mean, median } from "./EvaluationMetrics";

function classifyCredit(
  human: HumanSectionAnnotation["type"],
  ai: MusicSection["type"]
): number {
  if (human === ai) return 1;
  if (ai === "UNKNOWN" || human === "UNKNOWN") return 0.5;
  if (
    (human === "CHORUS" && ai === "FINAL_CHORUS") ||
    (human === "FINAL_CHORUS" && ai === "CHORUS")
  ) {
    return 0.6;
  }
  return 0;
}

export function evaluateSections(
  ai: MusicSection[],
  human: HumanSectionAnnotation[],
  bpm: number
): SectionMetrics {
  if (human.length === 0 && ai.length === 0) {
    return {
      meanBoundaryError: 0,
      medianBoundaryError: 0,
      within1BeatRate: 1,
      within2BeatRate: 1,
      classificationAccuracy: 1,
    };
  }
  const period = beatPeriodSec(bpm);
  const h = [...human].sort((a, b) => a.startTime - b.startTime);
  const a = [...ai].sort((x, y) => x.startTime - y.startTime);
  const n = Math.max(h.length, a.length);
  const errors: number[] = [];
  const credits: number[] = [];
  for (let i = 0; i < Math.min(h.length, a.length); i += 1) {
    errors.push(Math.abs(h[i]!.startTime - a[i]!.startTime));
    credits.push(classifyCredit(h[i]!.type, a[i]!.type));
  }
  if (h.length > 0 && a.length > 0) {
    errors.push(Math.abs(h[h.length - 1]!.endTime - a[a.length - 1]!.endTime));
  }
  for (let i = Math.min(h.length, a.length); i < n; i += 1) {
    credits.push(0);
  }
  const within1 = errors.filter((e) => e <= period + 1e-9).length;
  const within2 = errors.filter((e) => e <= period * 2 + 1e-9).length;
  return {
    meanBoundaryError: mean(errors),
    medianBoundaryError: median(errors),
    within1BeatRate: errors.length === 0 ? 1 : within1 / errors.length,
    within2BeatRate: errors.length === 0 ? 1 : within2 / errors.length,
    classificationAccuracy: clamp(finite(mean(credits)), 0, 1),
  };
}
