/**
 * FLY Benchmark / Ground Truth contracts (Phase 4.5)
 * Isolated from production Fusion weight updates.
 */

import type { EvidenceConfidence } from "./versions";

export type FlyGtSectionLabel =
  | "INTRO"
  | "VERSE"
  | "PRE_CHORUS"
  | "CHORUS"
  | "BRIDGE"
  | "BREAK"
  | "OUTRO"
  | "OTHER"
  | (string & {});

export type FlyGtEventType =
  | "BREAK"
  | "DROP"
  | "IMPACT"
  | "ENERGY_RISE"
  | "ENERGY_FALL"
  | "VOCAL_ENTRY"
  | "VOCAL_EXIT"
  | "DRUM_ENTRY"
  | "DRUM_BREAK"
  | "SECTION_CHANGE";

export type TempoCategory = "slow" | "medium" | "fast" | "variable";

export type ConditionTags = {
  genre: string;
  tempoCategory: TempoCategory;
  durationBucket?: "short" | "medium" | "long";
  energy?: "low" | "medium" | "high";
  vocalPresence?: "instrumental" | "mixed" | "vocal-heavy";
  beatDensity?: "sparse" | "normal" | "dense";
  structuralComplexity?: "simple" | "moderate" | "complex";
  audioQuality?: "studio" | "live" | "low";
  flags?: string[];
};

export type FlyGtSection = {
  startTime: number;
  endTime: number;
  label: FlyGtSectionLabel;
  confidence: number;
  annotatorId: string;
  annotationVersion: string;
};

export type FlyGtBeat = {
  beatTime: number;
  beatIndex: number;
  confidence: number;
  annotatorId: string;
};

export type FlyGtDownbeat = {
  downbeatTime: number;
  barIndex: number;
  confidence: number;
  annotatorId?: string;
};

export type FlyGtEightCount = {
  startTime: number;
  endTime: number;
  countIndex: number;
  phraseIndex: number;
  confidence: number;
  annotatorId?: string;
};

export type FlyGtEvent = {
  timestamp: number;
  type: FlyGtEventType;
  confidence: number;
  annotatorId?: string;
};

export type FlyGroundTruthSong = {
  songId: string;
  audioHash: string;
  durationSeconds: number;
  genre: string;
  tempoCategory: TempoCategory;
  datasetVersion: string;
  groundTruthVersion: string;
  conditions: ConditionTags;
  bpm: number | null;
  title?: string;
  sections: FlyGtSection[];
  beats: FlyGtBeat[];
  downbeats?: FlyGtDownbeat[] | null;
  eightCounts?: FlyGtEightCount[] | null;
  events?: FlyGtEvent[] | null;
  annotators?: string[];
};

/** Analyzer hypothesis for offline scoring (may wrap FlyAnalyzerResult fields) */
export type FlyBenchmarkHypothesis = {
  analyzerId: string;
  analyzerVersion: string;
  adapterVersion?: string;
  bpm?: number | null;
  beats?: number[] | null;
  downbeats?: number[] | null;
  onsets?: number[] | null;
  sections?: Array<{
    startTime: number;
    endTime: number;
    label: string;
  }> | null;
  eightCounts?: Array<{
    startTime: number;
    endTime: number;
    countIndex?: number;
    phraseIndex?: number;
  }> | null;
  events?: Array<{
    timestamp: number;
    type: string;
  }> | null;
};

export type MetricStatus = "OK" | "NOT_AVAILABLE" | "EMPTY";

export type TimingDetectionMetrics = {
  status: MetricStatus;
  thresholdsMs: number[];
  byThreshold: Record<
    string,
    {
      precision: number;
      recall: number;
      f1: number;
      meanTimingError: number | null;
      medianTimingError: number | null;
      matched: number;
      nRef: number;
      nHyp: number;
    }
  >;
  sampleCount: number;
  evidenceConfidence: EvidenceConfidence;
};

export type TempoMetrics = {
  status: MetricStatus;
  humanBpm: number | null;
  hypBpm: number | null;
  absoluteErrorBpm: number | null;
  relativeErrorPercent: number | null;
  equivalenceRatio: 0.5 | 1 | 2 | null;
  tempoClassError: boolean | null;
  sampleCount: number;
  evidenceConfidence: EvidenceConfidence;
};

export type SectionMetrics = {
  status: MetricStatus;
  labelPrecision: number | null;
  labelRecall: number | null;
  labelF1: number | null;
  meanBoundaryError: number | null;
  meanIoU: number | null;
  nRef: number;
  nHyp: number;
  sampleCount: number;
  evidenceConfidence: EvidenceConfidence;
};

export type EightCountMetrics = {
  status: MetricStatus;
  startTimingError: number | null;
  endTimingError: number | null;
  countBoundaryError: number | null;
  phraseAlignmentScore: number | null;
  offByOneCountRate: number | null;
  sampleCount: number;
  evidenceConfidence: EvidenceConfidence;
};

export type EventTypeMetrics = TimingDetectionMetrics & {
  eventType: string;
};

export type EventMetricsBundle = {
  status: MetricStatus;
  byType: EventTypeMetrics[];
  sampleCount: number;
  evidenceConfidence: EvidenceConfidence;
};

export type FlyBenchmarkSongResult = {
  benchmarkVersion: string;
  datasetVersion: string;
  groundTruthVersion: string;
  metricsVersion: string;
  audioHash: string;
  songId: string;
  analyzerId: string;
  analyzerVersion: string;
  conditions: ConditionTags;
  metrics: {
    tempo: TempoMetrics;
    beat: TimingDetectionMetrics;
    downbeat: TimingDetectionMetrics;
    onset: TimingDetectionMetrics;
    section: SectionMetrics;
    eightCount: EightCountMetrics;
    event: EventMetricsBundle;
  };
  /** Primary rollup for this song×analyzer (null if nothing scorable) */
  aggregateScore: number | null;
  confidence: EvidenceConfidence;
  provenance: {
    metric: string;
    sources: Array<{ analyzer: string; value: number | string | null }>;
  }[];
};

export type AnalyzerAgreementPair = {
  analyzerA: string;
  analyzerB: string;
  songId: string;
  tempoAgreement: number | null;
  beatAgreement: number | null;
  sectionAgreement: number | null;
  note: string;
};

export type AnalyzerReliabilityProfile = {
  analyzerId: string;
  analyzerVersion: string;
  signalType: string;
  condition: string;
  metric: string;
  score: number | null;
  sampleCount: number;
  evidenceConfidence: EvidenceConfidence;
  status: MetricStatus;
};

export type FlyBenchmarkRunOutput = {
  benchmarkVersion: string;
  datasetVersion: string;
  groundTruthVersion: string;
  metricsVersion: string;
  songResults: FlyBenchmarkSongResult[];
  agreement: AnalyzerAgreementPair[];
  profiles: AnalyzerReliabilityProfile[];
  reports: {
    json: string;
    markdown: string;
  };
};
