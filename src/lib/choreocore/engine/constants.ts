import type { AudioAnalysisConfig, EnergyWeights } from "./types/AnalysisTypes";

/**
 * Music-engine analysis version.
 * Bump when frame / energy / beat / onset algorithms change so caches invalidate.
 */
export const ANALYSIS_VERSION = "3.0.0-phase1";

export const DEFAULT_ENERGY_WEIGHTS: EnergyWeights = {
  rms: 0.3,
  spectralFlux: 0.2,
  bass: 0.15,
  onset: 0.2,
  high: 0.05,
  lowMidMid: 0.1,
};

export const DEFAULT_ANALYSIS_CONFIG: AudioAnalysisConfig = {
  frameSize: 2048,
  hopSize: 512,
  smoothingWindow: 5,
  minBpm: 60,
  maxBpm: 180,
  minimumHitInterval: 0.15,
  energyWeights: DEFAULT_ENERGY_WEIGHTS,
};

/** Window length for local RMS / band energy (samples). */
export const FRAME_SIZE = DEFAULT_ANALYSIS_CONFIG.frameSize;

/** Hop between successive feature frames (samples). ~11.6 ms at 44.1 kHz. */
export const HOP_SIZE = DEFAULT_ANALYSIS_CONFIG.hopSize;

/** Tempo search range. Phase 1 default is 60–180 (octave-safe for dance). */
export const MIN_BPM = DEFAULT_ANALYSIS_CONFIG.minBpm;
export const MAX_BPM = DEFAULT_ANALYSIS_CONFIG.maxBpm;

/** Phase 1 assumes 4/4. Isolated so 3/4 can swap this later. */
export const DEFAULT_BEATS_PER_BAR = 4;

export function resolveAnalysisConfig(
  partial?: Partial<AudioAnalysisConfig>
): AudioAnalysisConfig {
  if (!partial) return DEFAULT_ANALYSIS_CONFIG;
  return {
    frameSize: partial.frameSize ?? DEFAULT_ANALYSIS_CONFIG.frameSize,
    hopSize: partial.hopSize ?? DEFAULT_ANALYSIS_CONFIG.hopSize,
    smoothingWindow:
      partial.smoothingWindow ?? DEFAULT_ANALYSIS_CONFIG.smoothingWindow,
    minBpm: partial.minBpm ?? DEFAULT_ANALYSIS_CONFIG.minBpm,
    maxBpm: partial.maxBpm ?? DEFAULT_ANALYSIS_CONFIG.maxBpm,
    minimumHitInterval:
      partial.minimumHitInterval ?? DEFAULT_ANALYSIS_CONFIG.minimumHitInterval,
    energyWeights: {
      ...DEFAULT_ENERGY_WEIGHTS,
      ...partial.energyWeights,
    },
  };
}
