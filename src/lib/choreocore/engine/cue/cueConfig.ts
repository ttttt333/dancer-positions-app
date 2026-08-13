import type { CueEngineConfig } from "../types/CueTypes";

export const CUE_ANALYSIS_VERSION = "3.0.0-phase3";

export const DEFAULT_CUE_ENGINE_CONFIG: CueEngineConfig = {
  lowPriorityCooldownBeats: 16,
  mediumPriorityCooldownBeats: 8,
  highPriorityCooldownBeats: 4,
  majorPriorityThreshold: 80,
  microShiftThreshold: 35,
  minimumConfidence: 0.6,
  anticipationBeats: 2,
  clusterMergeWindowSeconds: 0.2,
  repetitionPenalty: 10,
};

export function resolveCueEngineConfig(
  partial?: Partial<CueEngineConfig>
): CueEngineConfig {
  if (!partial) return DEFAULT_CUE_ENGINE_CONFIG;
  return { ...DEFAULT_CUE_ENGINE_CONFIG, ...partial };
}
