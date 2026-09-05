/**
 * Stage 16: Formation V2 を明示起動した Canary だけに限定適用する。
 * 自動昇格・自動割合増加・学習はしない。失敗は V1。
 */

import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { assignCanaryArm } from "./releaseCanary";
import { rollbackRelease, startCanary, resolveReleaseWeights } from "./releaseGate";
import { canProceedToCanary, evaluateProductionReleaseReadiness } from "./releaseDecision";
import type { ReleasePackage } from "./releaseTypes";
import type { ReleaseDecisionDataSource } from "./releaseDecisionTypes";
import {
  FORMATION_CANARY_ASSIGNMENT_KEY,
  FORMATION_CANARY_ASSIGNMENT_MODE,
  FORMATION_CANARY_DEFAULT_PERCENT,
  FORMATION_CANARY_VERSION,
} from "./formationCanaryConfig";
import { buildCanaryContext } from "./formationCanaryContext";
import type {
  FormationCanaryActivation,
  FormationCanaryArm,
  FormationCanaryConfig,
  FormationCanaryObservation,
  FormationCanaryResolution,
  FormationCanarySafetyEvent,
} from "./formationCanaryTypes";
import { FORMATION_WEIGHTS_V1 } from "./weightApprovalConfig";
import { stableFormationWeights } from "./weightRegistry";

const v1Weights = (): Record<string, number> => ({ ...FORMATION_INTELLIGENCE_WEIGHTS });

let productionActivation: FormationCanaryActivation | null = null;
const observations: FormationCanaryObservation[] = [];
const safetyEvents: FormationCanarySafetyEvent[] = [];

export function resetFormationCanaryForTests(): void {
  productionActivation = null;
  observations.splice(0, observations.length);
  safetyEvents.splice(0, safetyEvents.length);
}

export function getProductionCanaryActivation(): FormationCanaryActivation | null {
  if (!productionActivation) return null;
  if (productionActivation.dataSource !== "REAL") return null;
  if (!productionActivation.config.enabled || productionActivation.rolledBack) return null;
  return productionActivation;
}

export function listCanaryObservations(): FormationCanaryObservation[] {
  return [...observations].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt) || a.candidateId.localeCompare(b.candidateId)
  );
}

export function listCanarySafetyEvents(): FormationCanarySafetyEvent[] {
  return [...safetyEvents].sort((a, b) => a.eventId.localeCompare(b.eventId));
}

function anonymousReviewerId(reviewerId: string): string {
  return reviewerId.startsWith("anon-") ? reviewerId : `anon-${reviewerId.slice(0, 8)}`;
}

function formationWeightsUsable(weights: Record<string, number>): boolean {
  const keys = Object.keys(FORMATION_INTELLIGENCE_WEIGHTS) as Array<keyof typeof FORMATION_INTELLIGENCE_WEIGHTS>;
  return keys.every((key) => Number.isFinite(weights[key]));
}

function recordSafety(event: FormationCanarySafetyEvent): void {
  safetyEvents.push(event);
}

export function appendCanaryObservation(row: FormationCanaryObservation): void {
  observations.push({ ...row, counterfactual: "unknown" });
}

export function activateFormationCanary(input: {
  releasePackage: ReleasePackage;
  reviewerId: string;
  activatedAt: string;
  dataSource: ReleaseDecisionDataSource;
  canaryPercentage?: number;
}): { accepted: boolean; reason: string; activation?: FormationCanaryActivation } {
  const reviewerId = anonymousReviewerId(input.reviewerId);
  if (input.releasePackage.layer !== "formation") {
    return { accepted: false, reason: "FORMATION_ONLY" };
  }
  if (input.releasePackage.status !== "APPROVED_FOR_CANARY") {
    return { accepted: false, reason: "NOT_APPROVED_FOR_CANARY" };
  }
  if (input.dataSource === "REAL") {
    const decision = evaluateProductionReleaseReadiness({ domain: "formation" });
    if (!canProceedToCanary(decision)) {
      return { accepted: false, reason: "REAL_EVIDENCE_NOT_ELIGIBLE" };
    }
  }
  const started = startCanary(input.releasePackage);
  if (started.status !== "CANARY") {
    return { accepted: false, reason: "START_CANARY_REJECTED" };
  }
  const percent = input.canaryPercentage ?? FORMATION_CANARY_DEFAULT_PERCENT;
  const config: FormationCanaryConfig = {
    configVersion: FORMATION_CANARY_VERSION,
    releasePackageId: started.packageId,
    assignmentMode: FORMATION_CANARY_ASSIGNMENT_MODE,
    canaryPercentage: percent,
    stableArm: "V1",
    canaryArm: "V2",
    assignmentKey: FORMATION_CANARY_ASSIGNMENT_KEY,
    enabled: true,
  };
  const activation: FormationCanaryActivation = {
    activationId: `fca-${started.packageId}-${reviewerId}-${input.activatedAt}`,
    releasePackageId: started.packageId,
    domain: "FORMATION",
    activatedBy: reviewerId,
    activatedAt: input.activatedAt,
    canaryConfigVersion: FORMATION_CANARY_VERSION,
    dataSource: input.dataSource,
    config,
    releasePackage: { ...started, applied: false, autoReleased: false },
    rolledBack: false,
  };
  if (input.dataSource === "REAL") {
    productionActivation = activation;
  }
  return { accepted: true, reason: "ACTIVATED", activation };
}

export function resolveFormationArm(input: {
  projectKey: string;
  releasePackageId: string;
  canaryConfig: FormationCanaryConfig;
}): FormationCanaryArm {
  const assigned = assignCanaryArm({
    packageId: input.releasePackageId,
    projectKey: input.projectKey,
    enabled: input.canaryConfig.enabled,
    percent: input.canaryConfig.canaryPercentage,
  });
  return assigned.arm === "v2" ? "V2" : "V1";
}

function v1Resolution(input: {
  projectKey: string;
  canaryOff: boolean;
  fallback: boolean;
  error?: string;
  activation?: FormationCanaryActivation;
  safetyAt?: string;
}): FormationCanaryResolution {
  const context = buildCanaryContext({
    projectKey: input.projectKey,
    activationId: input.activation?.activationId,
    releasePackageId: input.activation?.releasePackageId,
    activeFormationVersion: "V1",
  });
  if (input.fallback && input.activation && input.safetyAt) {
    recordSafety({
      eventId: `cse-${input.activation.activationId}-${input.error ?? "fallback"}-${input.projectKey}`,
      activationId: input.activation.activationId,
      kind:
        input.error === "version-mismatch"
          ? "version_mismatch"
          : input.error === "unknown-package" || input.error === "package-invalid"
            ? "package_invalid"
            : input.error === "resolver-error"
              ? "resolver_error"
              : "fallback_v1",
      projectKey: input.projectKey,
      reason: input.error ?? "fallback",
      recordedAt: input.safetyAt,
    });
  }
  return {
    arm: "V1",
    projectKey: input.projectKey,
    releasePackageId: input.activation?.releasePackageId,
    activationId: input.activation?.activationId,
    formationVersion: "V1",
    transitionVersion: "V1",
    musicVersion: "V1",
    cueVersion: "V1",
    intentVersion: "V1",
    formationWeights: v1Weights(),
    formationWeightsVersion: FORMATION_WEIGHTS_V1,
    fallback: input.fallback,
    canaryOff: input.canaryOff,
    error: input.error,
    context,
  };
}

export function resolveFormationCanaryWeights(input: {
  projectKey: string;
  activation?: FormationCanaryActivation | null;
  songKey?: string;
  sessionKey?: string;
  dancerIds?: string[];
  candidateIds?: string[];
  cueIds?: string[];
  safetyAt?: string;
  forceResolverError?: boolean;
}): FormationCanaryResolution {
  const activation = input.activation === undefined ? getProductionCanaryActivation() : input.activation;
  if (!activation || !activation.config.enabled || activation.rolledBack) {
    return v1Resolution({ projectKey: input.projectKey, canaryOff: true, fallback: false });
  }
  if (activation.domain !== "FORMATION" || activation.releasePackage.layer !== "formation") {
    return v1Resolution({
      projectKey: input.projectKey,
      canaryOff: false,
      fallback: true,
      error: "package-invalid",
      activation,
      safetyAt: input.safetyAt ?? activation.activatedAt,
    });
  }
  if (input.forceResolverError) {
    return v1Resolution({
      projectKey: input.projectKey,
      canaryOff: false,
      fallback: true,
      error: "resolver-error",
      activation,
      safetyAt: input.safetyAt ?? activation.activatedAt,
    });
  }
  try {
    const arm = resolveFormationArm({
      projectKey: input.projectKey,
      releasePackageId: activation.releasePackageId,
      canaryConfig: activation.config,
    });
    if (arm === "V1") {
      const context = buildCanaryContext({
        projectKey: input.projectKey,
        songKey: input.songKey,
        sessionKey: input.sessionKey,
        activationId: activation.activationId,
        releasePackageId: activation.releasePackageId,
        activeFormationVersion: "V1",
        dancerIds: input.dancerIds,
        candidateIds: input.candidateIds,
        cueIds: input.cueIds,
      });
      return {
        arm: "V1",
        projectKey: input.projectKey,
        releasePackageId: activation.releasePackageId,
        activationId: activation.activationId,
        formationVersion: "V1",
        transitionVersion: "V1",
        musicVersion: "V1",
        cueVersion: "V1",
        intentVersion: "V1",
        formationWeights: v1Weights(),
        formationWeightsVersion: FORMATION_WEIGHTS_V1,
        fallback: false,
        canaryOff: false,
        context,
      };
    }
    const resolved = resolveReleaseWeights({
      layer: "formation",
      release: activation.releasePackage,
      canaryArm: "v2",
    });
    if (resolved.fallback || !formationWeightsUsable(resolved.weights)) {
      return v1Resolution({
        projectKey: input.projectKey,
        canaryOff: false,
        fallback: true,
        error: resolved.error ?? "invalid-weights",
        activation,
        safetyAt: input.safetyAt ?? activation.activatedAt,
      });
    }
    const context = buildCanaryContext({
      projectKey: input.projectKey,
      songKey: input.songKey,
      sessionKey: input.sessionKey,
      activationId: activation.activationId,
      releasePackageId: activation.releasePackageId,
      activeFormationVersion: "V2",
      dancerIds: input.dancerIds,
      candidateIds: input.candidateIds,
      cueIds: input.cueIds,
    });
    return {
      arm: "V2",
      projectKey: input.projectKey,
      releasePackageId: activation.releasePackageId,
      activationId: activation.activationId,
      formationVersion: "V2",
      transitionVersion: "V1",
      musicVersion: "V1",
      cueVersion: "V1",
      intentVersion: "V1",
      formationWeights: { ...resolved.weights },
      formationWeightsVersion: resolved.version,
      fallback: false,
      canaryOff: false,
      context,
    };
  } catch {
    return v1Resolution({
      projectKey: input.projectKey,
      canaryOff: false,
      fallback: true,
      error: "resolver-error",
      activation,
      safetyAt: input.safetyAt ?? activation.activatedAt,
    });
  }
}

export function scoreWeightsForSuggest(resolution: FormationCanaryResolution): Record<string, number> | undefined {
  if (resolution.canaryOff || resolution.fallback || resolution.arm !== "V2") return undefined;
  return resolution.formationWeights;
}

export function rollbackFormationCanary(activation: FormationCanaryActivation): {
  activation: FormationCanaryActivation;
  package: ReleasePackage;
  observations: FormationCanaryObservation[];
} {
  const rolled = rollbackRelease(activation.releasePackage);
  const next: FormationCanaryActivation = {
    ...activation,
    rolledBack: true,
    config: { ...activation.config, enabled: false },
    releasePackage: { ...rolled, applied: false, autoReleased: false },
  };
  if (productionActivation?.activationId === activation.activationId) {
    productionActivation = null;
  }
  return {
    activation: next,
    package: next.releasePackage,
    observations: listCanaryObservations().filter((row) => row.activationId === activation.activationId),
  };
}

export function incrementCanarySafety(input: {
  activation: FormationCanaryActivation;
  kind: FormationCanarySafetyEvent["kind"];
  projectKey: string;
  reason: string;
  recordedAt: string;
}): void {
  recordSafety({
    eventId: `cse-${input.activation.activationId}-${input.kind}-${input.projectKey}-${input.reason}`,
    activationId: input.activation.activationId,
    kind: input.kind,
    projectKey: input.projectKey,
    reason: input.reason,
    recordedAt: input.recordedAt,
  });
}

export function productionFormationWeightsUnchanged(): Record<string, number> {
  return stableFormationWeights();
}
