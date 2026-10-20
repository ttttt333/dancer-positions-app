/**
 * FLY Analyzer Adapter contract — multiple engines plug in here.
 * Results never go straight to Formation Engine.
 */

import type { TempoAnalysis, BeatAnalysis } from "../types";

export type FlyAnalyzerCapability =
  | "tempo"
  | "beat"
  | "downbeat"
  | "onset"
  | "loudness"
  | "spectral"
  | "tonal"
  | "key"
  | "chords"
  | "segmentation";

export type FlyAudioInput = {
  /** Decoded mono/interleaved PCM */
  samples: Float32Array;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  audioHash?: string;
  format?: string;
};

export type FlyAnalyzerSourceMeta = {
  source: string;
  version: string;
  analyzedAt: string;
  capabilities: FlyAnalyzerCapability[];
};

/** Per-metric provenance for Fusion / Analysis Lab */
export type FlyMetricProvenanceEntry = {
  analyzer: string;
  confidence: number;
  value?: number | string | null;
  note?: string;
};

export type FlyMetricProvenance = {
  metric: string;
  value: number | string | null;
  sources: FlyMetricProvenanceEntry[];
};

export type FlyNormalizedOnset = {
  time: number;
  strength: number;
  confidence: number;
};

export type FlyNormalizedDownbeat = {
  time: number;
  confidence: number;
};

/**
 * Partial analysis from one adapter.
 * Missing fields = unavailable (do not invent).
 */
export type FlyAnalyzerResult = {
  analyzerId: string;
  adapterVersion: string;
  meta: FlyAnalyzerSourceMeta;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  /** Partial — only fields the analyzer actually produced */
  tempo?: Partial<TempoAnalysis> | null;
  beat?: Partial<BeatAnalysis> & {
    beatConfidences?: number[];
  } | null;
  downbeats?: FlyNormalizedDownbeat[] | null;
  onsets?: FlyNormalizedOnset[] | null;
  provenance?: FlyMetricProvenance[];
};

export interface FlyAnalyzerAdapter {
  id: string;
  version: string;
  capabilities: FlyAnalyzerCapability[];
  analyze(audio: FlyAudioInput): Promise<FlyAnalyzerResult>;
}
