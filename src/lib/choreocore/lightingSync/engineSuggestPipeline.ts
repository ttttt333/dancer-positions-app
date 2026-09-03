/**
 * 曲理解エンジン（Phase 1–6）でキューと隊形列を作り、
 * 照明コーパスはムード／メモの参照だけに使う。
 */

import type {
  Cue,
  DancerSpot,
  Formation as AppFormation,
} from "../../types/choreography";
import { STAGE_DEPTH_M, STAGE_WIDTH_M } from "../types";
import { generateFormationCues } from "../engine/cue/CueEngine";
import { generateFormationCandidates } from "../engine/formation/FormationCandidateGenerator";
import { DEFAULT_STAGE } from "../engine/formation/formationFixtures";
import { analyzeMusicStructure } from "../engine/music/MusicStructureAnalyzer";
import { createSyntheticPhase1Analysis } from "../engine/music/syntheticPhase1";
import { optimizeFormationSequence } from "../engine/scoring/FormationOptimizer";
import type { Formation as EngineFormation } from "../engine/types/FormationTypes";
import type { FormationStyle, StageConfig } from "../engine/types/CueTypes";
import type { CueAnalysisResult } from "../engine/types/CueTypes";
import type {
  ChangePointType,
  EventCluster,
  MusicSectionType,
  MusicStructureAnalysisResult,
} from "../engine/types/MusicTypes";
import type { AiEvaluationOutput } from "../engine/types/EvaluationTypes";
import { ANALYSIS_VERSION } from "../engine/constants";
import type { FormationSequenceResult } from "../engine/types/ScoringTypes";
import type { ClassProfile } from "./types";
import type { LightingSyncSuggestPayload } from "./types";
import { adviseLightingFromCorpus } from "./corpus";
import type { SectionType } from "./types";
import type { SuggestTasteBias } from "./suggestTaste";
import {
  DEFAULT_FORMATION_WEIGHTS,
  type FormationScore,
} from "../tier1";

const STAGE: StageConfig = DEFAULT_STAGE;

const TYPE_JA: Record<string, string> = {
  CENTER: "中央",
  LINE: "横一列",
  DOUBLE_LINE: "2列",
  V: "V字",
  WIDE_V: "広いV字",
  DIAGONAL: "斜め",
  DOUBLE_DIAGONAL: "二重斜め",
  TRIANGLE: "三角",
  DIAMOND: "ひし形",
  GRID: "グリッド",
  ARC: "弧",
  CLUSTER: "密集",
  CENTER_WINGS: "中央+ウィング",
  SPLIT: "左右割れ",
  PYRAMID: "ピラミッド",
  ARROW: "矢印",
  CUSTOM: "カスタム",
};

const ACTION_JA: Record<string, string> = {
  HOLD: "キープ",
  MICRO_SHIFT: "微調整",
  EXPAND: "広げる",
  CONTRACT: "閉じる",
  SPLIT: "割る",
  MERGE: "寄せる",
  CENTER: "中央",
  LINE: "列",
  DIAGONAL: "斜め",
  V: "V字",
  TRIANGLE: "三角",
  ARC: "弧",
  CLUSTER: "密集",
  MAJOR_CHANGE: "大転換",
};

export type EngineAppSuggestInput = {
  peaks: number[];
  durationSec: number;
  bpm: number;
  remoteChangePoints?: AppChangePoint[];
  seedDancers: DancerSpot[];
  profile: ClassProfile;
  tasteBias: SuggestTasteBias;
  targetCueCount?: number;
};

export type EngineAppSuggestResult = {
  formations: AppFormation[];
  cues: Cue[];
  reasoning: string[];
  scores: FormationScore[];
  averageScore: number;
  lightingSyncPayload: LightingSyncSuggestPayload;
  /** 品質ゲート用。本番提案と同じエンジン出力 */
  evaluation: AiEvaluationOutput;
};

export function aiEvaluationFromEngine(input: {
  bpm: number;
  structure: MusicStructureAnalysisResult;
  cueAnalysis: CueAnalysisResult;
  sequence: FormationSequenceResult;
}): AiEvaluationOutput {
  const active = input.sequence.cues.filter((c) => !c.suppressed);
  const formationRankings = input.sequence.formations.map((f, i) => ({
    cueId: active[i]?.id,
    formationType: f.type,
    score: input.sequence.candidateScores[i]?.totalScore ?? 70,
  }));
  const transitions = input.sequence.candidateScores.map((s, i) => ({
    cueId: active[i]?.id,
    formationType: input.sequence.formations[i]?.type,
    transitionScore: s.transitionQuality,
    feasible: s.feasibility >= 45,
    unsafe: s.feasibility < 40,
  }));
  return {
    bpm: input.bpm,
    cues: input.cueAnalysis.cues,
    sections: input.structure.sections,
    formationRankings,
    transitions,
    sequence: {
      formationTypes: input.sequence.formations.map((f) => f.type),
      totalScore: input.sequence.totalScore,
    },
    analysisVersion: ANALYSIS_VERSION,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function phase1FromPeaks(
  peaks: number[],
  durationSec: number,
  bpm: number
) {
  const duration = Math.max(0.5, durationSec);
  const n = Math.max(8, peaks.length);
  const hop = duration / n;
  const group = Math.max(1, Math.round(0.4 / hop));
  const segments: Array<{
    duration: number;
    energy: number;
    bass: number;
    onset: number;
    high: number;
  }> = [];
  const hits: Array<{ time: number; strength: number }> = [];
  for (let i = 0; i < n; i += group) {
    const slice = peaks.slice(i, Math.min(n, i + group));
    const avg =
      slice.length === 0
        ? 0.3
        : slice.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) /
          slice.length;
    const e = clamp(avg * 110, 4, 96);
    segments.push({
      duration: hop * slice.length,
      energy: e,
      bass: clamp(avg * 1.1, 0.02, 1),
      onset: clamp(avg * 0.85, 0.02, 1),
      high: clamp(avg * 0.45, 0.02, 1),
    });
    const mid = slice[Math.floor(slice.length / 2)] ?? 0;
    const prev = peaks[i - 1] ?? mid;
    const next = peaks[i + group] ?? mid;
    if (mid > prev && mid > next && mid > 0.45) {
      hits.push({ time: (i / n) * duration, strength: clamp(mid, 0.4, 1) });
    }
  }
  if (segments.length === 0) {
    segments.push({
      duration,
      energy: 40,
      bass: 0.2,
      onset: 0.3,
      high: 0.15,
    });
  }
  return createSyntheticPhase1Analysis({
    bpm: bpm > 0 ? bpm : 120,
    segments,
    hits: hits.slice(0, 24),
  });
}

function lightingSectionFromMusic(type: MusicSectionType | undefined): SectionType {
  if (type === "INTRO") return "intro";
  if (type === "DROP") return "drop";
  if (type === "OUTRO") return "outro";
  if (type === "CHORUS" || type === "FINAL_CHORUS" || type === "PRE_CHORUS") {
    return "chorus";
  }
  if (type === "BREAK" || type === "BRIDGE") return "se_trigger";
  return "verse";
}

function clusterTypeForRemote(cp: AppChangePoint): ChangePointType[] {
  if (cp.section_type === "DROP") return ["ENERGY_RISE"];
  if (cp.section_type === "CHORUS_START" || cp.tier === "major") {
    return ["SECTION_CHANGE", "ENERGY_RISE"];
  }
  if (cp.tier === "minor") return ["PHRASE_CHANGE"];
  return ["ENERGY_RISE"];
}

function injectRemoteClusters(
  clusters: EventCluster[],
  remote: AppChangePoint[] | undefined,
  bpm: number
): EventCluster[] {
  if (!remote?.length) return clusters;
  const out = [...clusters];
  const beat = 60 / Math.max(60, bpm);
  for (const cp of remote) {
    if (!Number.isFinite(cp.time)) continue;
    const near = out.some((c) => Math.abs(c.time - cp.time) < beat * 2);
    if (near) continue;
    const types = clusterTypeForRemote(cp);
    const energyBefore = 35;
    const energyAfter = cp.tier === "major" ? 78 : cp.tier === "medium" ? 58 : 45;
    const changePoints = types.map((type, i) => ({
      id: `fly-${type}-${Math.round(cp.time * 1000)}-${i}`,
      time: cp.time,
      rawTime: cp.time,
      beatTime: cp.time,
      barTime: Math.floor(cp.time / 2) * 2,
      barIndex: Math.floor(cp.time / 2),
      beatIndex: Math.round(cp.time / beat),
      type,
      strength: clamp((cp.score || 0.5) * 100, 40, 95),
      confidence: 0.82,
      sourceEventIds: [`fly-${Math.round(cp.time * 1000)}`],
      energyBefore,
      energyAfter,
      deltaEnergy: energyAfter - energyBefore,
      priority: cp.tier === "major" ? 85 : cp.tier === "medium" ? 60 : 40,
    }));
    out.push({
      id: `fly-ec-${Math.round(cp.time * 1000)}`,
      time: cp.time,
      changePoints,
      dominantType: types[0]!,
      totalStrength: changePoints[0]?.strength ?? 50,
      confidence: 0.82,
      isMajor: cp.tier === "major",
    });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

function capCueAnalysis(
  analysis: CueAnalysisResult,
  max: number
): CueAnalysisResult {
  const active = analysis.cues
    .filter((c) => !c.suppressed)
    .sort((a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id));
  if (active.length <= max) return analysis;
  const first = active[0]!;
  const rest = active
    .slice(1)
    .sort(
      (a, b) =>
        Number(b.isMajor) - Number(a.isMajor) ||
        b.priority - a.priority ||
        a.rawTime - b.rawTime
    );
  const keep = new Set([first.id, ...rest.slice(0, max - 1).map((c) => c.id)]);
  return {
    ...analysis,
    cues: analysis.cues.map((c) =>
      keep.has(c.id) ? c : { ...c, suppressed: true }
    ),
  };
}

function engineStyle(bias: SuggestTasteBias): FormationStyle {
  if (bias.style === "dynamic" || bias.energyWeight >= 0.35) return "DYNAMIC";
  if (bias.style === "symmetric") return "CLEAN";
  if (bias.style === "freestyle") return "ARTISTIC";
  if (bias.style === "wave") return "SHOW";
  return "SHOW";
}

function currentFromSeeds(
  seeds: DancerSpot[],
  stage: StageConfig
): EngineFormation {
  const positions: EngineFormation["positions"] = {};
  for (const d of seeds) {
    positions[d.id] = {
      x: clamp((d.xPct / 100) * stage.width, 0, stage.width),
      y: clamp((d.yPct / 100) * stage.depth, 0, stage.depth),
    };
  }
  return {
    id: "seed-current",
    type: "CUSTOM",
    positions,
    symmetry: 50,
    complexity: 40,
    stageCoverage: 45,
    visualImpact: 50,
    tags: ["seed"],
  };
}

function spotsFromEngine(
  formation: EngineFormation,
  stage: StageConfig,
  seedById: Map<string, DancerSpot>
): DancerSpot[] {
  return Object.entries(formation.positions).map(([id, point], i) => {
    const seed = seedById.get(id);
    return {
      id,
      label: seed?.label ?? String(i + 1),
      xPct: clamp((point.x / stage.width) * 100, 5, 95),
      yPct: clamp((point.y / stage.depth) * 100, 8, 92),
      colorIndex: seed?.colorIndex ?? i % 12,
      crewMemberId: seed?.crewMemberId,
      markerBadge: seed?.markerBadge,
      markerBadgeSource: seed?.markerBadgeSource,
      sizePx: seed?.sizePx,
      note: seed?.note,
      heightCm: seed?.heightCm,
    };
  });
}

/**
 * 曲理解エンジンで提案を作る。キューが取れないときは null（呼び出し側が照明連動へフォールバック）。
 */
export function runEngineAppSuggest(
  input: EngineAppSuggestInput
): EngineAppSuggestResult | null {
  const seeds = input.seedDancers;
  if (seeds.length === 0) return null;
  const duration = Math.max(0.5, input.durationSec);
  const bpm = input.bpm > 0 ? input.bpm : 120;
  const style = engineStyle(input.tasteBias);
  const maxCues = Math.max(3, Math.min(20, input.targetCueCount ?? 10));

  const phase1 = phase1FromPeaks(input.peaks, duration, bpm);
  const structure = analyzeMusicStructure(phase1);
  structure.eventClusters = injectRemoteClusters(
    structure.eventClusters,
    input.remoteChangePoints,
    bpm
  );

  const cooldown = Math.max(4, input.profile.minCountsBetweenChanges);
  let cueAnalysis = generateFormationCues(structure, phase1, {
    mediumPriorityCooldownBeats: cooldown,
    highPriorityCooldownBeats: Math.max(2, Math.round(cooldown / 2)),
    lowPriorityCooldownBeats: cooldown * 2,
    microShiftThreshold: input.profile.targetAgeGroup === "toddler" ? 48 : 35,
  });
  cueAnalysis = capCueAnalysis(cueAnalysis, maxCues);
  const active = cueAnalysis.cues.filter((c) => !c.suppressed);
  if (active.length === 0) return null;

  const current = currentFromSeeds(seeds, STAGE);
  const candidatesByCue: Record<
    string,
    ReturnType<typeof generateFormationCandidates>
  > = {};
  for (const cue of active) {
    try {
      candidatesByCue[cue.id] = generateFormationCandidates({
        dancerCount: seeds.length,
        cue,
        intent: cueAnalysis.intents[cue.id] ?? {
          primary: cue.action,
          secondary: [],
          prohibited: [],
        },
        stage: STAGE,
        style,
        currentFormation: { id: current.id, positions: current.positions },
      });
    } catch {
      candidatesByCue[cue.id] = [];
    }
  }

  const sequence = optimizeFormationSequence({
    phase1,
    musicStructure: structure,
    cueAnalysis,
    candidatesByCue,
    transitionsByCue: {},
    currentFormation: current,
    stage: STAGE,
    style,
    config: {
      beamWidth: 4,
      lookAhead: 2,
      minimumCandidateScore: 28,
      minimumFeasibility: 45,
    },
  });
  if (sequence.formations.length === 0) return null;

  const seedById = new Map(seeds.map((d) => [d.id, d] as const));
  const sortedCues = [...sequence.cues].sort((a, b) => a.rawTime - b.rawTime);
  const formations: AppFormation[] = [];
  const cues: Cue[] = [];
  const reasoning: string[] = [
    `曲理解エンジン Phase1–6 / スタイル ${style} / キュー ${sortedCues.length} / 総合 ${Math.round(sequence.totalScore)}`,
  ];
  const payloadFormations: LightingSyncSuggestPayload["formations"] = [];
  let prevLighting: ReturnType<typeof adviseLightingFromCorpus>["lightingPreset"] | undefined;
  let corpusHits = 0;

  for (let i = 0; i < sequence.formations.length; i += 1) {
    const eng = sequence.formations[i]!;
    const cue = sortedCues[i] ?? sortedCues[sortedCues.length - 1]!;
    const next = sortedCues[i + 1];
    const t = clamp(cue.rawTime, 0, duration);
    const section = structure.sections.find(
      (s) => t >= s.startTime && t < s.endTime
    );
    const lightingSection = lightingSectionFromMusic(section?.type);
    const advice = adviseLightingFromCorpus({
      progress: t / duration,
      sectionType: lightingSection,
      energyLevel: clamp(cue.energyAfter / 100, 0.1, 1),
      dancerCount: seeds.length,
      ageGroup: input.profile.targetAgeGroup,
      avoidPreset: prevLighting,
      fallbackPreset: lightingSection === "chorus" ? "full_bright_warm" : "guide_mono",
    });
    prevLighting = advice.lightingPreset;
    if (advice.preferCorpus) corpusHits += 1;

    const typeJa = TYPE_JA[eng.type] ?? eng.type;
    const actionJa = ACTION_JA[cue.action] ?? cue.action;
    const color =
      advice.colorMood && advice.colorMood !== "neutral" ? advice.colorMood : "";
    const name = [actionJa, typeJa, color].filter(Boolean).join(" · ");
    const id =
      crypto.randomUUID?.() ?? `eng-${Math.round(t * 1000)}-${i}`;
    const dancers = spotsFromEngine(eng, STAGE, seedById);
    const noteParts = [
      advice.preferCorpus ? `照明: ${advice.referenceNote}` : null,
      advice.preferCorpus && advice.referenceShowTitle
        ? `参照: ${advice.referenceShowTitle}`
        : null,
    ].filter(Boolean);

    formations.push({
      id,
      name,
      setPieces: [],
      dancers,
      note: noteParts.length ? noteParts.join(" / ") : undefined,
    });
    cues.push({
      id: crypto.randomUUID?.() ?? `cue-${id}`,
      formationId: id,
      tStartSec: t,
      tEndSec: next ? Math.max(t + 0.5, next.rawTime) : Math.min(duration, t + 8),
      name,
    });

    const mm = dancers.map((d) => ({
      memberId: d.id,
      x: (d.xPct / 100) * STAGE_WIDTH_M - STAGE_WIDTH_M / 2,
      y: (d.yPct / 100) * STAGE_DEPTH_M - STAGE_DEPTH_M / 2,
      poseLevel: "stand" as const,
    }));
    payloadFormations.push({
      fcpId: cue.id,
      timestamp: t,
      count: Math.round((t * bpm) / 60) || 1,
      presetName: name,
      lightingPreset: advice.lightingPreset,
      colorMood: advice.colorMood,
      lightingNote: advice.preferCorpus ? advice.referenceNote : undefined,
      referenceShowTitle: advice.preferCorpus
        ? advice.referenceShowTitle
        : undefined,
      positions: mm,
      formationPattern: undefined,
    });

    reasoning.push(
      `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")} ${actionJa} → ${typeJa}${
        advice.preferCorpus && advice.referenceShowTitle
          ? ` [${advice.referenceShowTitle}]`
          : ""
      }`
    );
  }

  for (let i = 0; i < cues.length - 1; i += 1) {
    if (cues[i]!.tEndSec > cues[i + 1]!.tStartSec) {
      cues[i]!.tEndSec = Math.max(cues[i]!.tStartSec + 0.5, cues[i + 1]!.tStartSec);
    }
  }

  if (corpusHits > 0) {
    reasoning.splice(
      1,
      0,
      `実演会照明プラン参照: ${corpusHits}/${formations.length} 枠（ムード・メモ）`
    );
  }

  const scores: FormationScore[] = sequence.candidateScores.map((s) => ({
    total: Math.round(clamp(s.totalScore, 0, 100)),
    axes: {
      move: Math.round(s.transitionQuality),
      safety: Math.round(s.feasibility),
      visual: Math.round(s.visualImpact),
      music: Math.round(s.musicFit),
    },
    weights: DEFAULT_FORMATION_WEIGHTS,
  }));
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, s) => a + s.total, 0) / scores.length)
      : Math.round(sequence.totalScore);

  return {
    formations,
    cues,
    reasoning,
    scores,
    averageScore,
    lightingSyncPayload: {
      classId: input.profile.classId,
      audioAnalysis: {
        bpm,
        totalCounts: Math.floor((duration * bpm) / 60),
      },
      formations: payloadFormations,
    },
    evaluation: aiEvaluationFromEngine({
      bpm,
      structure,
      cueAnalysis,
      sequence,
    }),
  };
}
