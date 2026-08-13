import type { AnnotationSession, GroundTruthSet } from "../types/AnnotationTypes";
import type { BenchmarkConfig, BenchmarkSummary, CriticalError, EvaluationResult } from "../types/EvaluationTypes";
import { ANNOTATION_VERSION, EVALUATION_VERSION } from "../types/EvaluationTypes";
import type { RealSongAnnotations, RealWorldBenchmarkResult, RealWorldDataset } from "../types/RealWorldTypes";
import { ANALYSIS_VERSION } from "../constants";
import { ANNOTATION_WORKFLOW_VERSION } from "../types/AnnotationTypes";
import {
  EXPECTED_MAIN_SONGS,
  PILOT_VERSION,
  type ImprovementAdvice,
  type PilotCalibrationBlock,
  type PilotSliceReport,
  type PilotSongReport,
  type PilotStatus,
  type RealWorldPilotResult,
} from "../types/PilotTypes";
import { calculateInterRaterAgreement, generateConsensusReviewItems } from "../annotation/ConsensusEngine";
import { generateGroundTruthSet, groundTruthToRealAnnotations, groundTruthToSongGroundTruth, sessionToRealAnnotations } from "../annotation/GroundTruthBuilder";
import { runCalibration } from "../annotation/Calibration";
import { calculateHumanCeiling, calculateHumanCeilingRatio } from "../realworld/HumanCeiling";
import { runRealWorldBenchmark } from "../realworld/RealWorldBenchmark";
import { adviseImprovement } from "../advisor/ImprovementAdvisor";
import { calculateBenchmarkSummary } from "../evaluation/BenchmarkRunner";
import type { AnalysisCache } from "../evaluation/BenchmarkRunner";
import { resolveBenchmarkConfig } from "../evaluation/EvaluationConfig";
import { applySafetyCap, qualityGrade } from "../evaluation/QualityGrade";
import { evaluateSong } from "../evaluation/EvaluationRunner";
import { clamp, mean } from "../evaluation/EvaluationMetrics";
import {
  calibrationPassed,
  classifyCeilingRatio,
  classifySafety,
  meanDomainAgreement,
  overallFromDomain,
} from "./PilotAgreement";
import { classifyCalibrationReasons, collectPilotDisagreements, generateDisagreementHeatmap } from "./PilotDisagreement";
import { generateLayerDiagnostics, LAYER_REPORT_LABEL } from "./PilotLayers";

export type RealSongPilotInput = {
  dataset: RealWorldDataset;
  calibrationSessions: AnnotationSession[];
  mainSessions: AnnotationSession[];
  expectedMainSongs?: number;
  reviewerId?: string;
  config?: Partial<BenchmarkConfig>;
  cache?: AnalysisCache;
};

const EMPTY_DOMAIN = { cue: 0, section: 0, formation: 0, sequence: 0 };

function emptySummary(config: ReturnType<typeof resolveBenchmarkConfig>): BenchmarkSummary {
  return calculateBenchmarkSummary([], { annotationVersion: ANNOTATION_WORKFLOW_VERSION, items: [] }, config);
}

function versionBlock() {
  return {
    annotationVersion: ANNOTATION_WORKFLOW_VERSION,
    evaluationVersion: EVALUATION_VERSION,
    engineVersion: ANALYSIS_VERSION,
    pilotVersion: PILOT_VERSION,
  };
}

function aiHumanFromParts(cueF1: number, formationTop3: number, sequence: number): number {
  return mean([cueF1, formationTop3, sequence]);
}

function songGateStatus(unsafe: number, confidence: "HIGH" | "MEDIUM" | "LOW"): PilotSongReport["status"] {
  if (unsafe > 0.05 || confidence === "LOW") return "FAIL";
  if (unsafe > 0.02 || confidence === "MEDIUM") return "WATCH";
  return "PASS";
}

function groupSessions(sessions: AnnotationSession[]): Map<string, AnnotationSession[]> {
  const map = new Map<string, AnnotationSession[]>();
  for (const session of [...sessions].sort(
    (a, b) => a.songId.localeCompare(b.songId) || a.annotatorId.localeCompare(b.annotatorId)
  )) {
    const list = map.get(session.songId) ?? [];
    list.push(session);
    map.set(session.songId, list);
  }
  return map;
}

function buildCalibration(sessions: AnnotationSession[]): PilotCalibrationBlock {
  const cal = runCalibration(sessions);
  const byDomain = meanDomainAgreement(sessions);
  const overall = sessions.length ? overallFromDomain(byDomain) : 0;
  const disagreements = [...new Set(sessions.map((s) => s.songId))]
    .sort()
    .flatMap((songId) => generateConsensusReviewItems(sessions.filter((s) => s.songId === songId)));
  const passed = cal.passed && calibrationPassed(overall);
  const reasons = passed ? [] : classifyCalibrationReasons(disagreements);
  if (!passed && reasons.length === 0) reasons.push(cal.reason || "Annotation rule confusion");
  return {
    passed,
    overallAgreement: overall,
    byDomain,
    disagreements,
    reasons: passed ? [] : [...new Set(reasons)].sort(),
    songIds: cal.songIds,
  };
}

function emptyResult(
  status: PilotStatus,
  calibration: PilotCalibrationBlock,
  config: ReturnType<typeof resolveBenchmarkConfig>,
  extras: Partial<RealWorldPilotResult> = {}
): RealWorldPilotResult {
  const { calibration: _c, status: _s, ...rest } = extras;
  return {
    calibration,
    songsEvaluated: rest.songsEvaluated ?? 0,
    expectedSongs: rest.expectedSongs ?? EXPECTED_MAIN_SONGS,
    annotators: rest.annotators ?? 0,
    humanHumanAgreement: rest.humanHumanAgreement ?? 0,
    aiHumanAgreement: rest.aiHumanAgreement ?? 0,
    humanCeilingRatio: rest.humanCeilingRatio ?? 0,
    ceilingClass: rest.ceilingClass ?? "MAJOR_TUNING_REQUIRED",
    safetyClass: rest.safetyClass ?? "PASS",
    status,
    benchmark: rest.benchmark ?? emptySummary(config),
    layerDiagnostics: rest.layerDiagnostics ?? { phase1: 0, phase2: 0, phase3: 0, phase4: 0, phase5: 0, phase6: 0 },
    improvementAdvice: rest.improvementAdvice ?? { cards: [] },
    criticalErrors: rest.criticalErrors ?? [],
    songReports: rest.songReports ?? [],
    categoryReports: rest.categoryReports ?? [],
    bpmReports: rest.bpmReports ?? [],
    disagreements: rest.disagreements ?? [],
    heatmap: rest.heatmap ?? [],
    groundTruth: rest.groundTruth ?? [],
    version: rest.version ?? versionBlock(),
  };
}

export async function runRealSongPilot(input: RealSongPilotInput): Promise<RealWorldPilotResult> {
  const config = resolveBenchmarkConfig(input.config);
  const expected = input.expectedMainSongs ?? EXPECTED_MAIN_SONGS;
  const calibrationSessions = (input.calibrationSessions ?? []).filter((s) => s.mode === "BLIND");
  const mainSessions = (input.mainSessions ?? []).filter((s) => s.mode === "BLIND");
  const dataset = input.dataset ?? { annotationVersion: ANNOTATION_VERSION, items: [] };

  if (calibrationSessions.length === 0 && mainSessions.length === 0 && dataset.items.length === 0) {
    return emptyResult(
      "NO_DATA",
      {
        passed: false,
        overallAgreement: 0,
        byDomain: EMPTY_DOMAIN,
        disagreements: [],
        reasons: ["NO_DATA"],
        songIds: [],
      },
      config,
      { expectedSongs: expected }
    );
  }

  const calibration = buildCalibration(calibrationSessions);
  if (!calibration.passed) {
    const disagreements = collectPilotDisagreements(calibrationSessions);
    return emptyResult("CALIBRATION_FAIL", calibration, config, {
      expectedSongs: expected,
      annotators: new Set(calibrationSessions.map((s) => s.annotatorId)).size,
      disagreements,
      heatmap: generateDisagreementHeatmap(disagreements),
    });
  }

  const grouped = groupSessions(mainSessions);
  const eligibleItems = [...dataset.items]
    .filter((item) => item.song.rightsConfirmed === true)
    .sort((a, b) => a.song.id.localeCompare(b.song.id));

  const groundTruth: GroundTruthSet[] = [];
  const consensusAnns: RealSongAnnotations[] = [];
  const perSongEval: EvaluationResult[] = [];
  for (const item of eligibleItems) {
    const rows = grouped.get(item.song.id) ?? [];
    if (rows.length === 0) continue;
    const high = generateConsensusReviewItems(rows).some((r) => r.severity === "HIGH");
    const gt = generateGroundTruthSet(rows, { reviewedBy: high ? input.reviewerId : undefined });
    groundTruth.push(gt);
    consensusAnns.push(groundTruthToRealAnnotations(gt));
    perSongEval.push(
      evaluateSong({
        songId: item.song.id,
        duration: item.song.duration,
        groundTruth: groundTruthToSongGroundTruth(gt),
        ai: item.ai,
        config,
      })
    );
  }

  const disagreements = collectPilotDisagreements(mainSessions);
  const heatmap = generateDisagreementHeatmap(disagreements);
  const annotators = new Set(mainSessions.map((s) => s.annotatorId)).size;

  if (consensusAnns.length === 0) {
    return emptyResult("PARTIAL_DATA", calibration, config, {
      expectedSongs: expected,
      annotators,
      disagreements,
      heatmap,
      groundTruth,
    });
  }

  const filteredDataset: RealWorldDataset = {
    annotationVersion: dataset.annotationVersion || ANNOTATION_WORKFLOW_VERSION,
    items: eligibleItems.filter((item) => consensusAnns.some((a) => a.songId === item.song.id)),
  };

  const benchmarkResult: RealWorldBenchmarkResult = await runRealWorldBenchmark(
    filteredDataset,
    consensusAnns,
    config,
    { cache: input.cache }
  );

  const ceiling = calculateHumanCeiling(
    mainSessions.map(sessionToRealAnnotations),
    120,
    config.matchingBeats
  );
  const aiHuman = aiHumanFromParts(
    benchmarkResult.summary.cueF1,
    benchmarkResult.summary.formationTop3,
    benchmarkResult.summary.sequenceCorrelation
  );
  const ratio = calculateHumanCeilingRatio(
    {
      cue: benchmarkResult.summary.cueF1,
      formationTop3: benchmarkResult.summary.formationTop3,
      sequence: benchmarkResult.summary.sequenceCorrelation,
      overall: aiHuman,
    },
    ceiling
  );

  const patched: RealWorldBenchmarkResult = {
    ...benchmarkResult,
    humanHumanAgreement: ceiling.overall,
    aiHumanAgreement: aiHuman,
    humanCeiling: ceiling,
    humanCeilingRatio: ratio,
    annotatorCount: annotators,
  };

  const adviceRaw = adviseImprovement(patched);
  const improvementAdvice: ImprovementAdvice = {
    priority1: adviceRaw.cards[0] ? LAYER_REPORT_LABEL[adviceRaw.cards[0].layer] : undefined,
    priority2: adviceRaw.cards[1] ? LAYER_REPORT_LABEL[adviceRaw.cards[1].layer] : undefined,
    priority3: adviceRaw.cards[2] ? LAYER_REPORT_LABEL[adviceRaw.cards[2].layer] : undefined,
    cards: adviceRaw.cards,
  };

  const evalBySong = new Map(perSongEval.map((r) => [r.songId, r]));
  const songReports: PilotSongReport[] = filteredDataset.items.map((item) => {
    const row = evalBySong.get(item.song.id);
    const human = calculateInterRaterAgreement(grouped.get(item.song.id) ?? []).overall;
    const cueF1 = row?.cueMetrics.f1 ?? 0;
    const formationTop3 = row?.formationMetrics.top3Agreement ?? 0;
    const sequence = row?.sequenceMetrics.correlation ?? 0;
    const unsafe = row?.transitionMetrics.unsafeRecommendationRate ?? 0;
    const ai = aiHumanFromParts(cueF1, formationTop3, sequence);
    const gt = groundTruth.find((g) => g.songId === item.song.id);
    const confidence = gt?.confidenceBand ?? "LOW";
    return {
      songId: item.song.id,
      humanHuman: human,
      aiHuman: ai,
      ceilingRatio: human <= 1e-9 ? (ai <= 1e-9 ? 1 : 0) : clamp(ai / human, 0, 2),
      cueF1,
      majorRecall: row?.cueMetrics.majorCueRecall ?? 0,
      formationTop3,
      sequence,
      safety: 1 - unsafe,
      status: songGateStatus(unsafe, confidence),
      groundTruthConfidence: confidence,
    };
  });

  const hhAll = ceiling.overall;
  const categoryReports: PilotSliceReport[] = Object.entries(patched.categoryBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, metrics]) => ({
      key,
      count: metrics.count,
      humanHuman: hhAll,
      aiHuman: aiHumanFromParts(metrics.cueF1, metrics.formationTop3, metrics.sequenceCorrelation),
      ceilingRatio:
        hhAll <= 1e-9
          ? 0
          : aiHumanFromParts(metrics.cueF1, metrics.formationTop3, metrics.sequenceCorrelation) / hhAll,
      cueF1: metrics.cueF1,
      formationTop3: metrics.formationTop3,
      sequence: metrics.sequenceCorrelation,
      safety: 1 - metrics.unsafeRate,
    }));

  const bpmReports: PilotSliceReport[] = (["60-90", "90-120", "120-150", "150+"] as const)
    .filter((key) => patched.bpmBreakdown[key]?.count)
    .map((key) => {
      const metrics = patched.bpmBreakdown[key]!;
      const ai = aiHumanFromParts(metrics.cueF1, metrics.formationTop3, metrics.sequenceCorrelation);
      return {
        key,
        count: metrics.count,
        humanHuman: hhAll,
        aiHuman: ai,
        ceilingRatio: hhAll <= 1e-9 ? 0 : ai / hhAll,
        cueF1: metrics.cueF1,
        formationTop3: metrics.formationTop3,
        sequence: metrics.sequenceCorrelation,
        safety: 1 - metrics.unsafeRate,
      };
    });

  const unsafe = patched.summary.unsafeRecommendationRate;
  const rawGrade = qualityGrade(patched.summary.overallScore);
  const capped = applySafetyCap(rawGrade, unsafe, config.safetyCaps);
  const safetyClass = classifySafety(unsafe, capped !== rawGrade && unsafe > 0.05);

  const criticalErrors: CriticalError[] = perSongEval
    .flatMap((r) => r.criticalErrors.map((e) => ({ ...e, songId: e.songId ?? r.songId })))
    .sort((a, b) => (a.songId ?? "").localeCompare(b.songId ?? "") || a.type.localeCompare(b.type));

  const songsEvaluated = patched.songsEvaluated;
  const status: PilotStatus = songsEvaluated < expected ? "PARTIAL_DATA" : "PILOT_COMPLETE";

  return {
    calibration,
    songsEvaluated,
    expectedSongs: expected,
    annotators,
    humanHumanAgreement: ceiling.overall,
    aiHumanAgreement: aiHuman,
    humanCeilingRatio: ratio.overall,
    ceilingClass: classifyCeilingRatio(ratio.overall),
    safetyClass,
    status,
    benchmark: patched.summary,
    layerDiagnostics: generateLayerDiagnostics(patched.layerScores),
    improvementAdvice,
    criticalErrors,
    songReports,
    categoryReports,
    bpmReports,
    disagreements,
    heatmap,
    groundTruth,
    version: versionBlock(),
  };
}

export { calculateHumanCeilingRatio };
export { generateDisagreementHeatmap };
export { generateLayerDiagnostics };
