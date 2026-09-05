/**
 * Stage 10 分析用 fixture。音楽 timing 正解データとは別。
 * 実運用件数が少なくても、パターン検出の土台を固定するために使う。
 */
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { TRANSITION_SCORE_WEIGHTS } from "../movement/transitionIntelligenceConfig";
import { FORMATION_WEIGHTS_VERSION, TRANSITION_WEIGHTS_VERSION } from "./humanEvaluationConfig";
import { createHumanEvaluationRecord, createPairwiseEvaluation } from "./humanEvaluationRecord";
import {
  appendHumanEvaluation,
  appendPairwiseEvaluation,
  createHumanEvaluationStore,
} from "./humanEvaluationStore";
import type { HumanEditSignal, HumanEvaluationStore } from "./humanEvaluationTypes";

function formationRow(input: {
  id: string;
  type: string;
  overall: number;
  decision: "accept" | "edit" | "reject";
  intent?: string;
  cueId?: string;
  editSignal?: HumanEditSignal;
  visualImpact?: number;
}): ReturnType<typeof createHumanEvaluationRecord> {
  return createHumanEvaluationRecord({
    evaluationId: input.id,
    createdAt: "2026-09-05T00:00:00.000Z",
    subject: {
      kind: "formation",
      candidateId: input.id.replace(/-edit$/, ""),
      musicId: "discrepancy-song",
      cueId: input.cueId ?? "cue-drop",
      intent: input.intent ?? "EXPAND",
      formationType: input.type,
      dancerCount: 6,
    },
    decision: input.decision,
    editSignal: input.editSignal,
    aiScoreSnapshot: {
      overall: input.overall,
      breakdown: {
        intentAlignment: 80,
        visualImpact: input.visualImpact ?? input.overall,
        transitionQuality: 70,
        movementEfficiency: 70,
        stageUsage: 68,
        roleCompatibility: 60,
      },
      weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
      weightsVersion: FORMATION_WEIGHTS_VERSION,
    },
    evaluatorContext: { source: "editor", evaluatorId: "anon-fixture" },
  });
}

function transitionRow(input: {
  id: string;
  overall: number;
  decision: "accept" | "edit" | "reject";
  pathKind?: string;
  cueId?: string;
  editSignal?: HumanEditSignal;
}): ReturnType<typeof createHumanEvaluationRecord> {
  return createHumanEvaluationRecord({
    evaluationId: input.id,
    createdAt: "2026-09-05T00:00:01.000Z",
    subject: {
      kind: "transition",
      candidateId: input.id.replace(/-path$/, "").replace(/-time$/, ""),
      transitionId: input.id,
      musicId: "discrepancy-song",
      cueId: input.cueId ?? "cue-drop",
      pathKind: input.pathKind ?? "STRAIGHT",
      dancerCount: 6,
    },
    decision: input.decision,
    editSignal: input.editSignal,
    aiScoreSnapshot: {
      overall: input.overall,
      breakdown: {
        pathCost: input.overall,
        collisionRisk: 20,
        crossingRisk: 15,
        speedPressure: 30,
        smoothness: 70,
        arrivalSync: 65,
      },
      weights: { ...TRANSITION_SCORE_WEIGHTS },
      weightsVersion: TRANSITION_WEIGHTS_VERSION,
    },
    evaluatorContext: { source: "editor", evaluatorId: "anon-fixture" },
  });
}

/** 高スコア Reject / 低スコア Accept / Accept+Edit / Accept unchanged を含む */
export function discrepancyPatternFixture(): HumanEvaluationStore {
  const rows = [
    formationRow({ id: "cand-high-rej", type: "V", overall: 93, decision: "reject" }),
    formationRow({
      id: "cand-low-acc",
      type: "ARC",
      overall: 40,
      decision: "accept",
      intent: "CONTRACT",
    }),
    formationRow({ id: "cand-form-edit", type: "V", overall: 89, decision: "accept" }),
    formationRow({
      id: "cand-form-edit-edit",
      type: "V",
      overall: 89,
      decision: "edit",
      editSignal: { formationChanged: true },
    }),
    formationRow({ id: "cand-ok", type: "ARC", overall: 91, decision: "accept" }),
    formationRow({
      id: "cand-path",
      type: "LINE",
      overall: 89,
      decision: "accept",
      cueId: "cue-move",
    }),
    transitionRow({
      id: "cand-path-path",
      overall: 89,
      decision: "edit",
      pathKind: "STRAIGHT",
      cueId: "cue-move",
      editSignal: { pathChanged: true },
    }),
    formationRow({
      id: "cand-time",
      type: "LINE",
      overall: 95,
      decision: "accept",
      cueId: "cue-hit",
    }),
    transitionRow({
      id: "cand-time-time",
      overall: 95,
      decision: "edit",
      pathKind: "ARC",
      cueId: "cue-hit",
      editSignal: { timingChanged: true },
    }),
    formationRow({
      id: "cand-pos",
      type: "ARC",
      overall: 86,
      decision: "accept",
      cueId: "cue-verse",
    }),
    formationRow({
      id: "cand-pos-edit",
      type: "ARC",
      overall: 86,
      decision: "edit",
      cueId: "cue-verse",
      editSignal: { positionChanged: true },
    }),
  ];
  let store = createHumanEvaluationStore();
  for (const row of rows) store = appendHumanEvaluation(store, row);
  store = appendPairwiseEvaluation(
    store,
    createPairwiseEvaluation({
      pairwiseId: "pair-high-ok",
      candidateAId: "cand-high-rej",
      candidateBId: "cand-ok",
      preference: "B",
      createdAt: "2026-09-05T00:00:00.000Z",
    })
  );
  return store;
}

export function discrepancySparseFixture(): HumanEvaluationStore {
  let store = createHumanEvaluationStore();
  store = appendHumanEvaluation(
    store,
    formationRow({ id: "only-1", type: "V", overall: 99, decision: "reject" })
  );
  store = appendHumanEvaluation(
    store,
    formationRow({ id: "only-2", type: "ARC", overall: 30, decision: "accept" })
  );
  return store;
}
