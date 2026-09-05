/**
 * 振付家の好み・評価データ。音楽 timing の正解データ（musicAccuracyFixtures）とは別。
 */
import { FORMATION_INTELLIGENCE_WEIGHTS } from "../formation/intentFormationConfig";
import { FORMATION_WEIGHTS_VERSION } from "./humanEvaluationConfig";
import { createHumanEvaluationRecord, createPairwiseEvaluation } from "./humanEvaluationRecord";
import {
  appendHumanEvaluation,
  appendPairwiseEvaluation,
  createHumanEvaluationStore,
} from "./humanEvaluationStore";
import type { HumanEvaluationStore } from "./humanEvaluationTypes";

function formationEval(input: {
  id: string;
  type: string;
  overall: number;
  visualImpact: number;
  transitionQuality: number;
  decision: "accept" | "edit" | "reject";
  cueId?: string;
}): ReturnType<typeof createHumanEvaluationRecord> {
  return createHumanEvaluationRecord({
    evaluationId: input.id,
    createdAt: "2026-09-05T00:00:00.000Z",
    subject: {
      kind: "formation",
      candidateId: input.id,
      musicId: "fixture-song",
      cueId: input.cueId ?? "cue-drop",
      intent: "EXPAND",
      formationType: input.type,
      dancerCount: 6,
    },
    decision: input.decision,
    aiScoreSnapshot: {
      overall: input.overall,
      breakdown: {
        intentAlignment: 80,
        visualImpact: input.visualImpact,
        transitionQuality: input.transitionQuality,
        movementEfficiency: 70,
        stageUsage: 68,
        roleCompatibility: 60,
      },
      weights: { ...FORMATION_INTELLIGENCE_WEIGHTS },
      weightsVersion: FORMATION_WEIGHTS_VERSION,
    },
    evaluatorContext: { source: "internal", evaluatorId: "anon-a", blind: true },
  });
}

/** AI は V を高く、人間は ARC を好む — 音楽 timing fixture ではない */
export function humanEvaluationPreferenceFixture(): HumanEvaluationStore {
  const rows = [
    formationEval({
      id: "cand-v-1",
      type: "V",
      overall: 92,
      visualImpact: 94,
      transitionQuality: 62,
      decision: "reject",
    }),
    formationEval({
      id: "cand-arc-1",
      type: "ARC",
      overall: 87,
      visualImpact: 78,
      transitionQuality: 88,
      decision: "accept",
    }),
    formationEval({
      id: "cand-v-2",
      type: "V",
      overall: 91,
      visualImpact: 93,
      transitionQuality: 64,
      decision: "reject",
      cueId: "cue-chorus",
    }),
    formationEval({
      id: "cand-arc-2",
      type: "ARC",
      overall: 86,
      visualImpact: 76,
      transitionQuality: 90,
      decision: "accept",
      cueId: "cue-chorus",
    }),
    formationEval({
      id: "cand-v-3",
      type: "V",
      overall: 90,
      visualImpact: 92,
      transitionQuality: 60,
      decision: "reject",
      cueId: "cue-hit",
    }),
    formationEval({
      id: "cand-arc-3",
      type: "ARC",
      overall: 84,
      visualImpact: 74,
      transitionQuality: 86,
      decision: "edit",
      cueId: "cue-hit",
    }),
    formationEval({
      id: "cand-wide-1",
      type: "WIDE_V",
      overall: 89,
      visualImpact: 91,
      transitionQuality: 66,
      decision: "reject",
      cueId: "cue-final",
    }),
    formationEval({
      id: "cand-diag-1",
      type: "DIAGONAL",
      overall: 83,
      visualImpact: 72,
      transitionQuality: 85,
      decision: "accept",
      cueId: "cue-final",
    }),
  ];
  let store = createHumanEvaluationStore();
  for (const row of rows) store = appendHumanEvaluation(store, row);
  store = appendPairwiseEvaluation(
    store,
    createPairwiseEvaluation({
      pairwiseId: "pair-arc-v-1",
      candidateAId: "cand-v-1",
      candidateBId: "cand-arc-1",
      preference: "B",
      createdAt: "2026-09-05T00:00:00.000Z",
    })
  );
  store = appendPairwiseEvaluation(
    store,
    createPairwiseEvaluation({
      pairwiseId: "pair-arc-v-2",
      candidateAId: "cand-v-2",
      candidateBId: "cand-arc-2",
      preference: "B",
      createdAt: "2026-09-05T00:00:00.000Z",
    })
  );
  store = appendPairwiseEvaluation(
    store,
    createPairwiseEvaluation({
      pairwiseId: "pair-arc-v-3",
      candidateAId: "cand-v-3",
      candidateBId: "cand-arc-3",
      preference: "B",
      createdAt: "2026-09-05T00:00:00.000Z",
    })
  );
  store = appendPairwiseEvaluation(
    store,
    createPairwiseEvaluation({
      pairwiseId: "pair-wide-diag",
      candidateAId: "cand-wide-1",
      candidateBId: "cand-diag-1",
      preference: "B",
      createdAt: "2026-09-05T00:00:00.000Z",
    })
  );
  return store;
}
