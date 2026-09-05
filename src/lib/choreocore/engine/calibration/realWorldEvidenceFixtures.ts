import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import {
  FORMATION_WEIGHTS_VERSION,
  TRANSITION_WEIGHTS_VERSION,
} from "./humanEvaluationConfig";
import { createHumanEvaluationRecord } from "./humanEvaluationRecord";
import {
  appendHumanEvaluation,
  createHumanEvaluationStore,
} from "./humanEvaluationStore";
import type { HumanEvaluationStore } from "./humanEvaluationTypes";

function formationRow(input: {
  id: string;
  song: string;
  user: string;
  cue: string;
  decision: "accept" | "edit" | "reject";
  formationChanged?: boolean;
  positionChanged?: boolean;
}): ReturnType<typeof createHumanEvaluationRecord> {
  return createHumanEvaluationRecord({
    evaluationId: input.id,
    createdAt: "2026-09-05T00:00:00.000Z",
    subject: {
      kind: "formation",
      candidateId: input.id,
      musicId: input.song,
      cueId: input.cue,
      formationType: "V",
      dancerCount: 6,
    },
    decision: input.decision,
    editSignal:
      input.decision === "edit"
        ? {
            formationChanged: Boolean(input.formationChanged),
            positionChanged: Boolean(input.positionChanged),
          }
        : undefined,
    aiScoreSnapshot: {
      overall: 80,
      breakdown: { visualImpact: 80 },
      weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
      weightsVersion: FORMATION_WEIGHTS_VERSION,
    },
    evaluatorContext: { source: "editor", evaluatorId: input.user },
  });
}

function transitionRow(input: {
  id: string;
  song: string;
  user: string;
  cue: string;
  decision: "accept" | "edit" | "reject";
  pathChanged?: boolean;
  timingChanged?: boolean;
  impossible?: boolean;
}): ReturnType<typeof createHumanEvaluationRecord> {
  return createHumanEvaluationRecord({
    evaluationId: input.id,
    createdAt: "2026-09-05T00:00:00.000Z",
    subject: {
      kind: "transition",
      candidateId: input.id,
      musicId: input.song,
      cueId: input.cue,
      pathKind: "STRAIGHT",
    },
    decision: input.decision,
    humanJudgment: input.impossible ? "impossible" : undefined,
    editSignal:
      input.decision === "edit"
        ? { pathChanged: Boolean(input.pathChanged), timingChanged: Boolean(input.timingChanged) }
        : undefined,
    aiScoreSnapshot: {
      overall: 75,
      breakdown: { pathCost: 70 },
      weights: { ...TRANSITION_SCORE_WEIGHTS },
      weightsVersion: TRANSITION_WEIGHTS_VERSION,
    },
    evaluatorContext: { source: "editor", evaluatorId: input.user },
  });
}

function appendAll(
  rows: Array<ReturnType<typeof createHumanEvaluationRecord>>
): HumanEvaluationStore {
  let store = createHumanEvaluationStore();
  for (const row of rows) store = appendHumanEvaluation(store, row);
  return store;
}

export function emptyRealWorldStore(): HumanEvaluationStore {
  return createHumanEvaluationStore();
}

export function smallRealWorldStore(): HumanEvaluationStore {
  return appendAll([
    formationRow({
      id: "s-1",
      song: "song-a",
      user: "anon-a",
      cue: "c1",
      decision: "accept",
    }),
    formationRow({
      id: "s-2",
      song: "song-a",
      user: "anon-a",
      cue: "c2",
      decision: "reject",
    }),
  ]);
}

/** 件数は多いが 1 song × 1 user = 低多様性 */
export function concentratedRealWorldStore(): HumanEvaluationStore {
  const rows = Array.from({ length: 20 }, (_, i) =>
    formationRow({
      id: `conc-${String(i).padStart(2, "0")}`,
      song: "one-song",
      user: "anon-only",
      cue: `cue-${i}`,
      decision: i % 4 === 0 ? "reject" : "accept",
    })
  );
  return appendAll(rows);
}

/** 観測開始に必要な多様性を満たす（運用ヒューリスティック） */
export function diverseObservationStore(): HumanEvaluationStore {
  const songs = ["sa", "sb", "sc", "sd"];
  const users = ["anon-u1", "anon-u2", "anon-u3"];
  const rows: Array<ReturnType<typeof createHumanEvaluationRecord>> = [];
  let n = 0;
  for (const song of songs) {
    for (const user of users) {
      n += 1;
      rows.push(
        formationRow({
          id: `div-f-${song}-${user}`,
          song,
          user,
          cue: `cue-${n}`,
          decision: n % 3 === 0 ? "edit" : "accept",
          formationChanged: n % 3 === 0,
        })
      );
      if (n % 2 === 0) {
        rows.push(
          transitionRow({
            id: `div-t-${song}-${user}`,
            song,
            user,
            cue: `cue-${n}`,
            decision: "edit",
            pathChanged: true,
          })
        );
      }
    }
  }
  return appendAll(rows);
}
