import type { AudioFeatureFrame, BeatEvent, TempoAnalysis } from "./AudioTypes";
import type { EnergyCurve } from "./EnergyTypes";
import type { HitEvent } from "./HitTypes";

export type EnergyWeights = {
  rms: number;
  spectralFlux: number;
  bass: number;
  onset: number;
  high: number;
  lowMidMid: number;
};

export type AudioAnalysisConfig = {
  frameSize: number;
  hopSize: number;
  smoothingWindow: number;
  minBpm: number;
  maxBpm: number;
  minimumHitInterval: number;
  energyWeights: EnergyWeights;
};

/**
 * Phase 1 pipeline output. Section / phrase / cue fields are intentionally
 * omitted so Phase 2 can extend this without breaking callers.
 *
 * provenance は必須:
 * - "real" … PCM から AudioAnalyzer が出した本物
 * - "synthetic" … peaks から作った Legacy Compatibility（Phase1 ではない）
 */
export type Phase1Provenance = "real" | "synthetic";

export type MusicAnalysisResultPhase1 = {
  duration: number;
  sampleRate: number;
  tempo: TempoAnalysis;
  frames: AudioFeatureFrame[];
  energyCurve: EnergyCurve;
  beats: BeatEvent[];
  hits: HitEvent[];
  analysisVersion: string;
  confidence: number;
  provenance: Phase1Provenance;
};

export type AnalysisSummary = {
  duration: number;
  bpm: number;
  bpmConfidence: number;
  frameCount: number;
  beatCount: number;
  hitCount: number;
  energyAverage: number;
  energyPeak: number;
  dynamicRange: number;
};
