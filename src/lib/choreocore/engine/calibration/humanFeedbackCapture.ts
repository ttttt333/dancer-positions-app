/**
 * Stage 9: 実編集行動を観測するだけ。学習・weight 変更はしない。
 */

import type { ChoreographyProjectJson } from "../../../../types/choreography";
import { CHOREOGRAPHIC_INTENT_VERSION } from "../intent/ChoreographicIntentEngine";
import {
  FORMATION_INTELLIGENCE_VERSION,
  FORMATION_INTELLIGENCE_WEIGHTS,
} from "../formation/intentFormationConfig";
import { TRANSITION_INTELLIGENCE_VERSION } from "../movement/transitionIntelligenceConfig";
import {
  FORMATION_WEIGHTS_VERSION,
  HUMAN_EVALUATION_VERSION,
} from "./humanEvaluationConfig";
import { createHumanEvaluationRecord } from "./humanEvaluationRecord";
import {
  appendHumanEvaluation,
  createHumanEvaluationStore,
} from "./humanEvaluationStore";
import type { HumanEvaluationRecord, HumanEvaluationStore } from "./humanEvaluationTypes";
import { HUMAN_FEEDBACK_CAPTURE_ENABLED, HUMAN_FEEDBACK_VERSION } from "./humanFeedbackConfig";
import {
  actionsFromEditSignal,
  diffCueAgainstOrigin,
  diffFormationAgainstOrigin,
  formationEditSignal,
  hasSemanticEdit,
  mergeEditSignals,
  transitionEditSignal,
} from "./humanFeedbackDiff";
import {
  anonymousEvaluatorId,
  defaultFeedbackStorage,
  loadHumanFeedbackPersisted,
  saveHumanFeedbackPersisted,
  type FeedbackStorage,
} from "./humanFeedbackPersist";
import type {
  AiCandidateOrigin,
  CaptureSuggestionInput,
  HumanFeedbackEvent,
  HumanFeedbackPersisted,
} from "./humanFeedbackTypes";
import { recordCanaryObservationsFromSuggestion } from "./formationCanaryObserve";

function emptySnapshot(overall = 0) {
  return {
    overall,
    breakdown: {},
    weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
    weightsVersion: FORMATION_WEIGHTS_VERSION,
  };
}

function eventId(parts: string[]): string {
  return `hfe-${parts.join("-")}`;
}

export function buildOriginsFromSuggestion(
  input: CaptureSuggestionInput
): AiCandidateOrigin[] {
  const forms = new Map(input.formations.map((f) => [f.id, f]));
  const origins: AiCandidateOrigin[] = [];
  for (const cue of input.cues) {
    const form = forms.get(cue.formationId);
    if (!form) continue;
    const positions: AiCandidateOrigin["positions"] = {};
    for (const d of form.dancers) {
      positions[d.id] = { xPct: d.xPct, yPct: d.yPct };
    }
    origins.push({
      formationId: form.id,
      cueId: cue.id,
      candidateId: form.id,
      musicId: input.musicId,
      formationName: form.name,
      dancerIds: form.dancers.map((d) => d.id),
      positions,
      tStartSec: cue.tStartSec,
      tEndSec: cue.tEndSec,
      gapApproachFromPrev: cue.gapApproachFromPrev,
      customPathKeys: Object.keys(cue.dancerCustomPaths ?? {}).sort(),
      snapshot: input.scoreByFormationId?.[form.id] ?? emptySnapshot(),
      algorithmVersion: HUMAN_FEEDBACK_VERSION,
      analysisVersion: HUMAN_EVALUATION_VERSION,
      intentVersion: CHOREOGRAPHIC_INTENT_VERSION,
      candidateVersion: FORMATION_INTELLIGENCE_VERSION,
      transitionVersion: TRANSITION_INTELLIGENCE_VERSION,
      weightsVersion: FORMATION_WEIGHTS_VERSION,
    });
  }
  return origins;
}

export function captureSuggestionOutcome(
  input: CaptureSuggestionInput,
  acceptedCueIds: ReadonlySet<string>
): { events: HumanFeedbackEvent[]; records: HumanEvaluationRecord[] } {
  const origins = buildOriginsFromSuggestion(input);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const events: HumanFeedbackEvent[] = [];
  const records: HumanEvaluationRecord[] = [];
  for (const origin of origins) {
    const accepted = acceptedCueIds.has(origin.cueId);
    const action = accepted ? "ACCEPT" : "REJECT";
    const evaluationId = eventId([origin.candidateId, action, createdAt]);
    events.push({
      evaluationId,
      candidateId: origin.candidateId,
      kind: "EXPLICIT",
      action,
      layer: "formation",
      timestamp: createdAt,
    });
    records.push(
      createHumanEvaluationRecord({
        evaluationId,
        createdAt,
        subject: {
          kind: "formation",
          candidateId: origin.candidateId,
          cueId: origin.cueId,
          musicId: origin.musicId,
          intent: origin.intent,
          formationType: origin.formationName,
          dancerCount: origin.dancerIds.length,
        },
        decision: accepted ? "accept" : "reject",
        aiScoreSnapshot: origin.snapshot,
        evaluatorContext: { source: "editor", preview: "music+formation" },
        intentVersion: origin.intentVersion,
        candidateVersion: origin.candidateVersion,
        transitionVersion: origin.transitionVersion,
      })
    );
  }
  return { events, records };
}

export function captureProjectEditsAgainstOrigins(input: {
  origins: AiCandidateOrigin[];
  project: ChoreographyProjectJson;
  createdAt?: string;
}): { events: HumanFeedbackEvent[]; records: HumanEvaluationRecord[] } {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const events: HumanFeedbackEvent[] = [];
  const records: HumanEvaluationRecord[] = [];
  const formations = new Map(input.project.formations.map((f) => [f.id, f]));
  const cues = new Map(input.project.cues.map((c) => [c.id, c]));
  for (const origin of input.origins) {
    const formation = formations.get(origin.formationId);
    if (!formation) continue;
    const cue = cues.get(origin.cueId) ?? input.project.cues.find((c) => c.formationId === origin.formationId);
    const signal = mergeEditSignals(
      diffFormationAgainstOrigin(origin, formation),
      diffCueAgainstOrigin(origin, cue)
    );
    if (!hasSemanticEdit(signal)) continue;
    const fingerprint = [
      Number(signal.positionChanged),
      Number(signal.formationChanged),
      Number(signal.assignmentChanged),
      Number(signal.pathChanged),
      Number(signal.timingChanged),
    ].join("");
    if (origin.lastEditFingerprint === fingerprint) continue;
    origin.lastEditFingerprint = fingerprint;
    const layers: Array<{
      layer: "formation" | "transition";
      layerSignal: ReturnType<typeof formationEditSignal>;
    }> = [];
    const formationSignal = formationEditSignal(signal);
    const transitionSignal = transitionEditSignal(signal);
    if (hasSemanticEdit(formationSignal)) {
      layers.push({ layer: "formation", layerSignal: formationSignal });
    }
    if (hasSemanticEdit(transitionSignal)) {
      layers.push({ layer: "transition", layerSignal: transitionSignal });
    }
    for (const { layer, layerSignal } of layers) {
      const evaluationId = eventId([origin.candidateId, "EDIT", layer, createdAt]);
      events.push({
        evaluationId,
        candidateId: origin.candidateId,
        transitionId: layer === "transition" ? origin.cueId : undefined,
        kind: "IMPLICIT",
        action: "EDIT",
        layer,
        editSignal: layerSignal,
        timestamp: createdAt,
      });
      for (const action of actionsFromEditSignal(layerSignal)) {
        events.push({
          evaluationId: `${evaluationId}-${action}`,
          candidateId: origin.candidateId,
          transitionId: layer === "transition" ? origin.cueId : undefined,
          kind: "IMPLICIT",
          action,
          layer,
          editSignal: layerSignal,
          timestamp: createdAt,
        });
      }
      records.push(
        createHumanEvaluationRecord({
          evaluationId,
          createdAt,
          subject: {
            kind: layer,
            candidateId: origin.candidateId,
            transitionId: origin.cueId,
            cueId: origin.cueId,
            musicId: origin.musicId,
            formationType: origin.formationName,
            dancerCount: origin.dancerIds.length,
          },
          decision: "edit",
          editSignal: layerSignal,
          aiScoreSnapshot: origin.snapshot,
          evaluatorContext: {
            source: "editor",
            preview: layer === "transition" ? "music+formation+transition" : "music+formation",
          },
          intentVersion: origin.intentVersion,
          candidateVersion: origin.candidateVersion,
          transitionVersion: origin.transitionVersion,
        })
      );
    }
  }
  return { events, records };
}

export function feedbackToEvaluationStore(
  records: HumanEvaluationRecord[]
): HumanEvaluationStore {
  let store = createHumanEvaluationStore();
  for (const record of [...records].sort((a, b) =>
    a.evaluationId.localeCompare(b.evaluationId)
  )) {
    store = appendHumanEvaluation(store, record);
  }
  return store;
}

export class HumanFeedbackSession {
  private persisted: HumanFeedbackPersisted;
  private readonly storage: FeedbackStorage;

  constructor(storage: FeedbackStorage = defaultFeedbackStorage()) {
    this.storage = storage;
    this.persisted = loadHumanFeedbackPersisted(storage);
    this.persisted.evaluatorId = anonymousEvaluatorId(storage);
  }

  get evaluatorId(): string {
    return this.persisted.evaluatorId;
  }

  get events(): HumanFeedbackEvent[] {
    return this.persisted.events;
  }

  get origins(): AiCandidateOrigin[] {
    return this.persisted.origins;
  }

  get evaluationRecords(): HumanEvaluationRecord[] {
    return this.persisted.records;
  }

  toEvaluationStore(): HumanEvaluationStore {
    return feedbackToEvaluationStore(this.persisted.records);
  }

  private commit(): void {
    saveHumanFeedbackPersisted(this.persisted, this.storage);
  }

  rememberOrigins(origins: AiCandidateOrigin[]): void {
    const byId = new Map(this.persisted.origins.map((o) => [o.candidateId, o]));
    for (const origin of origins) byId.set(origin.candidateId, origin);
    this.persisted.origins = [...byId.values()];
    this.commit();
  }

  appendOutcome(
    events: HumanFeedbackEvent[],
    records: HumanEvaluationRecord[]
  ): void {
    const evaluatorId = this.persisted.evaluatorId;
    const stampedEvents = events.map((event) => ({ ...event, evaluatorId }));
    const stampedRecords = records.map((record) => ({
      ...record,
      evaluatorContext: {
        source: record.evaluatorContext?.source ?? "editor",
        evaluatorId,
        blind: record.evaluatorContext?.blind,
        preview: record.evaluatorContext?.preview,
      },
    }));
    this.persisted.events = [...this.persisted.events, ...stampedEvents];
    this.persisted.records = [...this.persisted.records, ...stampedRecords];
    this.commit();
  }

  captureSuggestion(input: CaptureSuggestionInput, acceptedCueIds: ReadonlySet<string>): void {
    const origins = buildOriginsFromSuggestion(input);
    this.rememberOrigins(origins);
    const outcome = captureSuggestionOutcome(input, acceptedCueIds);
    this.appendOutcome(outcome.events, outcome.records);
  }

  observeProject(project: ChoreographyProjectJson, createdAt?: string): void {
    const outcome = captureProjectEditsAgainstOrigins({
      origins: this.persisted.origins,
      project,
      createdAt,
    });
    if (outcome.events.length === 0) return;
    this.appendOutcome(outcome.events, outcome.records);
  }
}

let session: HumanFeedbackSession | null = null;

export function getHumanFeedbackSession(
  storage?: FeedbackStorage
): HumanFeedbackSession {
  if (!session || storage) {
    session = new HumanFeedbackSession(storage ?? defaultFeedbackStorage());
  }
  return session;
}

export function resetHumanFeedbackSessionForTests(storage?: FeedbackStorage): void {
  session = storage ? new HumanFeedbackSession(storage) : null;
}

export function isHumanFeedbackCaptureEnabled(): boolean {
  return HUMAN_FEEDBACK_CAPTURE_ENABLED;
}

export function captureEditorSuggestionApply(
  input: CaptureSuggestionInput,
  acceptedCueIds: ReadonlySet<string>
): void {
  if (!HUMAN_FEEDBACK_CAPTURE_ENABLED) return;
  try {
    getHumanFeedbackSession().captureSuggestion(input, acceptedCueIds);
    recordCanaryObservationsFromSuggestion(input, acceptedCueIds);
  } catch {
    /* 観測失敗で Editor を止めない */
  }
}

export function observeEditorProjectChange(
  project: ChoreographyProjectJson
): void {
  if (!HUMAN_FEEDBACK_CAPTURE_ENABLED) return;
  try {
    getHumanFeedbackSession().observeProject(project);
  } catch {
    /* 観測失敗で Editor を止めない */
  }
}
