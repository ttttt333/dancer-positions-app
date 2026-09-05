/**
 * 実 Editor データの品質監視。学習しない。Release しない。Canary しない。
 * Fixture は REAL レポートに混ぜない。
 */

import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import { HUMAN_FEEDBACK_VERSION } from "./humanFeedbackConfig";
import type { HumanFeedbackEvent, HumanFeedbackPersisted } from "./humanFeedbackTypes";
import type { HumanEvaluationRecord, HumanEvaluationStore } from "./humanEvaluationTypes";
import { feedbackToEvaluationStore } from "./humanFeedbackCapture";
import {
  defaultFeedbackStorage,
  loadHumanFeedbackPersisted,
  type FeedbackStorage,
} from "./humanFeedbackPersist";
import { analyzeRealWorldEvidence } from "./realWorldEvidence";
import type { ShadowReport } from "./shadowTypes";
import {
  DATA_QUALITY_BUFFER_CAPACITY,
  DATA_QUALITY_HEURISTICS,
  DATA_QUALITY_VERSION,
  UNKNOWN_SONG_SENTINEL,
} from "./dataQualityConfig";
import type {
  DataQualityCompleteness,
  DataQualityDimensionVerdict,
  DataQualityDimensions,
  DataQualityDiversity,
  DataQualityDuplicates,
  DataQualitySongIdentity,
  DataQualitySources,
  DataQualityStatus,
  DataQualityVolume,
  RealWorldDataQualityReport,
} from "./dataQualityTypes";
import type { ReleaseDecisionDataSource } from "./releaseDecisionTypes";

export type DataQualityInput = {
  dataSource: ReleaseDecisionDataSource;
  persisted?: HumanFeedbackPersisted;
  store?: HumanEvaluationStore;
  shadow?: ShadowReport;
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function rate(known: number, unknown: number): number | null {
  const total = known + unknown;
  return total === 0 ? null : known / total;
}

function songOf(record: HumanEvaluationRecord): string {
  const raw = record.subject.musicId?.trim();
  return raw ? raw : UNKNOWN_SONG_SENTINEL;
}

function isUnknownSong(song: string): boolean {
  return !song || song === UNKNOWN_SONG_SENTINEL;
}

function userOf(record: HumanEvaluationRecord, fallback: string): string {
  return record.evaluatorContext?.evaluatorId ?? fallback;
}

function fingerprintOf(event: HumanFeedbackEvent): string {
  return [
    event.candidateId,
    event.action,
    event.layer,
    event.timestamp,
    JSON.stringify(event.editSignal ?? {}),
  ].join("|");
}

function countActions(events: HumanFeedbackEvent[], action: HumanFeedbackEvent["action"]): number {
  return events.filter((event) => event.action === action).length;
}

function classifySource(
  record: HumanEvaluationRecord,
  dataSource: ReleaseDecisionDataSource
): "FIXTURE" | "REAL_EDITOR" | "OTHER_VALID_SOURCE" | "INVALID" {
  if (dataSource === "FIXTURE") return "FIXTURE";
  const source = record.evaluatorContext?.source;
  if (source === "editor") return "REAL_EDITOR";
  if (source === "internal") return "OTHER_VALID_SOURCE";
  return "INVALID";
}

function volumeFrom(
  events: HumanFeedbackEvent[],
  records: HumanEvaluationRecord[],
  unchangedCount: number
): DataQualityVolume {
  return {
    totalEventCount: events.length,
    formationEventCount: events.filter((event) => event.layer === "formation").length,
    transitionEventCount: events.filter((event) => event.layer === "transition").length,
    cueEventCount: records.filter((record) => Boolean(record.subject.cueId)).length,
    acceptCount: countActions(events, "ACCEPT"),
    rejectCount: countActions(events, "REJECT"),
    editCount: events.filter(
      (event) =>
        event.action === "EDIT" ||
        event.action.endsWith("_EDIT") ||
        event.action === "SWAP"
    ).length,
    unchangedCount,
    positionEditCount: countActions(events, "POSITION_EDIT"),
    formationEditCount: countActions(events, "FORMATION_EDIT"),
    assignmentEditCount: countActions(events, "ASSIGNMENT_EDIT"),
    swapCount: countActions(events, "SWAP"),
    pathEditCount: countActions(events, "PATH_EDIT"),
    timingEditCount: countActions(events, "TIMING_EDIT"),
  };
}

function completenessFrom(
  records: HumanEvaluationRecord[],
  fallbackUser: string
): DataQualityCompleteness {
  let missingProjectKeyCount = 0;
  let missingSessionKeyCount = 0;
  let missingCandidateIdCount = 0;
  let missingEvaluatorIdCount = 0;
  let missingPieceTitleCount = 0;
  let missingVersionCount = 0;
  let unknownSongCount = 0;
  for (const record of records) {
    const song = songOf(record);
    const user = userOf(record, fallbackUser);
    if (!record.subject.candidateId) missingCandidateIdCount += 1;
    if (!record.evaluatorContext?.evaluatorId) missingEvaluatorIdCount += 1;
    if (isUnknownSong(song)) {
      unknownSongCount += 1;
      missingPieceTitleCount += 1;
    }
    if (isUnknownSong(song) || user === "unknown-user" || !record.evaluatorContext?.evaluatorId) {
      missingProjectKeyCount += 1;
    }
    if (!record.evaluatorContext?.evaluatorId || !record.subject.cueId) {
      missingSessionKeyCount += 1;
    }
    if (
      !record.algorithmVersion ||
      !record.analysisVersion ||
      !record.scoreWeightsVersion ||
      !record.aiScoreSnapshot.weightsVersion
    ) {
      missingVersionCount += 1;
    }
  }
  return {
    missingProjectKeyCount,
    missingSessionKeyCount,
    missingCandidateIdCount,
    missingEvaluatorIdCount,
    missingPieceTitleCount,
    missingVersionCount,
    unknownSongCount,
  };
}

function songIdentityFrom(records: HumanEvaluationRecord[]): DataQualitySongIdentity {
  let knownSongCount = 0;
  let unknownSongCount = 0;
  for (const record of records) {
    if (isUnknownSong(songOf(record))) unknownSongCount += 1;
    else knownSongCount += 1;
  }
  return {
    knownSongCount,
    unknownSongCount,
    songIdentityCoverage: rate(knownSongCount, unknownSongCount),
  };
}

function duplicatesFrom(events: HumanFeedbackEvent[]): DataQualityDuplicates {
  const ids = new Map<string, number>();
  const prints = new Map<string, number>();
  for (const event of events) {
    ids.set(event.evaluationId, (ids.get(event.evaluationId) ?? 0) + 1);
    prints.set(fingerprintOf(event), (prints.get(fingerprintOf(event)) ?? 0) + 1);
  }
  const extra = (map: Map<string, number>) =>
    [...map.values()].reduce((sum, n) => sum + Math.max(0, n - 1), 0);
  return {
    duplicateEventCount: extra(ids),
    duplicateFingerprintCount: extra(prints),
  };
}

function sourcesFrom(
  records: HumanEvaluationRecord[],
  dataSource: ReleaseDecisionDataSource
): DataQualitySources {
  const sources: DataQualitySources = {
    realEditorCount: 0,
    fixtureCount: 0,
    otherValidSourceCount: 0,
    invalidCount: 0,
  };
  for (const record of records) {
    const kind = classifySource(record, dataSource);
    if (kind === "FIXTURE") sources.fixtureCount += 1;
    else if (kind === "REAL_EDITOR") sources.realEditorCount += 1;
    else if (kind === "OTHER_VALID_SOURCE") sources.otherValidSourceCount += 1;
    else sources.invalidCount += 1;
  }
  return sources;
}

function versionMismatchCount(
  records: HumanEvaluationRecord[],
  store: HumanEvaluationStore,
  shadow?: ShadowReport
): number {
  let count = 0;
  for (const record of records) {
    if (
      record.algorithmVersion !== HUMAN_EVALUATION_VERSION ||
      record.analysisVersion !== HUMAN_EVALUATION_VERSION
    ) {
      count += 1;
    }
  }
  if (store.schemaVersion && store.schemaVersion !== HUMAN_EVALUATION_VERSION) count += 1;
  if (shadow && shadow.versions.datasetVersion !== store.schemaVersion) count += 1;
  return count;
}

function overallStatus(dimensions: DataQualityDimensions): DataQualityStatus {
  const values = Object.values(dimensions);
  if (values.includes("BLOCKED")) return "BLOCKED";
  if (values.includes("DEGRADED")) return "DEGRADED";
  if (values.includes("WATCH")) return "WATCH";
  return "HEALTHY";
}

export function analyzeRealWorldDataQuality(input: DataQualityInput): RealWorldDataQualityReport {
  const persisted = input.persisted ?? {
    schemaVersion: HUMAN_FEEDBACK_VERSION,
    evaluatorId: "unknown-user",
    origins: [],
    events: [],
    records: [],
  };
  const events = [...persisted.events].sort((a, b) => a.evaluationId.localeCompare(b.evaluationId));
  const records = [...(input.store?.records ?? persisted.records)].sort((a, b) =>
    a.evaluationId.localeCompare(b.evaluationId)
  );
  const store = input.store ?? feedbackToEvaluationStore(records);
  const evidence = analyzeRealWorldEvidence({
    store,
    shadow: input.dataSource === "REAL" ? input.shadow : undefined,
  });
  const volume = volumeFrom(events, records, evidence.formation.acceptUnchangedCount);
  const completeness = completenessFrom(records, persisted.evaluatorId);
  const songIdentity = songIdentityFrom(records);
  const duplicates = duplicatesFrom(events);
  const versions = { versionMismatchCount: versionMismatchCount(records, store, input.shadow) };
  const sources = sourcesFrom(records, input.dataSource);
  const diversity: DataQualityDiversity = {
    uniqueProjectCount: evidence.evidenceQuality.uniqueProjectCount,
    uniqueSessionCount: evidence.evidenceQuality.uniqueSessionCount,
    uniqueUserCount: evidence.evidenceQuality.uniqueUserCount,
    uniqueSongCount: evidence.evidenceQuality.uniqueSongCount,
    uniqueActionCount: evidence.evidenceQuality.actionDiversity,
    warnings: evidence.readiness.warnings,
  };
  const h = DATA_QUALITY_HEURISTICS;
  const blockers: string[] = [];
  const warnings: string[] = [...diversity.warnings];
  if (input.dataSource === "REAL" && sources.fixtureCount > 0) {
    blockers.push("FIXTURE_LEAKED_INTO_REAL");
  }
  if (versions.versionMismatchCount > 0) blockers.push("VERSION_MISMATCH");
  if (sources.invalidCount > 0) blockers.push("INVALID_SOURCE");
  if (completeness.missingCandidateIdCount > 0) blockers.push("MISSING_CANDIDATE_ID");
  if (volume.totalEventCount === 0) warnings.push("REAL_SAMPLE_COUNT_ZERO");
  if (songIdentity.unknownSongCount > 0) warnings.push("UNKNOWN_SONG");
  if (completeness.missingEvaluatorIdCount > 0) warnings.push("MISSING_EVALUATOR_ID");
  if (duplicates.duplicateEventCount > 0) warnings.push("DUPLICATE_EVENTS");

  const dim = (blocked: boolean, degraded: boolean, watch: boolean): DataQualityDimensionVerdict => {
    if (blocked) return "BLOCKED";
    if (degraded) return "DEGRADED";
    if (watch) return "WATCH";
    return "PASS";
  };
  const dimensions: DataQualityDimensions = {
    volume: dim(false, false, volume.totalEventCount === 0),
    diversity: dim(
      false,
      false,
      diversity.uniqueProjectCount < h.observationProjectsMin ||
        diversity.uniqueSongCount < h.observationSongsMin ||
        volume.totalEventCount === 0
    ),
    completeness: dim(
      completeness.missingCandidateIdCount > 0,
      completeness.missingPieceTitleCount > 0 || completeness.missingEvaluatorIdCount > 0,
      false
    ),
    duplicateIntegrity: dim(false, duplicates.duplicateEventCount > 0, false),
    versionIntegrity: dim(versions.versionMismatchCount > 0, false, false),
    sourceIntegrity: dim(
      (input.dataSource === "REAL" && sources.fixtureCount > 0) || sources.invalidCount > 0,
      false,
      false
    ),
    observationCoverage: dim(false, false, volume.acceptCount + volume.rejectCount === 0),
  };
  const current = events.length;
  return {
    analysisVersion: DATA_QUALITY_VERSION,
    dataSource: input.dataSource,
    status: overallStatus(dimensions),
    volume,
    diversity,
    completeness,
    songIdentity,
    duplicates,
    versions,
    sources,
    observationCoverage: {
      acceptCount: volume.acceptCount,
      rejectCount: volume.rejectCount,
      historyEditCount: volume.editCount,
      applyOutcomeCount: volume.acceptCount + volume.rejectCount,
    },
    collaboration: {
      localEditorObservedChanges: sources.realEditorCount,
      collaborativeObservedChanges: null,
      note: "Collaboration uses the same observeEditorProjectChange path; events are not separately tagged.",
    },
    buffer: {
      bufferCapacity: DATA_QUALITY_BUFFER_CAPACITY,
      currentEventCount: current,
      bufferUtilization: current / DATA_QUALITY_BUFFER_CAPACITY,
      droppedDueToCapacity: current < DATA_QUALITY_BUFFER_CAPACITY ? 0 : null,
    },
    storageResetDetected: null,
    dimensions,
    blockers: uniqueSorted(blockers),
    warnings: uniqueSorted(warnings),
    notes: [
      "This report measures observation-dataset quality only.",
      "It is not a teacher score, choreography score, or V2 score.",
      "High volume cannot compensate for broken integrity.",
      "Data Quality does not bypass Stage 14/15 release gates.",
      "Fixture data must not be treated as real production evidence.",
    ],
  };
}

export function analyzeProductionDataQuality(
  storage?: FeedbackStorage
): RealWorldDataQualityReport {
  const persisted = loadHumanFeedbackPersisted(storage ?? defaultFeedbackStorage());
  return analyzeRealWorldDataQuality({
    dataSource: "REAL",
    persisted,
  });
}
