/**
 * Production Instrumentation Audit — 診断だけ。学習・Release・Canary はしない。
 */

import { isMusicEnginePhase12Enabled } from "../audio/musicEngineFlag";
import { FORMATION_WEIGHTS_VERSION } from "./humanEvaluationConfig";
import { HUMAN_FEEDBACK_CAPTURE_ENABLED, HUMAN_FEEDBACK_VERSION } from "./humanFeedbackConfig";
import { RELEASE_CANARY_ENABLED } from "./releaseConfig";
import { getProductionCanaryActivation } from "./formationCanary";
import { evaluateProductionReleaseReadiness } from "./releaseDecision";
import { canReleaseFormationV2 } from "./realWorldEvidence";

export type ProductionInstrumentationAudit = {
  captureEnabled: boolean;
  musicEngineFlag: boolean;
  feedbackIndependentOfMusicFlag: true;
  canaryOff: true;
  releaseCanaryEnabled: false;
  productionFormationDefault: "V1";
  realSampleCount: number;
  realEvidenceStatus: string;
  findings: string[];
};

export function auditProductionInstrumentation(): ProductionInstrumentationAudit {
  const real = evaluateProductionReleaseReadiness({ domain: "formation" });
  const findings: string[] = [];
  if (!HUMAN_FEEDBACK_CAPTURE_ENABLED) {
    findings.push("HUMAN_FEEDBACK_CAPTURE_DISABLED");
  }
  if (RELEASE_CANARY_ENABLED) findings.push("CANARY_FLAG_ON");
  if (getProductionCanaryActivation()) findings.push("PRODUCTION_CANARY_ACTIVE");
  if (real.review.sampleCount === 0) findings.push("REAL_SAMPLE_COUNT_ZERO");
  findings.push("MUSIC_ID_USES_PIECE_TITLE");
  findings.push(`WEIGHTS_DEFAULT=${FORMATION_WEIGHTS_VERSION}`);
  findings.push(`FEEDBACK_VERSION=${HUMAN_FEEDBACK_VERSION}`);
  return {
    captureEnabled: HUMAN_FEEDBACK_CAPTURE_ENABLED,
    musicEngineFlag: isMusicEnginePhase12Enabled(),
    feedbackIndependentOfMusicFlag: true,
    canaryOff: true,
    releaseCanaryEnabled: false,
    productionFormationDefault: "V1",
    realSampleCount: real.review.sampleCount,
    realEvidenceStatus: real.status,
    findings: [...new Set(findings)].sort((a, b) => a.localeCompare(b)),
  };
}

export function confirmNoAutomaticRelease(): {
  canReleaseFormationV2: false;
  canaryActivated: false;
} {
  return {
    canReleaseFormationV2: canReleaseFormationV2(),
    canaryActivated: false,
  };
}
