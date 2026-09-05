import type { HumanEditSignal } from "./humanEvaluationTypes";
import type { CandidateOutcomeKind } from "./discrepancyTypes";
import type { ReleasePackage } from "./releaseTypes";
import type { ReleaseDecisionDataSource } from "./releaseDecisionTypes";

export type FormationCanaryArm = "V1" | "V2";

export type FormationCanaryHealthStatus =
  | "ACTIVE"
  | "HEALTHY"
  | "WARNING"
  | "REGRESSION"
  | "BLOCKED"
  | "ROLLBACK_READY"
  | "ROLLED_BACK";

export type FormationCanaryConfig = {
  configVersion: string;
  releasePackageId: string;
  assignmentMode: "DETERMINISTIC_PERCENT";
  canaryPercentage: number;
  stableArm: "V1";
  canaryArm: "V2";
  assignmentKey: "projectKey";
  enabled: boolean;
};

export type FormationCanaryActivation = {
  activationId: string;
  releasePackageId: string;
  domain: "FORMATION";
  activatedBy: string;
  activatedAt: string;
  canaryConfigVersion: string;
  dataSource: ReleaseDecisionDataSource;
  config: FormationCanaryConfig;
  releasePackage: ReleasePackage;
  rolledBack: boolean;
};

export type FormationCanaryContext = {
  projectKey: string;
  songKey: string;
  sessionKey: string;
  canaryActivationId?: string;
  releasePackageId?: string;
  productionFormationVersion: "V1";
  activeFormationVersion: FormationCanaryArm;
  musicVersion: string;
  cueVersion: string;
  intentVersion: string;
  transitionVersion: string;
  candidateSetId: string;
  candidateContextHash: string;
};

export type FormationCanaryObservation = {
  activationId: string;
  releasePackageId: string;
  projectKey: string;
  songKey: string;
  sessionKey: string;
  arm: FormationCanaryArm;
  candidateContextHash: string;
  productionVersion: "V1";
  activeVersion: FormationCanaryArm;
  candidateId: string;
  humanOutcome?: CandidateOutcomeKind | string;
  editSignal?: HumanEditSignal;
  observedAt: string;
  counterfactual: "unknown";
};

export type FormationCanarySafetyEvent = {
  eventId: string;
  activationId: string;
  kind:
    | "resolver_error"
    | "fallback_v1"
    | "invalid_result"
    | "generation_failure"
    | "apply_failure"
    | "version_mismatch"
    | "package_invalid";
  projectKey: string;
  reason: string;
  recordedAt: string;
};

export type FormationCanaryResolution = {
  arm: FormationCanaryArm;
  projectKey: string;
  releasePackageId?: string;
  activationId?: string;
  formationVersion: FormationCanaryArm;
  transitionVersion: "V1";
  musicVersion: "V1";
  cueVersion: "V1";
  intentVersion: "V1";
  formationWeights: Record<string, number>;
  formationWeightsVersion: string;
  fallback: boolean;
  canaryOff: boolean;
  error?: string;
  context: FormationCanaryContext;
};

export type FormationCanaryMetrics = {
  candidateCount: number;
  acceptCount: number;
  rejectCount: number;
  editCount: number;
  unchangedCount: number;
  acceptRate: number | null;
  rejectRate: number | null;
  editRate: number | null;
  unchangedRate: number | null;
  formationEditRate: number | null;
  positionEditRate: number | null;
  assignmentEditRate: number | null;
  swapRate: number | null;
  top1Changed: number;
  top3Changed: number;
  scoreDelta: number | null;
  rankDelta: number | null;
};

export type FormationCanarySafetyMetrics = {
  invalidResultCount: number;
  fallbackToV1Count: number;
  resolverErrorCount: number;
  candidateGenerationFailureCount: number;
  applyFailureCount: number;
};

export type CanaryHealthDimensions = {
  functionalSafety: "PASS" | "BLOCKED";
  humanOutcome: "PASS" | "BLOCKED" | "UNKNOWN";
  editBehavior: "PASS" | "BLOCKED" | "UNKNOWN";
  fallbackErrorRate: "PASS" | "WARNING" | "REGRESSION";
  versionIntegrity: "PASS" | "BLOCKED";
};

export type CanaryHealthReport = {
  analysisVersion: string;
  status: FormationCanaryHealthStatus;
  dimensions: CanaryHealthDimensions;
  metrics: FormationCanaryMetrics;
  safety: FormationCanarySafetyMetrics;
  blockers: string[];
  warnings: string[];
  notes: string[];
};
