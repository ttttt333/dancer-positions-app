import type { RealWorldBenchmarkResult, RootCause } from "../types/RealWorldTypes";
import { SONG_DIFFICULTIES } from "../types/RealWorldTypes";
import type {
  AdvisorExtras,
  AdvisorLayerWeights,
  DisagreementNote,
  ExpectedImpact,
  LayerPriorityBreakdown,
  PriorityCard,
  QualityAdvisorReport,
  RecommendedFix,
} from "../types/AdvisorTypes";
import {
  ADVISOR_VERSION,
  DEFAULT_ADVISOR_WEIGHTS,
  FAILED_AT_BY_LAYER,
  QUALITY_GATE_TARGETS,
  ROADMAP_LEVEL_BY_LAYER,
} from "../types/AdvisorTypes";
import type { LayerScores, RealWorldFailureBucket } from "../types/RealWorldTypes";
import { clamp, mean } from "../evaluation/EvaluationMetrics";
import {
  LAYER_ORDER,
  errorSeverity,
  fixDifficulty,
  impactLabel,
  layerPriorityScore,
} from "./PriorityModel";
import { evaluateQualityGates } from "./QualityGates";

const LAYER_BUCKETS: Record<keyof LayerScores, RealWorldFailureBucket[]> = {
  phase1Audio: ["ENERGY"],
  phase2Structure: ["STRUCTURE", "ENERGY"],
  phase3Cue: ["TIMING", "HIT", "CUE_DENSITY"],
  phase4Formation: ["FORMATION"],
  phase5Movement: ["MOVEMENT", "COLLISION", "SAFETY"],
  phase6Sequence: ["VARIETY", "SEQUENCE"],
};

const FIXES: Record<keyof LayerScores, RecommendedFix[]> = {
  phase1Audio: [
    { order: 1, action: "Onset / hop-size の感度確認", parameterHint: "onset threshold / hop size", neverLoosenSafety: true },
  ],
  phase2Structure: [
    { order: 1, action: "Bar snapping tolerance 調整", parameterHint: "beatSnapTolerance", neverLoosenSafety: true },
    { order: 2, action: "Energy / Spectral weighting 再調整", parameterHint: "sectionBoundaryWeights / spectralChangeThreshold", neverLoosenSafety: true },
    { order: 3, action: "Break detection window 拡張", parameterHint: "silenceMinimumDuration / eventClusterWindowSeconds", neverLoosenSafety: true },
  ],
  phase3Cue: [
    { order: 1, action: "Cue density: minor HIT threshold を上げる", parameterHint: "microShiftThreshold / lowPriorityCooldownBeats", neverLoosenSafety: true },
    { order: 2, action: "Major Change / HOLD 判定の閾値確認", parameterHint: "majorPriorityThreshold", neverLoosenSafety: true },
    { order: 3, action: "Anticipation beats の見直し", parameterHint: "anticipationBeats", neverLoosenSafety: true },
  ],
  phase4Formation: [
    { order: 1, action: "Template novelty / diversity weight 調整", parameterHint: "novelty / complexity", neverLoosenSafety: true },
    { order: 2, action: "Intent 適合と stage coverage の再バランス", parameterHint: "musicFit / spacing / symmetry", neverLoosenSafety: true },
  ],
  phase5Movement: [
    { order: 1, action: "Unsafe を可行として残さない（feasibility gate 強化）", parameterHint: "minimumFeasibility / collision thresholds", neverLoosenSafety: true },
    { order: 2, action: "Safety 閾値は緩めない", parameterHint: "softViolationRatio must not decrease risk controls", neverLoosenSafety: true },
  ],
  phase6Sequence: [
    { order: 1, action: "Music Story / Future potential の重み調整", parameterHint: "musicStory / futurePotentialWeight", neverLoosenSafety: true },
    { order: 2, action: "Look-ahead / dead-end / trap penalty の確認", parameterHint: "lookAhead / deadEndPenalty / trapPenalty", neverLoosenSafety: true },
  ],
};

function bucketTotal(
  result: RealWorldBenchmarkResult,
  buckets: RealWorldFailureBucket[]
): number {
  let n = 0;
  for (const bucket of buckets) {
    n += SONG_DIFFICULTIES.reduce((s, d) => s + result.failureMatrix.buckets[bucket][d], 0);
  }
  return n;
}

function layerFrequency(result: RealWorldBenchmarkResult, layer: keyof LayerScores): number {
  const songs = Math.max(result.songsEvaluated, 1);
  const fromMatrix = bucketTotal(result, LAYER_BUCKETS[layer]) / songs;
  const fromDiag = new Set(
    result.diagnostics.filter((d) => d.failedAt === FAILED_AT_BY_LAYER[layer]).map((d) => d.songId)
  ).size / songs;
  return clamp(Math.max(fromMatrix, fromDiag), 0, 1);
}

function layerProblems(
  result: RealWorldBenchmarkResult,
  layer: keyof LayerScores,
  extras: AdvisorExtras
): string[] {
  const problems: string[] = [];
  const diags = result.diagnostics.filter((d) => d.failedAt === FAILED_AT_BY_LAYER[layer]);
  if (layer === "phase2Structure") {
    const errors = diags.map((d) => d.timingError).filter((v): v is number => v !== undefined);
    const meanErr = extras.meanBoundaryError ?? (errors.length ? mean(errors) : undefined);
    if (meanErr !== undefined) problems.push(`Section boundary平均誤差 ${meanErr.toFixed(2)}s`);
    if (extras.dropRecall !== undefined) problems.push(`Drop検出 recall ${(extras.dropRecall * 100).toFixed(0)}%`);
    if (extras.breakRecall !== undefined) problems.push(`Break検出 recall ${(extras.breakRecall * 100).toFixed(0)}%`);
    const drop = result.categoryBreakdown.DROP_HEAVY;
    if (drop && result.overall - drop.overall > 4) {
      problems.push(`DROP_HEAVY category が Overall より ${(result.overall - drop.overall).toFixed(1)} 点低い`);
    }
  }
  if (layer === "phase3Cue") {
    if (extras.overgenerationRate !== undefined) {
      problems.push(`Cue overgeneration ${(extras.overgenerationRate * 100).toFixed(0)}%`);
    }
    const density = diags.filter((d) => d.rootCause === "CUE_DENSITY").length;
    if (density > 0) problems.push(`CUE_DENSITY findings: ${density}`);
    if (result.summary.cueF1 < QUALITY_GATE_TARGETS.cueF1) {
      problems.push(`Cue F1 ${(result.summary.cueF1 * 100).toFixed(1)}% < 80%`);
    }
    if (result.summary.majorCueRecall < QUALITY_GATE_TARGETS.majorCueRecall) {
      problems.push(`Major Cue Recall ${(result.summary.majorCueRecall * 100).toFixed(1)}% < 85%`);
    }
  }
  if (layer === "phase4Formation" && result.summary.formationTop3 < QUALITY_GATE_TARGETS.formationTop3) {
    problems.push(`Formation Top-3 ${(result.summary.formationTop3 * 100).toFixed(1)}% < 80%`);
  }
  if (layer === "phase5Movement") {
    problems.push(`Unsafe recommendation ${(result.summary.unsafeRecommendationRate * 100).toFixed(2)}%`);
  }
  if (layer === "phase6Sequence" && result.summary.sequenceCorrelation < QUALITY_GATE_TARGETS.sequenceCorrelation) {
    problems.push(`Sequence correlation ${result.summary.sequenceCorrelation.toFixed(2)} < 0.75`);
  }
  if (problems.length === 0) {
    problems.push(`Layer score ${result.layerScores[layer].toFixed(1)}`);
  }
  return problems;
}

function layerRootCauses(result: RealWorldBenchmarkResult, layer: keyof LayerScores): RootCause[] {
  const set = new Set(
    result.diagnostics.filter((d) => d.failedAt === FAILED_AT_BY_LAYER[layer]).map((d) => d.rootCause)
  );
  return [...set].sort((a, b) => a.localeCompare(b));
}

function expectedImpact(layer: keyof LayerScores, severity: number, downstream: number): ExpectedImpact {
  const overallPointsLow = clamp(severity * downstream * 8, 0, 12);
  const overallPointsHigh = clamp(severity * downstream * 14, 0, 18);
  const cueF1Delta = layer === "phase2Structure" || layer === "phase3Cue" ? clamp(severity * 0.12, 0, 0.15) : 0;
  const majorCueRecallDelta = layer === "phase3Cue" ? clamp(severity * 0.1, 0, 0.12) : layer === "phase2Structure" ? clamp(severity * 0.06, 0, 0.08) : 0;
  const sequenceCorrelationDelta = layer === "phase6Sequence" ? clamp(severity * 0.12, 0, 0.15) : 0;
  const unsafeDelta = layer === "phase5Movement" ? -clamp(severity * 0.02, 0, 0.02) : 0;
  const summary = `Overall +${overallPointsLow.toFixed(0)}〜${overallPointsHigh.toFixed(0)} points${
    cueF1Delta > 0 ? ` / Cue F1 +${(cueF1Delta * 100).toFixed(0)}%` : ""
  }`;
  return {
    overallPointsLow,
    overallPointsHigh,
    cueF1Delta,
    majorCueRecallDelta,
    sequenceCorrelationDelta,
    unsafeDelta,
    summary,
  };
}

function disagreementNotes(result: RealWorldBenchmarkResult): DisagreementNote[] {
  return [...result.consensusReviews]
    .sort((a, b) => a.songId.localeCompare(b.songId) || a.cueId.localeCompare(b.cueId))
    .map((row) => {
      const choices = [...new Set(row.humanChoices.map((c) => c.formationType))].sort();
      return {
        songId: row.songId,
        cueId: row.cueId,
        choices,
        interpretation:
          "人間同士で Top-1 が割れている。AI がいずれかを選んでもそれだけでは誤りではない。軸別スコアで説明できることが目標。",
      };
    });
}

export function adviseImprovement(
  result: RealWorldBenchmarkResult,
  extras: AdvisorExtras = {},
  weights: AdvisorLayerWeights = DEFAULT_ADVISOR_WEIGHTS
): QualityAdvisorReport {
  const songs = result.songsEvaluated;
  const unsafe = result.summary.unsafeRecommendationRate;
  const safetyBroken = unsafe > QUALITY_GATE_TARGETS.unsafeRecommendation;
  const formationDisagreementOnly =
    result.consensusReviews.length > 0 && result.summary.formationTop3 >= QUALITY_GATE_TARGETS.formationTop3;

  const raw: LayerPriorityBreakdown[] = LAYER_ORDER.map((layer) => {
    let frequency = songs === 0 ? 0 : layerFrequency(result, layer);
    if (layer === "phase4Formation" && formationDisagreementOnly) {
      frequency *= 0.25;
    }
    let downstream = weights.downstream[layer];
    if (layer === "phase5Movement" && safetyBroken) downstream = 1;
    const score = result.layerScores[layer];
    return {
      layer,
      failedAt: FAILED_AT_BY_LAYER[layer],
      level: ROADMAP_LEVEL_BY_LAYER[layer],
      score,
      severity: errorSeverity(score),
      frequency,
      downstreamImpact: downstream,
      fixability: weights.fixability[layer],
      impactLabel: impactLabel(downstream),
      fixDifficulty: fixDifficulty(weights.fixability[layer]),
      priorityScore: layerPriorityScore(score, frequency, layer, {
        ...weights,
        downstream: { ...weights.downstream, [layer]: downstream },
      }),
      rank: 0,
      safetyForced: false,
    };
  });

  raw.sort((a, b) => b.priorityScore - a.priorityScore || a.layer.localeCompare(b.layer));
  if (safetyBroken) {
    const idx = raw.findIndex((r) => r.layer === "phase5Movement");
    if (idx >= 0) {
      const [safety] = raw.splice(idx, 1);
      raw.unshift({ ...safety!, safetyForced: true, rank: 1 });
    }
  }
  raw.forEach((row, i) => {
    row.rank = i + 1;
  });

  const cards: PriorityCard[] = raw.slice(0, 3).map((row) => ({
    rank: row.rank,
    layer: row.layer,
    failedAt: row.failedAt,
    level: row.level,
    score: row.score,
    impactLabel: row.impactLabel,
    frequency: row.frequency,
    priorityScore: row.priorityScore,
    safetyForced: row.safetyForced,
    problems: layerProblems(result, row.layer, extras),
    rootCauses: layerRootCauses(result, row.layer),
    fixes: FIXES[row.layer],
    expectedImpact: expectedImpact(row.layer, row.severity, row.downstreamImpact),
    note: row.safetyForced
      ? "Safety は他スコアに負けない制約。Unsafe が目標を超えたため最優先。"
      : row.layer === "phase4Formation" && formationDisagreementOnly
        ? "Human Top-1 の不一致は AI 誤りと数えない。"
        : undefined,
  }));

  const gates = evaluateQualityGates(result.summary, result.humanCeilingRatio);

  return {
    advisorVersion: ADVISOR_VERSION,
    overall: result.overall,
    grade: result.grade,
    humanHumanAgreement: result.humanHumanAgreement,
    aiHumanAgreement: result.aiHumanAgreement,
    humanCeilingRatio: result.humanCeilingRatio.overall,
    gates,
    layerPriorities: raw,
    cards,
    disagreements: disagreementNotes(result),
    principle:
      "目標は人間と同一の答えではなく、音楽的・視覚的・物理的に合理的で説明可能な提案を安定して出すこと。",
    safetyConstraintHeld: !safetyBroken,
  };
}
