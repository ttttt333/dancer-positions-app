/**
 * Production Formation / Editor state とは分離した append-only store。
 */

import { HUMAN_EVALUATION_VERSION } from "./humanEvaluationConfig";
import type {
  HumanEvaluationRecord,
  HumanEvaluationStore,
  PairwiseEvaluation,
} from "./humanEvaluationTypes";

export function createHumanEvaluationStore(): HumanEvaluationStore {
  return {
    schemaVersion: HUMAN_EVALUATION_VERSION,
    records: [],
    pairwise: [],
  };
}

export function appendHumanEvaluation(
  store: HumanEvaluationStore,
  record: HumanEvaluationRecord
): HumanEvaluationStore {
  return {
    schemaVersion: store.schemaVersion,
    records: [...store.records, record],
    pairwise: store.pairwise,
  };
}

export function appendPairwiseEvaluation(
  store: HumanEvaluationStore,
  pairwise: PairwiseEvaluation
): HumanEvaluationStore {
  return {
    schemaVersion: store.schemaVersion,
    records: store.records,
    pairwise: [...store.pairwise, pairwise],
  };
}

export function exportHumanEvaluationDataset(store: HumanEvaluationStore): string {
  const sorted: HumanEvaluationStore = {
    schemaVersion: store.schemaVersion,
    records: [...store.records].sort((a, b) => a.evaluationId.localeCompare(b.evaluationId)),
    pairwise: [...store.pairwise].sort((a, b) => a.pairwiseId.localeCompare(b.pairwiseId)),
  };
  return JSON.stringify(sorted);
}

export function importHumanEvaluationDataset(json: string): HumanEvaluationStore {
  const parsed = JSON.parse(json) as HumanEvaluationStore;
  return {
    schemaVersion: parsed.schemaVersion ?? HUMAN_EVALUATION_VERSION,
    records: [...(parsed.records ?? [])],
    pairwise: [...(parsed.pairwise ?? [])],
  };
}
