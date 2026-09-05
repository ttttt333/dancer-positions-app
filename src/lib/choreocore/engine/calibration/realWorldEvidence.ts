/**
 * Stage 14: 実データの観測だけ。学習・Apply・Canary・Release はしない。
 */

import {
  candidateGroupKey,
  resolveCandidateOutcome,
} from "./discrepancyClassify";
import type { CandidateOutcomeKind } from "./discrepancyTypes";
import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import type { HumanEvaluationRecord, HumanEvaluationStore } from "./humanEvaluationTypes";
import { EVIDENCE_QUALITY_HEURISTICS, REAL_WORLD_EVIDENCE_VERSION } from "./realWorldEvidenceConfig";
import type {
  CueEvidence,
  EvidenceQuality,
  EvidenceQualityWarning,
  EvidenceReadiness,
  FormationEvidence,
  LayerEvidenceCounts,
  ReadinessAssessment,
  RealWorldEvidenceReport,
  ShadowEvidenceRow,
  ShadowEvidenceSummary,
  TransitionEvidence,
} from "./realWorldEvidenceTypes";
import type { ShadowReport } from "./shadowTypes";

export type RealWorldEvidenceInput = {
  store: HumanEvaluationStore;
  shadow?: ShadowReport;
  expected?: {
    datasetVersion?: string;
    algorithmVersion?: string;
    analysisVersion?: string;
    weightsVersion?: string;
  };
};

type CandidateRow = {
  candidateId: string;
  kind: "formation" | "transition";
  outcome: CandidateOutcomeKind;
  song: string;
  user: string;
  session: string;
  project: string;
  formationChanged: boolean;
  positionChanged: boolean;
  assignmentChanged: boolean;
  pathChanged: boolean;
  timingChanged: boolean;
  impossible: boolean;
};

function rate(count: number, total: number): number | null {
  return total === 0 ? null : count / total;
}

function identityOf(record: HumanEvaluationRecord): {
  song: string;
  user: string;
  session: string;
  project: string;
} {
  const song = record.subject.musicId ?? "unknown-song";
  const user = record.evaluatorContext?.evaluatorId ?? "unknown-user";
  const session = `${user}|${record.subject.cueId ?? "unknown-cue"}`;
  const project = `${song}|${user}`;
  return { song, user, session, project };
}

function groupCandidates(store: HumanEvaluationStore): CandidateRow[] {
  const groups = new Map<string, HumanEvaluationRecord[]>();
  for (const record of [...store.records].sort((a, b) =>
    a.evaluationId.localeCompare(b.evaluationId)
  )) {
    const key = `${record.subject.kind}|${candidateGroupKey(record)}`;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const rows: CandidateRow[] = [];
  for (const key of [...groups.keys()].sort((a, b) => a.localeCompare(b))) {
    const list = groups.get(key)!;
    const outcome = resolveCandidateOutcome(list);
    if (!outcome) continue;
    const first = [...list].sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.evaluationId.localeCompare(b.evaluationId)
    )[0]!;
    const ids = identityOf(first);
    const signal = list.reduce(
      (acc, row) => ({
        formationChanged: acc.formationChanged || Boolean(row.editSignal?.formationChanged),
        positionChanged: acc.positionChanged || Boolean(row.editSignal?.positionChanged),
        assignmentChanged: acc.assignmentChanged || Boolean(row.editSignal?.assignmentChanged),
        pathChanged: acc.pathChanged || Boolean(row.editSignal?.pathChanged),
        timingChanged: acc.timingChanged || Boolean(row.editSignal?.timingChanged),
      }),
      {
        formationChanged: false,
        positionChanged: false,
        assignmentChanged: false,
        pathChanged: false,
        timingChanged: false,
      }
    );
    rows.push({
      candidateId: first.subject.candidateId,
      kind: first.subject.kind,
      outcome,
      ...ids,
      ...signal,
      impossible: list.some((r) => r.humanJudgment === "impossible"),
    });
  }
  return rows;
}

function layerCounts(rows: CandidateRow[]): LayerEvidenceCounts {
  const n = rows.length;
  const acceptUnchanged = rows.filter((r) => r.outcome === "ACCEPT_UNCHANGED").length;
  const acceptEdit = rows.filter((r) => r.outcome === "ACCEPT_EDIT").length;
  const rejected = rows.filter((r) => r.outcome === "REJECT").length;
  const accepted = acceptUnchanged + acceptEdit;
  return {
    candidateCount: n,
    acceptCount: accepted,
    rejectCount: rejected,
    acceptEditCount: acceptEdit,
    acceptUnchangedCount: acceptUnchanged,
    acceptRate: rate(accepted, n),
    rejectRate: rate(rejected, n),
    editRate: rate(acceptEdit, n),
    unchangedRate: rate(acceptUnchanged, n),
  };
}

function formationEvidence(rows: CandidateRow[]): FormationEvidence {
  const scoped = rows.filter((r) => r.kind === "formation");
  return {
    ...layerCounts(scoped),
    formationEditCount: scoped.filter((r) => r.formationChanged).length,
    positionEditCount: scoped.filter((r) => r.positionChanged).length,
    assignmentEditCount: scoped.filter((r) => r.assignmentChanged).length,
    swapCount: scoped.filter((r) => r.assignmentChanged).length,
  };
}

function transitionEvidence(rows: CandidateRow[]): TransitionEvidence {
  const scoped = rows.filter((r) => r.kind === "transition");
  return {
    ...layerCounts(scoped),
    pathEditCount: scoped.filter((r) => r.pathChanged).length,
    timingEditCount: scoped.filter((r) => r.timingChanged).length,
    assignmentEditCount: scoped.filter((r) => r.assignmentChanged).length,
    impossibleCount: scoped.filter((r) => r.impossible).length,
  };
}

function cueEvidence(store: HumanEvaluationStore): CueEvidence {
  const withCue = store.records.filter((r) => r.subject.cueId);
  return {
    cueAcceptCount: withCue.filter((r) => r.decision === "accept").length,
    cueRejectCount: withCue.filter((r) => r.decision === "reject").length,
    timingEditCount: withCue.filter((r) => r.editSignal?.timingChanged).length,
    cueRelatedEditCount: withCue.filter(
      (r) => r.decision === "edit" || r.editSignal?.timingChanged
    ).length,
  };
}

function qualityFrom(rows: CandidateRow[]): EvidenceQuality {
  const projects = new Set(rows.map((r) => r.project));
  const sessions = new Set(rows.map((r) => r.session));
  const users = new Set(rows.map((r) => r.user));
  const songs = new Set(rows.map((r) => r.song));
  const actions = new Set<string>();
  for (const row of rows) {
    actions.add(row.outcome);
    if (row.formationChanged) actions.add("FORMATION_EDIT");
    if (row.positionChanged) actions.add("POSITION_EDIT");
    if (row.assignmentChanged) actions.add("ASSIGNMENT_EDIT");
    if (row.pathChanged) actions.add("PATH_EDIT");
    if (row.timingChanged) actions.add("TIMING_EDIT");
  }
  return {
    sampleCount: rows.length,
    uniqueProjectCount: projects.size,
    uniqueSessionCount: sessions.size,
    uniqueUserCount: users.size,
    uniqueSongCount: songs.size,
    actionDiversity: actions.size,
    dimensions: {
      SAMPLE_COUNT: rows.length,
      PROJECT_DIVERSITY: projects.size,
      SESSION_DIVERSITY: sessions.size,
      USER_DIVERSITY: users.size,
      SONG_DIVERSITY: songs.size,
      ACTION_DIVERSITY: actions.size,
    },
  };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function shadowSummary(shadow: ShadowReport | undefined): ShadowEvidenceSummary {
  if (!shadow) {
    return {
      evaluatedCount: 0,
      availableCount: 0,
      unavailableCount: 0,
      top1ChangedCount: 0,
      top3ChangedCount: 0,
      meanScoreDelta: null,
      meanRankDelta: null,
      humanOutcomeIsProduction: true,
      counterfactual: "unknown",
    };
  }
  const available = shadow.evaluations.filter((e) => !e.shadow.unavailable);
  return {
    packageId: undefined,
    domain: shadow.layer,
    productionVersion: shadow.productionWeightsVersion,
    shadowVersion: shadow.shadowWeightsVersion,
    evaluatedCount: shadow.evaluations.length,
    availableCount: available.length,
    unavailableCount: shadow.evaluations.length - available.length,
    top1ChangedCount: shadow.comparisons.filter((c) => c.top1Changed).length,
    top3ChangedCount: shadow.comparisons.filter((c) => {
      const a = [...c.v1Ranking.slice(0, 3)].sort((x, y) => x.localeCompare(y)).join("|");
      const b = [...c.v2Ranking.slice(0, 3)].sort((x, y) => x.localeCompare(y)).join("|");
      return a !== b;
    }).length,
    meanScoreDelta: mean(
      shadow.evaluations
        .map((e) => e.scoreDelta)
        .filter((v): v is number => v != null)
    ),
    meanRankDelta: mean(
      shadow.evaluations
        .map((e) => e.rankDelta)
        .filter((v): v is number => v != null)
    ),
    humanOutcomeIsProduction: true,
    counterfactual: "unknown",
  };
}

export function shadowRowsFromReport(shadow: ShadowReport): ShadowEvidenceRow[] {
  return [...shadow.evaluations]
    .sort((a, b) => a.evaluationId.localeCompare(b.evaluationId))
    .map((row) => {
      const cmp = shadow.comparisons.find((c) => c.contextKey === row.contextKey);
      const top3Changed = cmp
        ? [...cmp.v1Ranking.slice(0, 3)].sort((a, b) => a.localeCompare(b)).join("|") !==
          [...cmp.v2Ranking.slice(0, 3)].sort((a, b) => a.localeCompare(b)).join("|")
        : false;
      return {
        domain: row.layer,
        productionVersion: row.production.weightsVersion,
        shadowVersion: row.shadow.weightsVersion,
        candidateId: row.candidateId,
        productionScore: row.production.score,
        shadowScore: row.shadow.score,
        scoreDelta: row.scoreDelta,
        rankDelta: row.rankDelta,
        productionTop1: cmp?.v1Top1 ?? null,
        shadowTop1: cmp?.v2Top1 ?? null,
        top1Changed: Boolean(cmp?.top1Changed),
        top3Changed,
        humanOutcome: row.productionHumanOutcome,
        counterfactual: "unknown",
      };
    });
}

function assessReadiness(input: {
  quality: EvidenceQuality;
  integrityOk: boolean;
  shadow?: ShadowReport;
}): ReadinessAssessment {
  const h = EVIDENCE_QUALITY_HEURISTICS;
  const blockers: EvidenceQualityWarning[] = [];
  const warnings: EvidenceQualityWarning[] = [];
  if (!input.integrityOk) blockers.push("VERSION_MISMATCH");
  if (input.quality.sampleCount < h.observationSampleMin) blockers.push("INSUFFICIENT_SAMPLE");
  if (input.quality.uniqueProjectCount < h.lowProjectWarn) warnings.push("LOW_PROJECT_DIVERSITY");
  if (input.quality.uniqueUserCount < h.lowUserWarn) warnings.push("LOW_USER_DIVERSITY");
  if (input.quality.uniqueSongCount < h.lowSongWarn) warnings.push("LOW_SONG_DIVERSITY");
  if (input.quality.uniqueSessionCount < h.lowSessionWarn) warnings.push("LOW_SESSION_DIVERSITY");
  if (input.quality.actionDiversity < h.lowActionWarn) warnings.push("LOW_ACTION_DIVERSITY");
  if (
    input.quality.sampleCount >= h.concentratedSampleMin &&
    input.quality.uniqueProjectCount < h.observationProjectsMin
  ) {
    blockers.push("LOW_PROJECT_DIVERSITY");
  }
  if (input.shadow?.status === "UNAVAILABLE") warnings.push("SHADOW_UNAVAILABLE");

  const observation =
    input.integrityOk &&
    input.quality.sampleCount >= h.observationSampleMin &&
    input.quality.uniqueProjectCount >= h.observationProjectsMin &&
    input.quality.uniqueSongCount >= h.observationSongsMin &&
    input.quality.uniqueUserCount >= h.observationUsersMin &&
    input.quality.uniqueSessionCount >= h.observationSessionsMin &&
    input.quality.actionDiversity >= h.observationActionsMin;
  const evidence =
    observation &&
    input.quality.sampleCount >= h.evidenceSampleMin &&
    input.quality.uniqueProjectCount >= h.evidenceProjectsMin &&
    input.quality.uniqueSongCount >= h.evidenceSongsMin &&
    input.quality.uniqueUserCount >= h.evidenceUsersMin &&
    input.quality.uniqueSessionCount >= h.evidenceSessionsMin &&
    input.quality.actionDiversity >= h.evidenceActionsMin;
  const releaseCandidate =
    evidence &&
    input.shadow != null &&
    input.shadow.status !== "UNAVAILABLE" &&
    input.shadow.status !== "REGRESSION" &&
    input.shadow.status !== "INSUFFICIENT";

  let status: EvidenceReadiness = "INSUFFICIENT";
  if (!input.integrityOk) status = "UNAVAILABLE";
  else if (releaseCandidate) status = "RELEASE_CANDIDATE";
  else if (evidence) status = "EVIDENCE_READY";
  else if (observation) status = "OBSERVATION_READY";

  return {
    status,
    blockers: [...new Set(blockers)].sort((a, b) => a.localeCompare(b)),
    warnings: [...new Set(warnings)].sort((a, b) => a.localeCompare(b)),
    canReleaseFormationV2: false,
  };
}

export function canReleaseFormationV2(): false {
  return false;
}

export function analyzeRealWorldEvidence(input: RealWorldEvidenceInput): RealWorldEvidenceReport {
  const expected = input.expected;
  const integrityOk =
    !expected ||
    ((expected.datasetVersion == null || expected.datasetVersion === input.store.schemaVersion) &&
      (expected.weightsVersion == null ||
        input.store.records.every(
          (r) =>
            !r.aiScoreSnapshot.weightsVersion ||
            r.aiScoreSnapshot.weightsVersion === expected.weightsVersion
        )) &&
      (expected.analysisVersion == null ||
        input.shadow == null ||
        input.shadow.analysisVersion === expected.analysisVersion) &&
      (input.shadow == null ||
        input.shadow.versions.datasetVersion === input.store.schemaVersion));

  const shadowUsable = integrityOk ? input.shadow : undefined;
  const rows = groupCandidates(input.store);
  const formation = formationEvidence(rows);
  const transition = transitionEvidence(rows);
  const quality = qualityFrom(rows);
  const readiness = assessReadiness({
    quality,
    integrityOk,
    shadow: shadowUsable,
  });

  return {
    analysisVersion: REAL_WORLD_EVIDENCE_VERSION,
    datasetVersion: input.store.schemaVersion || HUMAN_EVALUATION_VERSION,
    integrity: integrityOk ? "OK" : "UNAVAILABLE",
    formation,
    transition,
    cue: cueEvidence(input.store),
    shadow: shadowSummary(shadowUsable),
    evidenceQuality: quality,
    readiness,
    notes: [
      "Observations only. No causal claim that V2 is preferred.",
      "counterfactual remains unknown.",
      "Stage 14 cannot apply, release, or promote V2.",
      "Diversity thresholds are operational heuristics, not scientific proof.",
    ],
  };
}
