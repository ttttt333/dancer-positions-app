import type {
  CalibrationConfidence,
  HumanEditSignal,
  RankAgreement,
  WeightProposal,
  WeightSimulation,
} from "./humanEvaluationTypes";

export type CandidateOutcomeKind =
  | "ACCEPT_UNCHANGED"
  | "ACCEPT_EDIT"
  | "REJECT";

export type CoreDiscrepancyPattern =
  | "HIGH_SCORE_REJECT"
  | "LOW_SCORE_ACCEPT"
  | "ACCEPT_EDIT"
  | "ACCEPT_UNCHANGED";

export type DiscrepancyCategory =
  | "MUSIC_TIMING"
  | "INTENT_MISMATCH"
  | "FORMATION_SELECTION"
  | "FORMATION_GEOMETRY"
  | "ASSIGNMENT"
  | "TRANSITION_PATH"
  | "TRANSITION_TIMING"
  | "GENERAL_PREFERENCE"
  | "UNKNOWN";

export type LikelyLayer =
  | "music_cue"
  | "intent"
  | "formation"
  | "transition"
  | "unknown";

export type DiscrepancyConfidence = "insufficient" | "low" | "medium" | "high";

export type CandidateOutcome = {
  candidateId: string;
  cueId?: string;
  musicId?: string;
  intent?: string;
  formationType?: string;
  pathKind?: string;
  dancerCount?: number;
  outcome: CandidateOutcomeKind;
  patterns: CoreDiscrepancyPattern[];
  categories: DiscrepancyCategory[];
  likelyLayers: LikelyLayer[];
  editSignal: HumanEditSignal;
  aiScore: number;
  weightsVersion: string;
};

export type RateStat = {
  count: number;
  total: number;
  rate: number | null;
  sampleSize: number;
  confidence: DiscrepancyConfidence;
};

export type ScoreBucketStat = {
  bucket: string;
  sampleSize: number;
  rejectRate: number | null;
  acceptUnchangedRate: number | null;
  acceptEditRate: number | null;
  confidence: DiscrepancyConfidence;
};

export type SegmentStat = {
  key: string;
  sampleSize: number;
  acceptUnchangedRate: number | null;
  acceptEditRate: number | null;
  rejectRate: number | null;
  confidence: DiscrepancyConfidence;
};

export type EditRateBreakdown = {
  formation: RateStat;
  position: RateStat;
  assignment: RateStat;
  path: RateStat;
  timing: RateStat;
};

export type PairwiseMismatch = {
  pairwiseId: string;
  candidateAId: string;
  candidateBId: string;
  human: "A" | "B" | "EQUAL";
  ai: "A" | "B" | "EQUAL";
};

export type DiscrepancyFinding = {
  category: DiscrepancyCategory;
  likelyLayer: LikelyLayer;
  sampleSize: number;
  rate: number | null;
  confidence: DiscrepancyConfidence;
  observed: string[];
  hypothesis: string[];
};

export type LayerShare = {
  layer: LikelyLayer;
  count: number;
  rate: number | null;
};

export type DiscrepancyReport = {
  analysisVersion: string;
  datasetVersion: string;
  algorithmVersion: string;
  weightsVersion: string;
  sampleSize: number;
  candidateCount: number;
  pairwiseCount: number;
  confidence: DiscrepancyConfidence;
  calibrationConfidence: CalibrationConfidence;
  autoApplied: false;
  overall: {
    acceptUnchanged: RateStat;
    acceptEdit: RateStat;
    reject: RateStat;
  };
  patterns: {
    highScoreReject: RateStat;
    lowScoreAccept: RateStat;
    acceptEdit: RateStat;
    acceptUnchanged: RateStat;
  };
  editRates: EditRateBreakdown;
  scoreBuckets: ScoreBucketStat[];
  byIntent: SegmentStat[];
  byFormation: SegmentStat[];
  byTransition: SegmentStat[];
  byDancerCount: SegmentStat[];
  layerAttribution: LayerShare[];
  findings: DiscrepancyFinding[];
  positiveEvidence: {
    highScoreAcceptUnchanged: RateStat;
    observed: string[];
  };
  rankAgreement: RankAgreement | null;
  pairwiseDisagreementRate: number | null;
  pairwiseMismatches: PairwiseMismatch[];
  weightProposals: {
    formation: WeightProposal;
    transition: WeightProposal;
    simulation: WeightSimulation | null;
  };
  notes: string[];
};
