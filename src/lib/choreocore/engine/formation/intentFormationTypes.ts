import type { ChoreographicIntent, ChoreographicIntentType } from "../intent/ChoreographicIntentTypes";
import type { FormationCue, StageConfig } from "../types/CueTypes";
import type { Formation, FormationType, Point } from "../types/FormationTypes";
import type { FormationFamily } from "../types/ScoringTypes";

export type FormationCandidateHumanRating = "good" | "acceptable" | "wrong";

export type FormationIntelligenceConstraints = {
  lockedDancerIds?: string[];
  availableSeconds?: number;
  bpm?: number;
};

export type FormationIntelligenceRequest = {
  intent: ChoreographicIntent;
  cue: FormationCue;
  currentFormation: Formation;
  dancerCount: number;
  stage: StageConfig;
  previousIntent?: ChoreographicIntentType | null;
  nextIntent?: ChoreographicIntentType | null;
  constraints?: FormationIntelligenceConstraints;
  /** Canary V2 のときだけ。未指定なら Production V1 定数 */
  scoreWeights?: Record<string, number>;
};

export type FormationFeasibilityBreakdown = {
  valid: boolean;
  collisionRisk: number;
  maxRequiredSpeed: number;
  outsideStage: boolean;
  lockedViolation: boolean;
  rejectionReasons: string[];
};

export type RankedFormationCandidate = {
  formation: Formation;
  candidateId: string;
  templateId: string;
  shapeFamily: FormationFamily;
  score: number;
  intentAlignment: number;
  visualImpact: number;
  transitionQuality: number;
  movementEfficiency: number;
  movementCost: number;
  visualImpactPerMovement: number;
  stageUsage: number;
  roleCompatibility: number;
  complexityPenalty: number;
  collisionPenalty: number;
  reasonCodes: string[];
  feasibility: FormationFeasibilityBreakdown;
  humanRating?: FormationCandidateHumanRating;
};

export type FormationRecommendation = {
  intent: ChoreographicIntent;
  primary: RankedFormationCandidate | null;
  alternatives: RankedFormationCandidate[];
  ranked: RankedFormationCandidate[];
  discardedCount: number;
};

export type FormationIntelligenceMetrics = {
  intentAlignmentMean: number;
  visualImpactMean: number;
  movementEfficiencyMean: number;
  feasibilityRate: number;
  candidateDiversity: number;
};

export type FormationIntelligenceReport = {
  analysisVersion: string;
  recommendations: FormationRecommendation[];
  metrics: FormationIntelligenceMetrics;
};

export type FormationShapeMetrics = {
  type: FormationType;
  family: FormationFamily;
  stageCoverage: number;
  compactness: number;
  symmetry: number;
  complexity: number;
  centerShift: number;
  centerStrength: number;
  edgeUtilization: number;
  groupSeparation: number;
  centroid: Point;
};

/** 隊形の見た目エネルギー。座標は持たない。コールバック用の familyId を後で使う。未配線。 */
export type FormationProfile = {
  familyId: string;
  metrics: FormationShapeMetrics;
  density: number;
  visualEnergy: number;
  scale: number;
  freezeSuitable: boolean;
  reasonCodes: string[];
};
