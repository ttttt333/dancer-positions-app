import type { MusicPhrase } from "../types/MusicTypes";
import type { HumanPhraseAnnotation } from "../types/RealWorldTypes";
import { clamp, finite, mean } from "../evaluation/EvaluationMetrics";

function credit(human?: string, ai?: string): number {
  if (!human && !ai) return 1;
  if (human === ai) return 1;
  if (ai === "UNKNOWN" || human === "UNKNOWN") return 0.5;
  return 0;
}

export function evaluatePhrases(
  ai: MusicPhrase[],
  human: HumanPhraseAnnotation[],
  bpm: number
): { meanBoundaryError: number; classificationAccuracy: number; within1BeatRate: number } {
  if (human.length === 0 && ai.length === 0) {
    return { meanBoundaryError: 0, classificationAccuracy: 1, within1BeatRate: 1 };
  }
  const period = 60 / (bpm > 0 ? bpm : 120);
  const h = [...human].sort((a, b) => a.startTime - b.startTime);
  const a = [...ai].sort((x, y) => x.startTime - y.startTime);
  const n = Math.min(h.length, a.length);
  const errors: number[] = [];
  const credits: number[] = [];
  for (let i = 0; i < n; i += 1) {
    errors.push(Math.abs(h[i]!.startTime - a[i]!.startTime));
    credits.push(credit(h[i]!.type, a[i]!.type));
  }
  for (let i = n; i < Math.max(h.length, a.length); i += 1) credits.push(0);
  const within = errors.filter((e) => e <= period + 1e-9).length;
  return {
    meanBoundaryError: mean(errors),
    classificationAccuracy: clamp(finite(mean(credits)), 0, 1),
    within1BeatRate: errors.length === 0 ? 1 : within / errors.length,
  };
}
