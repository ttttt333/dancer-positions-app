/**
 * 実曲注釈（またはエディタ作品）を人手ラベルとして、本番エンジンの品質ゲートを回す。
 */

import type { AnnotationSession } from "../engine/types/AnnotationTypes";
import type {
  AiEvaluationOutput,
  BenchmarkSummary,
  EvaluationResult,
} from "../engine/types/EvaluationTypes";
import type { HumanSectionAnnotation } from "../engine/types/EvaluationTypes";
import type { QualityGateRow } from "../engine/types/AdvisorTypes";
import type { HumanCeilingRatio } from "../engine/types/RealWorldTypes";
import { evaluateQualityGates, overallGateVerdict } from "../engine/advisor/QualityGates";
import { evaluateSong } from "../engine/evaluation/EvaluationRunner";
import { generateGroundTruthSet, sessionToRealAnnotations } from "../engine/annotation/GroundTruthBuilder";
import {
  calculateHumanCeiling,
  calculateHumanCeilingRatio,
} from "../engine/realworld/HumanCeiling";
import { CLASS_ADVANCED_MON7 } from "./classProfiles";
import { runEngineAppSuggest } from "./engineSuggestPipeline";
import { resolveSuggestTaste, type SuggestTasteBias } from "./suggestTaste";
import type { ClassProfile } from "./types";
import type { DancerSpot } from "../../../types/choreography";
import type { ChoreographyProjectJson } from "../../../types/choreography";
import { projectToAnnotationSession } from "./projectToAnnotation";

const UNMEASURED_CEILING: HumanCeilingRatio = {
  cue: 1,
  formationTop3: 1,
  sequence: 1,
  overall: 1,
};

export type RealSongGateReport = {
  songId: string;
  annotatorCount: number;
  usedConsensus: boolean;
  ceilingEstimated: boolean;
  gates: QualityGateRow[];
  overall: QualityGateRow["verdict"];
  evaluation: EvaluationResult;
};

export function peaksFromAnnotatedSections(
  durationSec: number,
  sections: readonly HumanSectionAnnotation[],
  binCount = 400
): number[] {
  const duration = Math.max(0.5, durationSec);
  const n = Math.max(32, binCount);
  const energyFor = (type: string | undefined): number => {
    if (type === "CHORUS" || type === "FINAL_CHORUS" || type === "DROP") return 0.9;
    if (type === "PRE_CHORUS" || type === "BRIDGE") return 0.62;
    if (type === "BREAK") return 0.18;
    if (type === "INTRO" || type === "OUTRO") return 0.28;
    return 0.45;
  };
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * duration;
    const sec = sections.find((s) => t >= s.startTime && t < s.endTime);
    const beat = 0.12 * Math.abs(Math.sin(Math.PI * 2 * (t / 0.5)));
    out.push(Math.min(1, energyFor(sec?.type) + beat));
  }
  return out;
}

export function downsamplePeaks(peaks: number[], target = 512): number[] {
  if (peaks.length <= target) return peaks;
  const out: number[] = [];
  const step = peaks.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = peaks[j] ?? 0;
      if (v > peak) peak = v;
    }
    out.push(peak);
  }
  return out;
}

function seedsFromSessions(sessions: AnnotationSession[]): DancerSpot[] {
  for (const session of sessions) {
    for (const row of session.formations) {
      const pos = row.layout?.positions;
      if (!pos || pos.length === 0) continue;
      return pos.map((p, i) => ({
        id: p.id,
        label: String(i + 1),
        xPct: p.xPct,
        yPct: p.yPct,
        colorIndex: i % 12,
      }));
    }
  }
  return Array.from({ length: 6 }, (_, i) => ({
    id: `dancer-${i + 1}`,
    label: String(i + 1),
    xPct: 20 + (i % 3) * 20,
    yPct: 30 + Math.floor(i / 3) * 20,
    colorIndex: i % 12,
  }));
}

function summaryFromEval(result: EvaluationResult): BenchmarkSummary {
  return {
    songsEvaluated: 1,
    overallScore: result.overallScore,
    grade: result.grade,
    status: "PROMISING",
    cuePrecision: result.cueMetrics.precision,
    cueRecall: result.cueMetrics.recall,
    cueF1: result.cueMetrics.f1,
    majorCueRecall: result.cueMetrics.majorCueRecall,
    sectionAccuracy: result.sectionMetrics.classificationAccuracy,
    formationTop1: result.formationMetrics.top1Agreement,
    formationTop3: result.formationMetrics.top3Agreement,
    transitionCorrelation: result.transitionMetrics.correlation,
    unsafeRecommendationRate: result.transitionMetrics.unsafeRecommendationRate,
    sequenceCorrelation: result.sequenceMetrics.correlation,
    criticalFailureCount: result.criticalErrors.length,
    qualityGates: {},
    failures: [],
    byDifficulty: {},
    byCategory: {},
  };
}

function ceilingRatioFor(
  sessions: AnnotationSession[],
  result: EvaluationResult
): { ratio: HumanCeilingRatio; estimated: boolean } {
  const annotatorCount = new Set(sessions.map((s) => s.annotatorId)).size;
  if (annotatorCount < 2) {
    return { ratio: UNMEASURED_CEILING, estimated: true };
  }
  const anns = sessions.map(sessionToRealAnnotations);
  const ceiling = calculateHumanCeiling(anns, sessions[0]?.bpm || 120);
  if (ceiling.pairs === 0 || ceiling.overall <= 1e-9) {
    return { ratio: UNMEASURED_CEILING, estimated: true };
  }
  const aiHuman = {
    cue: result.cueMetrics.f1,
    formationTop3: result.formationMetrics.top3Agreement,
    sequence: result.sequenceMetrics.correlation,
    overall:
      (result.cueMetrics.f1 +
        result.formationMetrics.top3Agreement +
        result.sequenceMetrics.correlation) /
      3,
  };
  return { ratio: calculateHumanCeilingRatio(aiHuman, ceiling), estimated: false };
}

function withFallbackSections(
  session: AnnotationSession
): AnnotationSession {
  if (session.sections.length > 0) return session;
  return {
    ...session,
    sections: [
      {
        songId: session.songId,
        annotatorId: session.annotatorId,
        startTime: 0,
        endTime: session.duration,
        type: "VERSE",
        confidence: 0.4,
      },
    ],
  };
}

export function scoreAiAgainstSessions(
  sessions: AnnotationSession[],
  ai: AiEvaluationOutput
): RealSongGateReport {
  const usable = sessions.map(withFallbackSections).filter((s) => s.cues.length > 0);
  if (usable.length === 0) {
    throw new Error("注釈にキューがありません");
  }
  const usedConsensus = new Set(usable.map((s) => s.annotatorId)).size >= 2;
  const gt = usedConsensus
    ? generateGroundTruthSet(usable)
    : {
        songId: usable[0]!.songId,
        annotationVersion: usable[0]!.version,
        sections: usable[0]!.sections,
        cues: usable[0]!.cues,
        formations: usable[0]!.formations,
        sequence: usable[0]!.sequence,
      };
  const evaluation = evaluateSong({
    songId: gt.songId,
    duration: usable[0]!.duration,
    groundTruth: {
      songId: gt.songId,
      annotationVersion: gt.annotationVersion,
      sections: gt.sections,
      cues: gt.cues,
      formations: gt.formations,
      sequence: gt.sequence,
    },
    ai,
  });
  const { ratio, estimated } = ceilingRatioFor(usable, evaluation);
  const gates = evaluateQualityGates(summaryFromEval(evaluation), ratio);
  return {
    songId: gt.songId,
    annotatorCount: new Set(usable.map((s) => s.annotatorId)).size,
    usedConsensus,
    ceilingEstimated: estimated,
    gates,
    overall: overallGateVerdict(gates),
    evaluation,
  };
}

export function runQualityGatesForSong(input: {
  sessions: AnnotationSession[];
  peaks?: number[];
  profile?: ClassProfile;
  tasteBias?: SuggestTasteBias;
  targetCueCount?: number;
}): RealSongGateReport {
  const usable = input.sessions.map(withFallbackSections);
  const first = usable[0];
  if (!first) throw new Error("注釈がありません");
  const peaks =
    input.peaks && input.peaks.length > 8
      ? downsamplePeaks(input.peaks, 512)
      : peaksFromAnnotatedSections(first.duration, first.sections);
  const engine = runEngineAppSuggest({
    peaks,
    durationSec: first.duration,
    bpm: first.bpm || 120,
    seedDancers: seedsFromSessions(usable),
    profile: input.profile ?? CLASS_ADVANCED_MON7,
    tasteBias: input.tasteBias ?? resolveSuggestTaste(),
    targetCueCount: input.targetCueCount,
  });
  if (!engine) throw new Error("エンジンがキューを作れませんでした");
  return scoreAiAgainstSessions(usable, engine.evaluation);
}

export function scoreAiAgainstProject(
  project: ChoreographyProjectJson,
  ai: AiEvaluationOutput,
  opts?: { annotatorId?: string }
): RealSongGateReport | null {
  if (project.cues.length < 1) return null;
  const session = projectToAnnotationSession(project, {
    annotatorId: opts?.annotatorId ?? "editor-current",
  });
  return scoreAiAgainstSessions([session], ai);
}
