import { mean, spearman } from "../evaluation/EvaluationMetrics";
import {
  AXIS_GAP_THRESHOLD,
  CALIBRATION_CONFIDENCE,
  CALIBRATION_SAMPLE,
  HIGH_AI_THRESHOLD,
  HUMAN_EVALUATION_VERSION,
  JUDGMENT_ORDINAL,
  LOW_AI_THRESHOLD,
} from "./humanEvaluationConfig";
import type {
  CalibrationConfidence,
  CalibrationReport,
  HumanEvaluationRecord,
  HumanEvaluationStore,
  RankAgreement,
} from "./humanEvaluationTypes";

export function calibrationConfidence(sampleSize: number): CalibrationConfidence {
  if (sampleSize <= CALIBRATION_CONFIDENCE.insufficientMax) return "insufficient";
  if (sampleSize <= CALIBRATION_CONFIDENCE.lowMax) return "low";
  if (sampleSize <= CALIBRATION_CONFIDENCE.moderateMax) return "moderate";
  return "usable";
}

function isGood(record: HumanEvaluationRecord): boolean {
  return record.humanJudgment === "good" || record.humanJudgment === "natural";
}

function isWrong(record: HumanEvaluationRecord): boolean {
  return (
    record.humanJudgment === "wrong" ||
    record.humanJudgment === "awkward" ||
    record.humanJudgment === "impossible"
  );
}

function humanOrdinal(record: HumanEvaluationRecord): number {
  const j = record.humanJudgment;
  if (j === "good" || j === "natural") return JUDGMENT_ORDINAL.good;
  if (j === "acceptable") return JUDGMENT_ORDINAL.acceptable;
  return JUDGMENT_ORDINAL.wrong;
}

function groupKey(record: HumanEvaluationRecord): string {
  return [
    record.subject.musicId ?? "_",
    record.subject.cueId ?? "_",
    record.subject.kind,
  ].join("|");
}

export function computeRankAgreement(records: HumanEvaluationRecord[]): RankAgreement | null {
  const groups = new Map<string, HumanEvaluationRecord[]>();
  for (const record of records) {
    const key = groupKey(record);
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  const usable = [...groups.values()].filter((g) => g.length >= 2);
  if (usable.length === 0 || records.length < CALIBRATION_SAMPLE.rankMin) return null;

  let top1 = 0;
  let top3 = 0;
  const ai: number[] = [];
  const human: number[] = [];
  for (const group of usable) {
    const byAi = [...group].sort(
      (a, b) =>
        b.aiScoreSnapshot.overall - a.aiScoreSnapshot.overall ||
        a.evaluationId.localeCompare(b.evaluationId)
    );
    const byHuman = [...group].sort(
      (a, b) => humanOrdinal(b) - humanOrdinal(a) || a.evaluationId.localeCompare(b.evaluationId)
    );
    if (byAi[0]!.subject.candidateId === byHuman[0]!.subject.candidateId) top1 += 1;
    const humanTop3 = new Set(byHuman.slice(0, 3).map((r) => r.subject.candidateId));
    if (humanTop3.has(byAi[0]!.subject.candidateId)) top3 += 1;
    for (const row of group) {
      ai.push(row.aiScoreSnapshot.overall);
      human.push(humanOrdinal(row));
    }
  }
  return {
    groups: usable.length,
    top1Agreement: top1 / usable.length,
    top3Agreement: top3 / usable.length,
    spearman: spearman(ai, human),
  };
}

function axisHypotheses(records: HumanEvaluationRecord[]): CalibrationReport["axisHypotheses"] {
  const accepted = records.filter(isGood);
  const rejected = records.filter(isWrong);
  if (accepted.length === 0 || rejected.length === 0) return [];
  const axes = new Set<string>();
  for (const row of records) {
    for (const key of Object.keys(row.aiScoreSnapshot.breakdown)) axes.add(key);
  }
  const out: CalibrationReport["axisHypotheses"] = [];
  const sortedAxes = [...axes].sort((a, b) => a.localeCompare(b));
  for (const axis of sortedAxes) {
    const acc = mean(accepted.map((r) => r.aiScoreSnapshot.breakdown[axis] ?? 0));
    const rej = mean(rejected.map((r) => r.aiScoreSnapshot.breakdown[axis] ?? 0));
    const gap = rej - acc;
    if (gap >= AXIS_GAP_THRESHOLD) {
      out.push({
        axis,
        direction: "over-weighted",
        evidence: `rejected mean ${axis}=${rej.toFixed(1)} vs accepted ${acc.toFixed(1)}`,
      });
    } else if (-gap >= AXIS_GAP_THRESHOLD) {
      out.push({
        axis,
        direction: "under-weighted",
        evidence: `accepted mean ${axis}=${acc.toFixed(1)} vs rejected ${rej.toFixed(1)}`,
      });
    }
  }
  return out;
}

function pairwiseAgreement(store: HumanEvaluationStore): number | null {
  if (store.pairwise.length < CALIBRATION_SAMPLE.pairwiseMin) return null;
  const byId = new Map(store.records.map((r) => [r.subject.candidateId, r]));
  let agree = 0;
  let n = 0;
  for (const pair of [...store.pairwise].sort((a, b) => a.pairwiseId.localeCompare(b.pairwiseId))) {
    const a = byId.get(pair.candidateAId);
    const b = byId.get(pair.candidateBId);
    if (!a || !b) continue;
    n += 1;
    const aiPref =
      a.aiScoreSnapshot.overall === b.aiScoreSnapshot.overall
        ? "EQUAL"
        : a.aiScoreSnapshot.overall > b.aiScoreSnapshot.overall
          ? "A"
          : "B";
    if (aiPref === pair.preference) agree += 1;
  }
  return n === 0 ? null : agree / n;
}

export function analyzeAiHumanCalibration(store: HumanEvaluationStore): CalibrationReport {
  const records = [...store.records].sort((a, b) => a.evaluationId.localeCompare(b.evaluationId));
  const goods = records.filter(isGood);
  const wrongs = records.filter(isWrong);
  const notes: string[] = [
    "Human preference is not treated as absolute ground truth.",
    "Weight changes are not applied automatically.",
  ];
  if (records.length < CALIBRATION_SAMPLE.proposalMin) {
    notes.push("Sample size is too small for a weight proposal.");
  }
  return {
    analysisVersion: HUMAN_EVALUATION_VERSION,
    sampleSize: records.length,
    pairwiseCount: store.pairwise.length,
    confidence: calibrationConfidence(records.length),
    autoApplied: false,
    aiVsHuman: {
      highAiRejectCount: wrongs.filter((r) => r.aiScoreSnapshot.overall >= HIGH_AI_THRESHOLD)
        .length,
      lowAiAcceptCount: goods.filter((r) => r.aiScoreSnapshot.overall <= LOW_AI_THRESHOLD).length,
      meanAiWhenGood: goods.length === 0 ? 0 : mean(goods.map((r) => r.aiScoreSnapshot.overall)),
      meanAiWhenWrong: wrongs.length === 0 ? 0 : mean(wrongs.map((r) => r.aiScoreSnapshot.overall)),
    },
    axisHypotheses: axisHypotheses(records),
    rankAgreement: computeRankAgreement(records),
    pairwiseAgreement: pairwiseAgreement(store),
    notes,
  };
}
