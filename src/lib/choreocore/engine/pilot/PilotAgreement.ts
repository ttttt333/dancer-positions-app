import type { AnnotationSession } from "../types/AnnotationTypes";
import type { DomainAgreement } from "../types/PilotTypes";
import { CALIBRATION_AGREEMENT_GATE } from "../types/PilotTypes";
import { calculateInterRaterAgreement } from "../annotation/ConsensusEngine";
import { clusterSections, sectionBoundaryMae } from "../annotation/SectionConsensus";
import { clamp, mean } from "../evaluation/EvaluationMetrics";
import { beatPeriodSec } from "../evaluation/EvaluationConfig";

export function classifyCeilingRatio(ratio: number): import("../types/PilotTypes").CeilingClass {
  if (ratio >= 0.9) return "HUMAN_LIKE";
  if (ratio >= 0.8) return "PROMISING";
  if (ratio >= 0.7) return "NEEDS_TUNING";
  return "MAJOR_TUNING_REQUIRED";
}

export function classifySafety(unsafeRate: number, cappedFail = false): import("../types/PilotTypes").SafetyClass {
  if (cappedFail || unsafeRate > 0.05) return "FAIL";
  if (unsafeRate > 0.02) return "WATCH";
  return "PASS";
}

export function sectionAgreement(sessions: AnnotationSession[]): number {
  if (sessions.length < 2) return 0;
  const clusters = clusterSections(sessions);
  const typeScore =
    clusters.length === 0
      ? 1
      : mean(
          clusters.map((c) => {
            const types = new Set(c.sections.map((s) => s.type));
            return types.size <= 1 ? 1 : 1 / types.size;
          })
        );
  const beat = beatPeriodSec(sessions[0]?.bpm || 120);
  const boundary = clamp(1 - sectionBoundaryMae(sessions) / Math.max(2 * beat, 1e-6), 0, 1);
  return mean([typeScore, boundary]);
}

export function domainAgreement(sessions: AnnotationSession[]): DomainAgreement {
  const agr = calculateInterRaterAgreement(sessions);
  const cue = mean([agr.cue.timeAgreement, agr.cue.actionAgreement]);
  const formation = clamp(agr.formationTop3Overlap / 3, 0, 1);
  return {
    cue,
    section: sectionAgreement(sessions),
    formation,
    sequence: agr.sequenceSpearman,
  };
}

export function meanDomainAgreement(sessions: AnnotationSession[]): DomainAgreement {
  const songs = [...new Set(sessions.map((s) => s.songId))].sort();
  if (songs.length === 0) return { cue: 0, section: 0, formation: 0, sequence: 0 };
  const rows = songs.map((songId) => domainAgreement(sessions.filter((s) => s.songId === songId)));
  return {
    cue: mean(rows.map((r) => r.cue)),
    section: mean(rows.map((r) => r.section)),
    formation: mean(rows.map((r) => r.formation)),
    sequence: mean(rows.map((r) => r.sequence)),
  };
}

export function overallFromDomain(domain: DomainAgreement): number {
  return mean([domain.cue, domain.section, domain.formation, domain.sequence]);
}

export function calibrationPassed(overall: number): boolean {
  return overall >= CALIBRATION_AGREEMENT_GATE;
}
