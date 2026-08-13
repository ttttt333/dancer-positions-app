import type { FailedAtLayer, LayerScores, RootCause } from "./RealWorldTypes";

export const ADVISOR_VERSION = "3.0.0-advisor";

export type RoadmapLevel =
  | "LEVEL_1_MUSIC_UNDERSTANDING"
  | "LEVEL_2_CUE_INTELLIGENCE"
  | "LEVEL_3_SPATIAL_INTELLIGENCE"
  | "LEVEL_4_PHYSICAL_INTELLIGENCE"
  | "LEVEL_5_CHOREOGRAPHIC_INTELLIGENCE";

export type ImpactLabel = "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
export type FixDifficulty = "LOW" | "MEDIUM" | "HIGH";
export type GateVerdict = "PASS" | "WATCH" | "FAIL";

export type QualityGateId =
  | "cueF1"
  | "majorCueRecall"
  | "sectionAccuracy"
  | "formationTop3"
  | "transitionCorrelation"
  | "sequenceCorrelation"
  | "unsafeRecommendation"
  | "humanCeilingRatio";

export type QualityGateRow = {
  id: QualityGateId;
  label: string;
  target: number;
  actual: number;
  unit: "ratio" | "score";
  higherIsBetter: boolean;
  verdict: GateVerdict;
};

export type LayerPriorityBreakdown = {
  layer: keyof LayerScores;
  failedAt: FailedAtLayer;
  level: RoadmapLevel;
  score: number;
  severity: number;
  frequency: number;
  downstreamImpact: number;
  fixability: number;
  impactLabel: ImpactLabel;
  fixDifficulty: FixDifficulty;
  priorityScore: number;
  rank: number;
  safetyForced: boolean;
};

export type RecommendedFix = {
  order: number;
  action: string;
  parameterHint: string;
  neverLoosenSafety: boolean;
};

export type ExpectedImpact = {
  overallPointsLow: number;
  overallPointsHigh: number;
  cueF1Delta: number;
  majorCueRecallDelta: number;
  sequenceCorrelationDelta: number;
  unsafeDelta: number;
  summary: string;
};

export type PriorityCard = {
  rank: number;
  layer: keyof LayerScores;
  failedAt: FailedAtLayer;
  level: RoadmapLevel;
  score: number;
  impactLabel: ImpactLabel;
  frequency: number;
  priorityScore: number;
  safetyForced: boolean;
  problems: string[];
  rootCauses: RootCause[];
  fixes: RecommendedFix[];
  expectedImpact: ExpectedImpact;
  note?: string;
};

export type DisagreementNote = {
  songId: string;
  cueId: string;
  choices: string[];
  interpretation: string;
};

export type QualityAdvisorReport = {
  advisorVersion: string;
  overall: number;
  grade: string;
  humanHumanAgreement: number;
  aiHumanAgreement: number;
  humanCeilingRatio: number;
  gates: QualityGateRow[];
  layerPriorities: LayerPriorityBreakdown[];
  cards: PriorityCard[];
  disagreements: DisagreementNote[];
  principle: string;
  safetyConstraintHeld: boolean;
};

export type AdvisorExtras = {
  meanBoundaryError?: number;
  dropRecall?: number;
  breakRecall?: number;
  overgenerationRate?: number;
};

export type AdvisorLayerWeights = {
  downstream: Record<keyof LayerScores, number>;
  fixability: Record<keyof LayerScores, number>;
};

export const DEFAULT_ADVISOR_WEIGHTS: AdvisorLayerWeights = {
  downstream: {
    phase1Audio: 0.7,
    phase2Structure: 1,
    phase3Cue: 0.85,
    phase4Formation: 0.5,
    phase5Movement: 0.45,
    phase6Sequence: 0.55,
  },
  fixability: {
    phase1Audio: 0.5,
    phase2Structure: 0.7,
    phase3Cue: 0.85,
    phase4Formation: 0.4,
    phase5Movement: 0.55,
    phase6Sequence: 0.55,
  },
};

export const QUALITY_GATE_TARGETS: Record<QualityGateId, number> = {
  cueF1: 0.8,
  majorCueRecall: 0.85,
  sectionAccuracy: 0.85,
  formationTop3: 0.8,
  transitionCorrelation: 0.75,
  sequenceCorrelation: 0.75,
  unsafeRecommendation: 0.02,
  humanCeilingRatio: 0.9,
};

export const ROADMAP_LEVEL_BY_LAYER: Record<keyof LayerScores, RoadmapLevel> = {
  phase1Audio: "LEVEL_1_MUSIC_UNDERSTANDING",
  phase2Structure: "LEVEL_1_MUSIC_UNDERSTANDING",
  phase3Cue: "LEVEL_2_CUE_INTELLIGENCE",
  phase4Formation: "LEVEL_3_SPATIAL_INTELLIGENCE",
  phase5Movement: "LEVEL_4_PHYSICAL_INTELLIGENCE",
  phase6Sequence: "LEVEL_5_CHOREOGRAPHIC_INTELLIGENCE",
};

export const FAILED_AT_BY_LAYER: Record<keyof LayerScores, FailedAtLayer> = {
  phase1Audio: "PHASE_1_AUDIO",
  phase2Structure: "PHASE_2_STRUCTURE",
  phase3Cue: "PHASE_3_CUE",
  phase4Formation: "PHASE_4_FORMATION",
  phase5Movement: "PHASE_5_MOVEMENT",
  phase6Sequence: "PHASE_6_SEQUENCE",
};
