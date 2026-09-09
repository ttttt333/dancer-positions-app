import type { ConditionTags, TempoCategory } from "./types";

export type ConditionKey =
  | `genre:${string}`
  | `tempo:${TempoCategory}`
  | `complexity:${string}`
  | `vocal:${string}`
  | `energy:${string}`
  | `beatDensity:${string}`;

/** Expand a song's tags into flat condition keys for profile rollup */
export function conditionKeysFromTags(tags: ConditionTags): ConditionKey[] {
  const keys: ConditionKey[] = [`genre:${tags.genre}`, `tempo:${tags.tempoCategory}`];
  if (tags.structuralComplexity) {
    keys.push(`complexity:${tags.structuralComplexity}`);
  }
  if (tags.vocalPresence) keys.push(`vocal:${tags.vocalPresence}`);
  if (tags.energy) keys.push(`energy:${tags.energy}`);
  if (tags.beatDensity) keys.push(`beatDensity:${tags.beatDensity}`);
  return keys;
}

export function classifyDurationBucket(
  durationSeconds: number
): "short" | "medium" | "long" {
  if (durationSeconds < 90) return "short";
  if (durationSeconds < 240) return "medium";
  return "long";
}
