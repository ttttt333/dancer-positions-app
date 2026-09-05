/**
 * 曲理解エンジン（Phase 1–6）で「いつ変えるか」を決め、
 * 立ち位置はエディタ雛形（約200種）から載せる。
 * 照明プランコーパスは参照しない。キュー数は曲の区切り優先で指定数に合わせる。
 */

import type {
  Cue,
  DancerSpot,
  Formation as AppFormation,
} from "../../types/choreography";
import type { ChangePoint as AppChangePoint } from "../types";
import { STAGE_DEPTH_M, STAGE_WIDTH_M } from "../types";
import { generateFormationCues } from "../engine/cue/CueEngine";
import { evaluateCueQuality, type CueQualityReport } from "../engine/cue/cueQuality";
import { generateChoreographicIntentSequence } from "../engine/intent/ChoreographicIntentEngine";
import type { ChoreographicIntentSequence } from "../engine/intent/ChoreographicIntentTypes";
import { musicalEventAt, toMusicalEvents } from "../engine/music/musicalEvents";
import type { SectionFamily } from "../engine/music/sectionFamilies";
import {
  FINAL_CHORUS_SCALE,
  decideChorusCallback,
  rememberChorusLayout,
  scaleSpotsFromCenter,
  type ChorusLayoutMemory,
  type ChorusShapeMemory,
} from "../engine/formation/chorusCallback";
import {
  recommendFormationsForIntentSequence,
  type FormationIntelligenceReport,
} from "../engine/formation/intentFormationIntelligence";
import {
  resolveFormationCanaryWeights,
  scoreWeightsForSuggest,
} from "../engine/calibration/formationCanary";
import type { FormationCanaryActivation } from "../engine/calibration/formationCanaryTypes";
import {
  recommendTransitionsForFormationIntelligence,
  type TransitionIntelligenceReport,
} from "../engine/movement/transitionIntelligence";
import { DEFAULT_STAGE } from "../engine/formation/formationFixtures";
import { COMPLEXITY_BY_TYPE } from "../engine/formation/formationConfig";
import { intentMatchScore } from "../engine/formation/FormationIntentMapper";
import {
  spacingScore,
  symmetryScore,
  visualImpactScore,
  normalizedSignature,
} from "../engine/formation/FormationNormalizer";
import { stageCoverage } from "../engine/formation/FormationScaler";
import { isMusicEnginePhase12Enabled } from "../engine/audio/musicEngineFlag";
import { analyzeRealPhase2FromCache } from "../engine/music/analyzeRealPhase2FromCache";
import { analyzeMusicStructure } from "../engine/music/MusicStructureAnalyzer";
import {
  finalizeProductionTimeline,
  getLastMusicEngineTrace,
  recordMusicEngineTrace,
  timelineToMusicStructure,
  type MusicAnalysisSource,
  type Phase2FallbackReason,
  type Phase2OverwriteSite,
  type UnifiedMusicTimeline,
} from "../engine/music/productionTimeline";
import { appChangePointsFromTimeline } from "./productionChangePointAdapter";
import { createSyntheticPhase1Analysis } from "../engine/music/syntheticPhase1";
import { optimizeFormationSequence } from "../engine/scoring/FormationOptimizer";
import type {
  Formation as EngineFormation,
  FormationCandidate,
  FormationType,
} from "../engine/types/FormationTypes";
import type { FormationStyle, StageConfig } from "../engine/types/CueTypes";
import type {
  CueAnalysisResult,
  FormationCue,
  FormationCueAction,
  FormationCueIntent,
} from "../engine/types/CueTypes";
import type {
  ChangePointType,
  EventCluster,
  MusicSectionType,
  MusicStructureAnalysisResult,
} from "../engine/types/MusicTypes";
import type { MusicAnalysisResultPhase1 } from "../engine/types/AnalysisTypes";
import type { AiEvaluationOutput } from "../engine/types/EvaluationTypes";
import { ANALYSIS_VERSION } from "../engine/constants";
import type { FormationSequenceResult } from "../engine/types/ScoringTypes";
import type { ClassProfile, MemberPosition, PoseLevel } from "./types";
import type { LightingSyncSuggestPayload } from "./types";
import type { SectionType } from "./types";
import { ruleForSection } from "./lightingTable";
import type { SuggestTasteBias } from "./suggestTaste";
import {
  engineTypeForLayoutPreset,
  familyForCueAction,
  isCrossLayoutPreset,
  layoutPresetIdFromTags,
  layoutPresetLabel,
  rankLayoutPresets,
  spotsForLayoutPreset,
} from "./layoutPresetBridge";
import type { LayoutPresetId, LayoutPresetOptions } from "../../formationLayouts";
import { evaluateMoveConstraints } from "./constraintEngine";
import { resolveOverlaps } from "./overlapAvoidance";
import {
  FORMATION_TRAVEL_COUNTS,
  cueWindowsForHits,
  ensureTravelGaps,
  minHitGapSec,
  travelDurationSec,
} from "./suggestTravelTiming";
import {
  DEFAULT_FORMATION_WEIGHTS,
  type FormationScore,
} from "../tier1";
import {
  AI_SUGGEST_CUE_MAX,
  AI_SUGGEST_CUE_MIN,
  selectChangePointsForCueCount,
  type SectionAnchor,
} from "../selectChangePoints";

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
  /** Fly SSM クラスタ。無いときは MusicalEvent の family は null */
  sectionFamilies?: SectionFamily[];
  seedDancers: DancerSpot[];
  profile: ClassProfile;
  tasteBias: SuggestTasteBias;
  targetCueCount?: number;
  /** 場ミリ規格。両方あるとき雛形の間隔に使う */
  dancerSpacingMm?: number | null;
  stageWidthMm?: number | null;
  /** wave cacheKey。FLAG ON の Real Phase1 lookup に使う */
  audioCacheKey?: string | null;
  /** Canary 割当の安定キー。未指定かつ未起動なら既存 V1 経路 */
  projectKey?: string;
  /** テスト用。本番シングルトンは使わない */
  canaryActivation?: FormationCanaryActivation;
};

export type EngineAppSuggestMusicEngine = {
  analysisSource: MusicAnalysisSource;
  phase1Provenance: "real" | "synthetic";
  preservedPhase2: MusicStructureAnalysisResult | null;
  timeline?: UnifiedMusicTimeline;
  overwriteSites: Phase2OverwriteSite[];
  fallbackReason?: Phase2FallbackReason;
  cueQuality?: CueQualityReport;
  choreographicIntents?: ChoreographicIntentSequence;
  /** FLAG ON の付加情報。本番のエディタ雛形適用は置き換えない */
  formationIntelligence?: FormationIntelligenceReport;
  transitionIntelligence?: TransitionIntelligenceReport;
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
  /** FLAG ON のとき。Cue が参照する Production Timeline と同じ実体 */
  musicEngine?: EngineAppSuggestMusicEngine;
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

function layoutOptsOf(input: EngineAppSuggestInput): LayoutPresetOptions | undefined {
  const spacing = input.dancerSpacingMm;
  const width = input.stageWidthMm;
  if (
    typeof spacing === "number" &&
    Number.isFinite(spacing) &&
    spacing > 0 &&
    typeof width === "number" &&
    Number.isFinite(width) &&
    width > 0
  ) {
    return { dancerSpacingMm: spacing, stageWidthMm: width };
  }
  return undefined;
}

function allowCrossOf(profile: ClassProfile): boolean {
  return profile.allowCrossMovement && profile.targetAgeGroup !== "toddler";
}

function spotsToMembers(
  spots: DancerSpot[],
  profile: ClassProfile
): MemberPosition[] {
  return spots.map((d) => {
    const x = (d.xPct / 100) * STAGE_WIDTH_M - STAGE_WIDTH_M / 2;
    const y = (d.yPct / 100) * STAGE_DEPTH_M - STAGE_DEPTH_M / 2;
    const snap =
      profile.gridSnapMode === "integer"
        ? (v: number) => Math.round(v)
        : (v: number) => Math.round(v * 20) / 20;
    return {
      memberId: d.id,
      x: snap(clamp(x, -5.5, 5.5)),
      y: snap(clamp(y, -3.2, 3.2)),
      poseLevel: (d.poseLevel ?? "stand") as PoseLevel,
    };
  });
}

function membersToSpots(
  members: MemberPosition[],
  seeds: DancerSpot[]
): DancerSpot[] {
  const byId = new Map(members.map((m) => [m.memberId, m] as const));
  return seeds.map((seed) => {
    const m = byId.get(seed.id);
    if (!m) return { ...seed };
    return {
      ...seed,
      xPct: clamp(((m.x + STAGE_WIDTH_M / 2) / STAGE_WIDTH_M) * 100, 5, 95),
      yPct: clamp(((m.y + STAGE_DEPTH_M / 2) / STAGE_DEPTH_M) * 100, 8, 92),
      poseLevel: m.poseLevel,
    };
  });
}

function refineSpotsForClass(
  spots: DancerSpot[],
  seeds: DancerSpot[],
  prev: DancerSpot[] | null,
  profile: ClassProfile,
  availableCounts: number,
  layoutOpts: LayoutPresetOptions | undefined
): DancerSpot[] {
  let members = resolveOverlaps(spotsToMembers(spots, profile), profile);
  if (prev && prev.length > 0) {
    const prevM = spotsToMembers(prev, profile);
    const { corrected, warnings } = evaluateMoveConstraints(
      prevM,
      members,
      profile,
      availableCounts
    );
    members = corrected;
    if (
      warnings.some((w) => w.code === "CROSS_FORBIDDEN") &&
      !allowCrossOf(profile)
    ) {
      const line = spotsForLayoutPreset("line", seeds, prev, layoutOpts);
      members = resolveOverlaps(spotsToMembers(line, profile), profile);
      members = evaluateMoveConstraints(
        prevM,
        members,
        profile,
        availableCounts
      ).corrected;
    }
  }
  return membersToSpots(members, seeds);
}

function engineFormationFromSpots(
  spots: DancerSpot[],
  stage: StageConfig,
  type: FormationType,
  presetId: LayoutPresetId
): EngineFormation {
  const positions: EngineFormation["positions"] = {};
  for (const d of spots) {
    positions[d.id] = {
      x: clamp((d.xPct / 100) * stage.width, 0, stage.width),
      y: clamp((d.yPct / 100) * stage.depth, 0, stage.depth),
    };
  }
  const coverage = stageCoverage(positions, stage);
  return {
    id: `layout-${presetId}`,
    type,
    positions,
    symmetry: symmetryScore(positions, stage),
    complexity: COMPLEXITY_BY_TYPE[type] ?? 30,
    stageCoverage: coverage,
    visualImpact: visualImpactScore(coverage, undefined, type),
    tags: [`layout:${presetId}`, "editor-preset"],
  };
}

function layoutCandidatesForCue(input: {
  cue: FormationCue;
  intent: CueAnalysisResult["intents"][string];
  seeds: DancerSpot[];
  stage: StageConfig;
  section: SectionType;
  tasteBias: SuggestTasteBias;
  profile: ClassProfile;
  layoutOpts: LayoutPresetOptions | undefined;
  salt: number;
}): FormationCandidate[] {
  const n = input.seeds.length;
  const ids = rankLayoutPresets({
    family: familyForCueAction(input.cue.action, input.section),
    sectionType: input.section,
    salt: input.salt,
    dancerCount: n,
    allowCross: allowCrossOf(input.profile),
    taste: input.tasteBias,
  });
  const out: FormationCandidate[] = [];
  const seen = new Set<string>();
  for (const presetId of ids) {
    if (seen.has(presetId)) continue;
    seen.add(presetId);
    if (!allowCrossOf(input.profile) && isCrossLayoutPreset(presetId)) continue;
    const spots = spotsForLayoutPreset(
      presetId,
      input.seeds,
      input.seeds,
      input.layoutOpts
    );
    if (spots.length !== n) continue;
    const type = engineTypeForLayoutPreset(presetId);
    const formation = engineFormationFromSpots(
      spots,
      input.stage,
      type,
      presetId
    );
    const intentMatch = intentMatchScore(type, input.intent);
    const spacingPreview = spacingScore(
      formation.positions,
      input.stage.minDancerDistance
    );
    const scores = {
      intentMatch,
      dancerCountFit: 100,
      stageFit: 80,
      spacingPreview,
      visualImpact: formation.visualImpact,
      symmetry: formation.symmetry,
      complexity: formation.complexity,
    };
    const preliminary =
      scores.intentMatch * 0.3 +
      scores.dancerCountFit * 0.2 +
      scores.stageFit * 0.2 +
      scores.spacingPreview * 0.1 +
      scores.visualImpact * 0.1 +
      scores.symmetry * 0.05 +
      scores.complexity * 0.05;
    out.push({
      id: `cand-layout-${presetId}-${input.cue.id}`,
      formation,
      templateId: presetId,
      stageCoverage: formation.stageCoverage,
      ...scores,
      rejected: false,
      rejectionReasons: [],
      metadata: {
        generatedFromCueId: input.cue.id,
        generationStrategy: "editor-layout-preset",
        preliminaryScore: preliminary,
        signature: normalizedSignature(type, formation.positions, input.stage),
      },
    });
  }
  return out;
}

const MIN_MEAN_TRAVEL_PCT = 7;

function meanTravelPct(a: DancerSpot[], b: DancerSpot[]): number {
  const byId = new Map(b.map((d) => [d.id, d] as const));
  let sum = 0;
  let n = 0;
  for (const p of a) {
    const q = byId.get(p.id);
    if (!q) continue;
    sum += Math.hypot(p.xPct - q.xPct, p.yPct - q.yPct);
    n += 1;
  }
  return n > 0 ? sum / n : 0;
}

function isSongChangeCue(
  cue: FormationCue,
  remote: AppChangePoint[] | undefined
): boolean {
  if (cue.isMajor || cue.action === "MAJOR_CHANGE") return true;
  if (cue.reasonCodes.includes("SECTION_CHANGE")) return true;
  return Boolean(
    remote?.some(
      (cp) =>
        Math.abs(cp.time - cue.rawTime) < 2 &&
        (cp.tier === "major" ||
          cp.section_type === "CHORUS_START" ||
          cp.section_type === "CHORUS" ||
          cp.section_type === "PRE_CHORUS" ||
          cp.section_type === "DROP" ||
          cp.section_type === "OUTRO")
    )
  );
}

function uniqueReasons(codes: string[]): string[] {
  return codes.filter((code, i) => codes.indexOf(code) === i);
}

function isPreChorusCue(
  cue: FormationCue,
  remote: AppChangePoint[] | undefined
): boolean {
  if (
    cue.reasonCodes.includes("PRE_CHORUS") ||
    cue.reasonCodes.includes("SECTION_PRE_CHORUS") ||
    cue.reasonCodes.includes("TENSION_CONTRACT")
  ) {
    return true;
  }
  if (cue.reasonCodes.some((r) => r.endsWith("_TO_PRE_CHORUS"))) return true;
  const near = remote?.find((cp) => Math.abs(cp.time - cue.rawTime) < 2);
  return near?.section_type === "PRE_CHORUS";
}

function promoteCuesAtSongChanges(
  analysis: CueAnalysisResult,
  remote: AppChangePoint[] | undefined
): CueAnalysisResult {
  const intents: Record<string, FormationCueIntent> = { ...analysis.intents };
  const cues = analysis.cues.map((c) => {
    if (c.suppressed) return c;
    if (isPreChorusCue(c, remote)) {
      intents[c.id] = {
        primary: "CONTRACT",
        secondary: ["CLUSTER", "CENTER"],
        prohibited: ["EXPAND", "V"],
      };
      return {
        ...c,
        action: "CONTRACT" as const,
        isMajor: true,
        reasonCodes: uniqueReasons([
          ...c.reasonCodes,
          "PROMOTED_VERSE_END",
          "TENSION_CONTRACT",
        ]),
      };
    }
    if (!isSongChangeCue(c, remote)) return c;
    if (c.action !== "HOLD" && c.action !== "MICRO_SHIFT") return c;
    intents[c.id] = {
      primary: "MAJOR_CHANGE",
      secondary: ["EXPAND", "V"],
      prohibited: ["HOLD"],
    };
    return {
      ...c,
      action: "MAJOR_CHANGE" as const,
      isMajor: true,
      reasonCodes: uniqueReasons([...c.reasonCodes, "PROMOTED_SECTION_CHANGE"]),
    };
  });
  return { ...analysis, cues, intents };
}

function isTrueHold(cue: FormationCue): boolean {
  return (
    cue.action === "HOLD" &&
    !cue.isMajor &&
    !cue.reasonCodes.includes("SECTION_CHANGE") &&
    !cue.reasonCodes.includes("PROMOTED_SECTION_CHANGE") &&
    !cue.reasonCodes.includes("PROMOTED_VERSE_END") &&
    !cue.reasonCodes.includes("TENSION_CONTRACT")
  );
}

function resolveDistinctLayoutSpots(input: {
  preferred: LayoutPresetId | null;
  seeds: DancerSpot[];
  prevSpots: DancerSpot[];
  cue: FormationCue;
  section: SectionType;
  tasteBias: SuggestTasteBias;
  profile: ClassProfile;
  layoutOpts: LayoutPresetOptions | undefined;
  recent: LayoutPresetId[];
  salt: number;
  lockLayoutId?: LayoutPresetId | null;
  scaleMax?: boolean;
}): { layoutId: LayoutPresetId | null; dancers: DancerSpot[] } {
  if (input.lockLayoutId) {
    const raw = spotsForLayoutPreset(
      input.lockLayoutId,
      input.seeds,
      input.prevSpots,
      input.layoutOpts
    );
    let dancers = refineSpotsForClass(
      raw,
      input.seeds,
      input.prevSpots,
      input.profile,
      FORMATION_TRAVEL_COUNTS,
      input.layoutOpts
    );
    if (input.scaleMax) dancers = scaleSpotsFromCenter(dancers, FINAL_CHORUS_SCALE);
    return { layoutId: input.lockLayoutId, dancers };
  }
  const ranked = rankLayoutPresets(
    {
      family: familyForCueAction(input.cue.action, input.section),
      sectionType: input.section,
      salt: input.salt,
      dancerCount: input.seeds.length,
      allowCross: allowCrossOf(input.profile),
      taste: input.tasteBias,
      recent: input.recent,
    },
    8
  );
  const ordered = input.preferred
    ? [input.preferred, ...ranked.filter((id) => id !== input.preferred)]
    : ranked;

  let fallback: { layoutId: LayoutPresetId; dancers: DancerSpot[] } | null =
    null;
  for (const pass of [0, 1] as const) {
    for (const id of ordered) {
      if (pass === 0 && input.recent.includes(id)) continue;
      if (!allowCrossOf(input.profile) && isCrossLayoutPreset(id)) continue;
      if (/^extra_/.test(id) && input.tasteBias.style !== "freestyle") continue;
      if (
        input.tasteBias.style !== "freestyle" &&
        /pinwheel|heart|spiral|scatter/.test(id)
      ) {
        continue;
      }
      const raw = spotsForLayoutPreset(
        id,
        input.seeds,
        input.prevSpots,
        input.layoutOpts
      );
      const dancers = refineSpotsForClass(
        raw,
        input.seeds,
        input.prevSpots,
        input.profile,
        FORMATION_TRAVEL_COUNTS,
        input.layoutOpts
      );
      if (!fallback) fallback = { layoutId: id, dancers };
      if (meanTravelPct(input.prevSpots, dancers) >= MIN_MEAN_TRAVEL_PCT) {
        return { layoutId: id, dancers };
      }
    }
  }
  return (
    fallback ?? {
      layoutId: null,
      dancers: input.prevSpots.map((s) => ({ ...s })),
    }
  );
}

/**
 * Legacy Compatibility Path。Real Phase 1 ではない。
 * peaks の平均を energy / bass / onset / high に複製するだけ。
 */
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
  if (type === "CHORUS" || type === "FINAL_CHORUS") return "chorus";
  if (
    type === "PRE_CHORUS" ||
    type === "BREAK" ||
    type === "BRIDGE"
  ) {
    return "se_trigger";
  }
  return "verse";
}

function musicSectionTypeFromCp(
  cp: AppChangePoint
): MusicSectionType {
  if (cp.section_type === "INTRO") return "INTRO";
  if (cp.section_type === "CHORUS_START" || cp.section_type === "CHORUS") {
    return "CHORUS";
  }
  if (cp.section_type === "DROP") return "DROP";
  if (cp.section_type === "OUTRO") return "OUTRO";
  if (cp.section_type === "PRE_CHORUS" || cp.section_type === "SE_TRIGGER") {
    return "PRE_CHORUS";
  }
  return "VERSE";
}

function overlaySectionsFromChangePoints(
  structure: MusicStructureAnalysisResult,
  remote: AppChangePoint[] | undefined,
  duration: number,
  bpm: number
): void {
  // Stage 3: Real Phase2 sections をここで全置換しない。
  if (!remote?.length) return;
  const sorted = [...remote]
    .filter((cp) => Number.isFinite(cp.time))
    .sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return;
  const bar = 8 * (60 / Math.max(1, bpm));
  const emptyProfile = {
    bass: 0.3,
    lowMid: 0.2,
    mid: 0.2,
    highMid: 0.15,
    high: 0.15,
  };
  const sections: MusicStructureAnalysisResult["sections"] = [];
  const push = (
    type: MusicSectionType,
    startTime: number,
    endTime: number,
    energy: number
  ) => {
    if (endTime <= startTime + 0.2) return;
    sections.push({
      id: `sec-${type}-${Math.round(startTime * 1000)}`,
      type,
      startTime,
      endTime,
      startBar: Math.floor(startTime / bar),
      endBar: Math.floor(endTime / bar),
      barCount: Math.max(1, Math.round((endTime - startTime) / bar)),
      energyMean: energy,
      energyPeak: Math.min(100, energy + 10),
      energyDelta: 8,
      rhythmicDensity: 0.5,
      spectralProfile: emptyProfile,
      confidence: 0.86,
    });
  };
  const first = sorted[0]!;
  if (first.time > 0.8) {
    push("INTRO", 0, first.time, 32);
  }
  for (let i = 0; i < sorted.length; i += 1) {
    const cp = sorted[i]!;
    const end = sorted[i + 1]?.time ?? duration;
    const energy =
      cp.tier === "major" ? 78 : cp.tier === "medium" ? 58 : 42;
    push(musicSectionTypeFromCp(cp), cp.time, end, energy);
  }
  if (sections.length > 0) structure.sections = sections;
}

function inferredRemoteSection(cp: AppChangePoint): string {
  if (cp.section_type) return cp.section_type;
  if (cp.tier === "major") return "CHORUS_START";
  return "VERSE";
}

/** 旧解析（4エイトごと）が来ても、サビ頭・A終わり・サビ後Aに間引く */
function thinStructuralChangePoints(
  remote: AppChangePoint[] | undefined
): AppChangePoint[] | undefined {
  if (!remote?.length) return remote;
  const sorted = [...remote]
    .filter((cp) => Number.isFinite(cp.time))
    .sort((a, b) => a.time - b.time);
  const out: AppChangePoint[] = [];
  let prev: string | undefined;
  for (const cp of sorted) {
    const st = inferredRemoteSection(cp);
    if (st === "PRE_CHORUS") {
      out.push(cp);
      prev = st;
      continue;
    }
    if (st === "CHORUS_START" || st === "DROP") {
      out.push(cp);
      prev = st;
      continue;
    }
    if (st === "OUTRO") {
      if (prev !== "OUTRO") {
        out.push(cp);
        prev = st;
      }
      continue;
    }
    if (st === "CHORUS") {
      const last = out[out.length - 1];
      if (last && cp.time - last.time < 20) continue;
      out.push(cp);
      prev = st;
      continue;
    }
    if (st === "VERSE" || st === "SE_TRIGGER") {
      if (
        prev === "CHORUS" ||
        prev === "CHORUS_START" ||
        prev === "DROP"
      ) {
        out.push(cp);
        prev = "VERSE";
      }
      continue;
    }
    if (cp.tier === "major") {
      out.push(cp);
      prev = st;
    }
  }
  return out.length > 0 ? out : sorted.slice(0, 8);
}

function clusterTypeForRemote(cp: AppChangePoint): ChangePointType[] {
  const st = inferredRemoteSection(cp);
  if (st === "PRE_CHORUS") return ["ENERGY_RISE"];
  if (st === "DROP" || st === "CHORUS_START" || st === "CHORUS") {
    return ["SECTION_CHANGE", "ENERGY_RISE"];
  }
  if (st === "OUTRO" || st === "VERSE") return ["SECTION_CHANGE"];
  if (cp.tier === "minor") return ["PHRASE_CHANGE"];
  if (cp.tier === "major") return ["SECTION_CHANGE", "ENERGY_RISE"];
  return ["ENERGY_RISE"];
}

function clusterFromRemote(
  cp: AppChangePoint,
  bpm: number,
  extraTypes?: ChangePointType[]
): EventCluster {
  const beat = 60 / Math.max(60, bpm);
  const types = extraTypes ?? clusterTypeForRemote(cp);
  const energyBefore = 35;
  const energyAfter =
    cp.tier === "major" ? 78 : cp.tier === "medium" ? 58 : 45;
  const st = inferredRemoteSection(cp);
  const isMajor =
    st === "CHORUS_START" ||
    st === "CHORUS" ||
    st === "DROP" ||
    (cp.tier === "major" && st !== "PRE_CHORUS");
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
    priority: isMajor ? 85 : cp.tier === "medium" ? 60 : 40,
  }));
  return {
    id: `fly-ec-${Math.round(cp.time * 1000)}`,
    time: cp.time,
    changePoints,
    dominantType: types[0]!,
    totalStrength: changePoints[0]?.strength ?? 50,
    confidence: 0.82,
    isMajor,
  };
}

function clustersFromRemoteChangePoints(
  remote: AppChangePoint[] | undefined,
  bpm: number
): EventCluster[] {
  // Stage 3: Real Phase2 eventClusters をここで全置換しない。
  const thinned = thinStructuralChangePoints(remote) ?? [];
  const out: EventCluster[] = [];
  const hasEarly = thinned.some((cp) => cp.time < 2);
  if (!hasEarly) {
    out.push(
      clusterFromRemote(
        {
          eight_index: 0,
          time: 0,
          score: 0.35,
          tier: "minor",
          section_type: "INTRO",
        },
        bpm,
        ["PHRASE_CHANGE"]
      )
    );
  }
  for (const cp of thinned) {
    if (!Number.isFinite(cp.time) || cp.time < 0.35) continue;
    out.push(clusterFromRemote(cp, bpm));
  }
  return out.sort((a, b) => a.time - b.time);
}

function sectionAnchorsFromRemote(
  remote: AppChangePoint[] | undefined,
  duration: number
): SectionAnchor[] {
  if (!remote?.length) return [];
  const sorted = [...remote]
    .filter((cp) => Number.isFinite(cp.time) && cp.time >= 0)
    .sort((a, b) => a.time - b.time);
  const out: SectionAnchor[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const cp = sorted[i]!;
    if (cp.time < 1.5) continue;
    const next = sorted[i + 1];
    out.push({
      startSec: cp.time,
      endSec: next?.time ?? duration,
      avgEnergy:
        cp.tier === "major" ? 0.85 : cp.tier === "medium" ? 0.55 : 0.35,
      label: cp.section_type,
    });
  }
  return out;
}

function cueStructureScore(
  cue: FormationCue,
  remote: AppChangePoint[] | undefined
): number {
  let score = cue.priority + (cue.isMajor ? 40 : 0);
  if (
    cue.reasonCodes.includes("TENSION_CONTRACT") ||
    cue.reasonCodes.includes("PROMOTED_VERSE_END")
  ) {
    score += 45;
  }
  if (cue.reasonCodes.includes("PROMOTED_SECTION_CHANGE")) score += 35;
  if (cue.reasonCodes.includes("INJECTED_STRUCTURE")) score += 30;
  const near = remote?.find((cp) => Math.abs(cp.time - cue.rawTime) < 2.5);
  if (!near?.section_type) return score;
  if (near.section_type === "CHORUS_START" || near.section_type === "DROP") {
    score += 50;
  } else if (near.section_type === "PRE_CHORUS") {
    score += 48;
  } else if (near.section_type === "OUTRO") {
    score += 28;
  } else if (near.section_type === "CHORUS") {
    score += 22;
  }
  return score;
}

function syntheticCueAt(
  time: number,
  bpm: number,
  cp: AppChangePoint | undefined,
  index: number
): { cue: FormationCue; intent: FormationCueIntent } {
  const st = cp?.section_type ?? (cp ? inferredRemoteSection(cp) : undefined);
  let action: FormationCueAction = "MAJOR_CHANGE";
  let intent: FormationCueIntent = {
    primary: "MAJOR_CHANGE",
    secondary: ["EXPAND", "V"],
    prohibited: ["HOLD"],
  };
  const reasonCodes = ["INJECTED_STRUCTURE", "TARGET_CUE_FILL"];
  if (st === "PRE_CHORUS") {
    action = "CONTRACT";
    intent = {
      primary: "CONTRACT",
      secondary: ["CLUSTER", "CENTER"],
      prohibited: ["EXPAND", "V"],
    };
    reasonCodes.push("TENSION_CONTRACT", "PROMOTED_VERSE_END", "PRE_CHORUS");
  } else if (st === "OUTRO") {
    action = "CONTRACT";
    intent = {
      primary: "CONTRACT",
      secondary: ["CENTER"],
      prohibited: [],
    };
    reasonCodes.push("SECTION_CHANGE", "OUTRO");
  } else if (st === "CHORUS_START" || st === "DROP" || st === "CHORUS") {
    reasonCodes.push("PROMOTED_SECTION_CHANGE", st);
  } else {
    reasonCodes.push("SECTION_CHANGE");
  }
  const id = `synth-cue-${Math.round(time * 1000)}-${index}`;
  const energyAfter =
    st === "PRE_CHORUS" ? 58 : st === "OUTRO" ? 40 : st === "DROP" ? 88 : 76;
  return {
    cue: {
      id,
      rawTime: time,
      beatTime: time,
      barTime: Math.floor(time / 2) * 2,
      action,
      magnitude: action === "CONTRACT" ? "MEDIUM" : "LARGE",
      priority: st === "PRE_CHORUS" || st === "CHORUS_START" || st === "DROP" ? 92 : 72,
      confidence: 0.78,
      reasonCodes,
      sourceEventClusterId: `synth-ec-${id}`,
      sourceChangePointIds: [],
      energyBefore: 42,
      energyAfter,
      deltaEnergy: energyAfter - 42,
      isMajor: true,
      isLocked: false,
      suppressed: false,
    },
    intent,
  };
}

/**
 * 指定キュー数に合わせて、曲の区切りを優先して選定・不足分を補完する。
 * 移動に必要な最短間隔も守る。
 */
function selectCuesForTargetCount(
  analysis: CueAnalysisResult,
  targetCount: number,
  bpm: number,
  duration: number,
  remote: AppChangePoint[] | undefined
): CueAnalysisResult {
  const target = Math.max(
    AI_SUGGEST_CUE_MIN,
    Math.min(AI_SUGGEST_CUE_MAX, targetCount)
  );
  const minGap = minHitGapSec(bpm);
  /** 曲全体に散らすための目安間隔（移動最短より広め） */
  const spreadGap = Math.max(minGap, (duration / Math.max(target, 1)) * 0.55);
  const active = analysis.cues
    .filter((c) => !c.suppressed)
    .sort((a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id));

  const intents: Record<string, FormationCueIntent> = { ...analysis.intents };
  const picked: FormationCue[] = [];
  const used = new Set<string>();
  let synthIndex = 0;

  const fitsGap = (time: number, gap = spreadGap): boolean =>
    !picked.some((p) => Math.abs(p.rawTime - time) < gap - 1e-6);

  const takeCue = (cue: FormationCue, gap = spreadGap): boolean => {
    if (used.has(cue.id) || picked.length >= target) return false;
    if (!fitsGap(cue.rawTime, gap)) return false;
    picked.push(cue);
    used.add(cue.id);
    return true;
  };

  const takeSynthetic = (
    time: number,
    cp?: AppChangePoint,
    gap = spreadGap
  ): boolean => {
    if (picked.length >= target || time < 0 || time > duration - 0.4) return false;
    if (!fitsGap(time, gap)) return false;
    const syn = syntheticCueAt(time, bpm, cp, synthIndex++);
    intents[syn.cue.id] = syn.intent;
    picked.push(syn.cue);
    used.add(syn.cue.id);
    return true;
  };

  const startCue =
    active.find((c) => c.rawTime < 1.5) ??
    active[0] ??
    null;
  if (startCue) {
    picked.push({ ...startCue, suppressed: false });
    used.add(startCue.id);
  } else {
    takeSynthetic(0, undefined, 0);
  }

  /** 曲の骨格（Bメロ終わり・サビ頭など）を先に確保 */
  const structuralPriority = (st: AppChangePoint["section_type"] | undefined) => {
    if (st === "CHORUS_START" || st === "DROP") return 5;
    if (st === "PRE_CHORUS") return 4;
    if (st === "OUTRO") return 3;
    if (st === "CHORUS") return 2;
    return 0;
  };
  const structuralRemote = [...(remote ?? [])]
    .filter((cp) => structuralPriority(cp.section_type) > 0 && cp.time >= 2)
    .sort(
      (a, b) =>
        structuralPriority(b.section_type) - structuralPriority(a.section_type) ||
        a.time - b.time
    );
  for (const cp of structuralRemote) {
    if (picked.length >= target) break;
    let best: FormationCue | null = null;
    let bestDist = Infinity;
    for (const cue of active) {
      if (used.has(cue.id)) continue;
      const dist = Math.abs(cue.rawTime - cp.time);
      if (dist < bestDist && dist <= 3.5) {
        best = cue;
        bestDist = dist;
      }
    }
    if (best && takeCue(best, minGap)) continue;
    takeSynthetic(cp.time, cp, minGap);
  }

  const noveltyPoints = active
    .filter((c) => c.rawTime >= 2)
    .map((c) => ({
      eight_index: Math.max(0, Math.round(c.rawTime / 4)),
      time: c.rawTime,
      score: Math.min(1, c.priority / 100),
      tier: (c.isMajor
        ? "major"
        : c.priority >= 50
          ? "medium"
          : "minor") as AppChangePoint["tier"],
      section_type: remote?.find((cp) => Math.abs(cp.time - c.rawTime) < 2)
        ?.section_type,
    }));
  const remotePoints = (remote ?? []).filter((cp) => cp.time >= 2);
  const selectedTimes = selectChangePointsForCueCount(
    [...remotePoints, ...noveltyPoints],
    target,
    duration,
    sectionAnchorsFromRemote(remote, duration)
  );

  for (const point of selectedTimes) {
    if (picked.length >= target) break;
    let best: FormationCue | null = null;
    let bestDist = Infinity;
    for (const cue of active) {
      if (used.has(cue.id)) continue;
      const dist = Math.abs(cue.rawTime - point.time);
      if (dist < bestDist && dist <= 3.5) {
        best = cue;
        bestDist = dist;
      }
    }
    if (best && takeCue(best)) continue;
    const cp =
      remote?.find((r) => Math.abs(r.time - point.time) < 1.5) ??
      ({
        eight_index: point.eight_index,
        time: point.time,
        score: point.score,
        tier: point.tier,
        section_type: point.section_type,
      } satisfies AppChangePoint);
    takeSynthetic(point.time, cp);
  }

  const ranked = [...active]
    .filter((c) => !used.has(c.id))
    .sort(
      (a, b) =>
        cueStructureScore(b, remote) - cueStructureScore(a, remote) ||
        a.rawTime - b.rawTime
    );
  for (const gap of [spreadGap, minGap, minGap * 0.75, minGap * 0.5]) {
    for (const cue of ranked) {
      if (picked.length >= target) break;
      if (used.has(cue.id)) continue;
      if (!fitsGap(cue.rawTime, gap)) continue;
      picked.push(cue);
      used.add(cue.id);
    }
    if (picked.length >= target) break;
  }

  if (picked.length < target) {
    const need = target - picked.length;
    for (let i = 1; i <= need + 8 && picked.length < target; i += 1) {
      const t = (duration / (need + 1)) * i;
      takeSynthetic(Math.min(duration - 1, Math.max(2, t)), undefined, minGap * 0.5);
    }
  }

  picked.sort((a, b) => a.rawTime - b.rawTime);
  const keep = new Set(picked.slice(0, target).map((c) => c.id));
  const existingIds = new Set(analysis.cues.map((c) => c.id));
  const extras = picked.filter((c) => keep.has(c.id) && !existingIds.has(c.id));

  return {
    ...analysis,
    intents,
    cues: [
      ...analysis.cues.map((c) =>
        keep.has(c.id)
          ? { ...c, suppressed: false }
          : { ...c, suppressed: true }
      ),
      ...extras,
    ],
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

/**
 * 曲理解エンジンで提案を作る。キューが取れないときは null（呼び出し側が照明連動へフォールバック）。
 * 隊形の中身はエンジンテンプレではなく、エディタ雛形 + 近い位置での人の引き継ぎ。
 */
function applyRemoteProductionOverwrite(
  structure: MusicStructureAnalysisResult,
  remote: AppChangePoint[] | undefined,
  duration: number,
  bpm: number
): {
  structuralCps: AppChangePoint[] | undefined;
  overwriteSites: Phase2OverwriteSite[];
} {
  const overwriteSites: Phase2OverwriteSite[] = [];
  const sectionsBefore = structure.sections;
  const clustersBefore = structure.eventClusters;
  const structuralCps = thinStructuralChangePoints(remote);
  overlaySectionsFromChangePoints(structure, structuralCps, duration, bpm);
  if (structure.sections !== sectionsBefore) {
    overwriteSites.push("overlaySectionsFromChangePoints");
  }
  if (structuralCps?.length) {
    structure.eventClusters = clustersFromRemoteChangePoints(structuralCps, bpm);
    if (structure.eventClusters !== clustersBefore) {
      overwriteSites.push("clustersFromRemoteChangePoints");
    }
  }
  return { structuralCps, overwriteSites };
}

export function runEngineAppSuggest(
  input: EngineAppSuggestInput
): EngineAppSuggestResult | null {
  const seeds = input.seedDancers;
  if (seeds.length === 0) return null;
  const duration = Math.max(0.5, input.durationSec);
  const bpm = input.bpm > 0 ? input.bpm : 120;
  const style = engineStyle(input.tasteBias);
  const maxCues = Math.max(
    AI_SUGGEST_CUE_MIN,
    Math.min(AI_SUGGEST_CUE_MAX, input.targetCueCount ?? 10)
  );

  let phase1: MusicAnalysisResultPhase1;
  let structure: MusicStructureAnalysisResult;
  let musicEngine: EngineAppSuggestMusicEngine | undefined;
  let skipRemoteOverwrite = false;
  let structuralCpsFromTimeline: AppChangePoint[] | undefined;

  if (isMusicEnginePhase12Enabled()) {
    const real = analyzeRealPhase2FromCache({
      cacheKey: input.audioCacheKey,
    });
    if (real.ok) {
      const finalized = finalizeProductionTimeline(real.timeline, {
        bpm,
        duration,
      });
      if (finalized.ok) {
        phase1 = real.phase1;
        structure = timelineToMusicStructure(finalized.timeline);
        skipRemoteOverwrite = true;
        structuralCpsFromTimeline = appChangePointsFromTimeline(
          finalized.timeline,
          bpm
        );
        musicEngine = {
          analysisSource: "engine-phase12",
          phase1Provenance: "real",
          preservedPhase2: structure,
          timeline: finalized.timeline,
          overwriteSites: [],
        };
        const prev = getLastMusicEngineTrace();
        if (prev) {
          recordMusicEngineTrace({
            ...prev,
            phase2OverwriteSites: [],
            changePointCount: finalized.timeline.changePoints.length,
          });
        }
      } else {
        phase1 = phase1FromPeaks(input.peaks, duration, bpm);
        structure = analyzeMusicStructure(phase1);
        musicEngine = {
          analysisSource: "synthetic-legacy",
          phase1Provenance: "synthetic",
          preservedPhase2: null,
          overwriteSites: [],
          fallbackReason: finalized.reason,
        };
      }
    } else {
      phase1 = phase1FromPeaks(input.peaks, duration, bpm);
      structure = analyzeMusicStructure(phase1);
      musicEngine = {
        analysisSource: "synthetic-legacy",
        phase1Provenance: "synthetic",
        preservedPhase2: null,
        overwriteSites: [],
        fallbackReason: real.fallbackReason,
      };
    }
  } else {
    phase1 = phase1FromPeaks(input.peaks, duration, bpm);
    structure = analyzeMusicStructure(phase1);
  }

  let structuralCps = structuralCpsFromTimeline;
  if (!skipRemoteOverwrite) {
    const applied = applyRemoteProductionOverwrite(
      structure,
      input.remoteChangePoints,
      duration,
      bpm
    );
    structuralCps = applied.structuralCps;
    if (musicEngine) {
      musicEngine = {
        ...musicEngine,
        overwriteSites: applied.overwriteSites,
      };
    }
  }

  return finishEngineAppSuggest({
    input,
    seeds,
    duration,
    bpm,
    style,
    maxCues,
    phase1,
    structure,
    structuralCps,
    musicEngine,
  });
}

function finishEngineAppSuggest(args: {
  input: EngineAppSuggestInput;
  seeds: DancerSpot[];
  duration: number;
  bpm: number;
  style: FormationStyle;
  maxCues: number;
  phase1: MusicAnalysisResultPhase1;
  structure: MusicStructureAnalysisResult;
  structuralCps: AppChangePoint[] | undefined;
  musicEngine?: EngineAppSuggestMusicEngine;
}): EngineAppSuggestResult | null {
  const {
    input,
    seeds,
    duration,
    bpm,
    style,
    maxCues,
    phase1,
    structure,
    structuralCps,
    musicEngine,
  } = args;
  const cooldown = Math.max(4, input.profile.minCountsBetweenChanges);
  let cueAnalysis = generateFormationCues(structure, phase1, {
    mediumPriorityCooldownBeats: cooldown,
    highPriorityCooldownBeats: Math.max(2, Math.round(cooldown / 2)),
    lowPriorityCooldownBeats: cooldown * 2,
    microShiftThreshold: input.profile.targetAgeGroup === "toddler" ? 48 : 35,
  });
  cueAnalysis = promoteCuesAtSongChanges(cueAnalysis, structuralCps);
  cueAnalysis = selectCuesForTargetCount(
    cueAnalysis,
    maxCues,
    bpm,
    duration,
    structuralCps
  );
  const musicalEvents = toMusicalEvents({
    structure,
    bpm,
    durationSec: duration,
    sectionFamilies: input.sectionFamilies,
  });
  if (musicEngine?.timeline) {
    musicEngine.cueQuality = evaluateCueQuality({
      analysis: cueAnalysis,
      sections: musicEngine.timeline.sections,
      eventClusters: musicEngine.timeline.eventClusters,
      bpm,
      source: musicEngine.analysisSource,
    });
    try {
      musicEngine.choreographicIntents = generateChoreographicIntentSequence({
        analysis: cueAnalysis,
        eventClusters: musicEngine.timeline.eventClusters,
        sections: musicEngine.timeline.sections,
        durationSec: duration,
        musicalEvents,
      });
    } catch {
      /* Intent は付加情報。失敗しても Cue 経路は維持 */
    }
  }
  const active = cueAnalysis.cues.filter((c) => !c.suppressed);
  if (active.length === 0) return null;

  const current = currentFromSeeds(seeds, STAGE);
  if (musicEngine?.choreographicIntents) {
    const canary = resolveFormationCanaryWeights({
      projectKey: input.projectKey ?? input.audioCacheKey ?? "unknown-project",
      activation: input.canaryActivation,
    });
    const scoreWeights = scoreWeightsForSuggest(canary);
    const sequenceInput = {
      intents: musicEngine.choreographicIntents.intents,
      cues: cueAnalysis.cues,
      currentFormation: current,
      dancerCount: seeds.length,
      stage: STAGE,
      bpm,
    };
    try {
      musicEngine.formationIntelligence = recommendFormationsForIntentSequence({
        ...sequenceInput,
        scoreWeights,
      });
    } catch {
      try {
        musicEngine.formationIntelligence = recommendFormationsForIntentSequence(sequenceInput);
      } catch {
        /* Formation Intelligence は付加。既存雛形経路は維持 */
      }
    }
    if (musicEngine.formationIntelligence) {
      try {
        musicEngine.transitionIntelligence = recommendTransitionsForFormationIntelligence({
          report: musicEngine.formationIntelligence,
          currentFormation: current,
          cues: cueAnalysis.cues,
          stage: STAGE,
          bpm,
        });
      } catch {
        /* Transition Intelligence は付加。既存移動・雛形経路は維持 */
      }
    }
  }
  const layoutOpts = layoutOptsOf(input);
  const candidatesByCue: Record<string, FormationCandidate[]> = {};
  for (let i = 0; i < active.length; i += 1) {
    const cue = active[i]!;
    const section = structure.sections.find(
      (s) => cue.rawTime >= s.startTime && cue.rawTime < s.endTime
    );
    const lightingSection = lightingSectionFromMusic(section?.type);
    try {
      candidatesByCue[cue.id] = layoutCandidatesForCue({
        cue,
        intent: cueAnalysis.intents[cue.id] ?? {
          primary: cue.action,
          secondary: [],
          prohibited: [],
        },
        seeds,
        stage: STAGE,
        section: lightingSection,
        tasteBias: input.tasteBias,
        profile: input.profile,
        layoutOpts,
        salt: i + Math.round(cue.energyAfter),
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
      minimumCandidateScore: 20,
      minimumFeasibility: 35,
    },
  });
  if (sequence.formations.length === 0) return null;

  const sortedCues = [...sequence.cues].sort((a, b) => a.rawTime - b.rawTime);
  const hitTimes = sortedCues.map((c) => clamp(c.rawTime, 0, duration));
  const windows = cueWindowsForHits(hitTimes, duration, bpm);
  const travelSec = travelDurationSec(bpm);
  const formations: AppFormation[] = [];
  const cues: Cue[] = [];
  const structureLabels = (structuralCps ?? [])
    .map((cp) => cp.section_type)
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const reasoning: string[] = [
    `曲理解エンジン Phase1–6 / エディタ雛形 / スタイル ${style} / キュー ${sortedCues.length}（指定 ${maxCues}） / 総合 ${Math.round(sequence.totalScore)}`,
    `移動は変化の ${FORMATION_TRAVEL_COUNTS} カウント前から（約 ${travelSec.toFixed(1)} 秒）`,
    structureLabels.length
      ? `曲の区切り: ${structureLabels.join(" → ")}（Aメロ終わり=PRE_CHORUS、サビ頭=CHORUS_START）`
      : "曲の区切り: 波形ピークから推定",
  ];
  const payloadFormations: LightingSyncSuggestPayload["formations"] = [];
  let prevSpots: DancerSpot[] = seeds;
  const recentLayouts: LayoutPresetId[] = [];
  const chorusLayoutMemory: ChorusLayoutMemory = new Map();
  const chorusShapeMemory: ChorusShapeMemory = new Map();

  for (let i = 0; i < sequence.formations.length; i += 1) {
    const eng = sequence.formations[i]!;
    const cue = sortedCues[i] ?? sortedCues[sortedCues.length - 1]!;
    const t = clamp(cue.rawTime, 0, duration);
    const window = windows[i] ?? {
      tStartSec: t,
      tEndSec: Math.min(duration, t + 8),
    };
    const section = structure.sections.find(
      (s) => t >= s.startTime && t < s.endTime
    );
    const lightingSection = lightingSectionFromMusic(section?.type);
    const lightingPreset = ruleForSection(lightingSection).lightingPreset;

    const musical = musicalEventAt(musicalEvents, t);
    const intentHit = musicEngine?.choreographicIntents?.intents.find(
      (it) => it.cueId === cue.id
    );
    const callback = decideChorusCallback(
      {
        chorusFamilyId:
          intentHit?.chorusFamilyId ?? musical?.chorusFamilyId ?? null,
        variation: intentHit?.variation ?? musical?.variation ?? "none",
      },
      chorusShapeMemory,
      chorusLayoutMemory
    );
    const preferred = layoutPresetIdFromTags(eng.tags);
    let layoutId: LayoutPresetId | null = preferred;
    let dancers: DancerSpot[];
    if (isTrueHold(cue) && i > 0) {
      dancers = prevSpots.map((s) => ({ ...s }));
      layoutId = recentLayouts[recentLayouts.length - 1] ?? preferred;
    } else {
      const lock =
        callback.bypassRecentAvoidance && callback.rememberedLayoutId
          ? (callback.rememberedLayoutId as LayoutPresetId)
          : null;
      const picked = resolveDistinctLayoutSpots({
        preferred: lock ?? preferred,
        seeds,
        prevSpots,
        cue,
        section: lightingSection,
        tasteBias: input.tasteBias,
        profile: input.profile,
        layoutOpts,
        recent: callback.bypassRecentAvoidance ? [] : recentLayouts.slice(-3),
        salt: i + Math.round(cue.energyAfter),
        lockLayoutId: lock,
        scaleMax: callback.scaleMax,
      });
      layoutId = picked.layoutId;
      dancers = picked.dancers;
    }
    prevSpots = dancers;
    if (layoutId) recentLayouts.push(layoutId);
    rememberChorusLayout(
      chorusLayoutMemory,
      callback.chorusFamilyId,
      callback.variation === "none" ? "none" : callback.variation,
      layoutId
    );

    const typeJa = TYPE_JA[eng.type] ?? eng.type;
    const actionJa = ACTION_JA[cue.action] ?? cue.action;
    const layoutJa = layoutId ? layoutPresetLabel(layoutId) : typeJa;
    const callbackJa =
      callback.variation === "final"
        ? "特大"
        : callback.variation === "repeat"
          ? "コールバック"
          : "";
    const name = [actionJa, layoutJa, callbackJa].filter(Boolean).join(" · ");
    const id =
      crypto.randomUUID?.() ?? `eng-${Math.round(t * 1000)}-${i}`;

    formations.push({
      id,
      name,
      setPieces: [],
      dancers,
    });
    cues.push({
      id: crypto.randomUUID?.() ?? `cue-${id}`,
      formationId: id,
      tStartSec: window.tStartSec,
      tEndSec: window.tEndSec,
      name,
    });

    const mm = dancers.map((d) => ({
      memberId: d.id,
      x: (d.xPct / 100) * STAGE_WIDTH_M - STAGE_WIDTH_M / 2,
      y: (d.yPct / 100) * STAGE_DEPTH_M - STAGE_DEPTH_M / 2,
      poseLevel: (d.poseLevel ?? "stand") as PoseLevel,
    }));
    payloadFormations.push({
      fcpId: cue.id,
      timestamp: window.tStartSec,
      count: Math.round((window.tStartSec * bpm) / 60) || 1,
      presetName: name,
      lightingPreset,
      positions: mm,
      formationPattern: layoutId
        ? familyForCueAction(cue.action, lightingSection)
        : undefined,
      layoutPresetId: layoutId ?? undefined,
      chorusFamilyId: callback.chorusFamilyId ?? undefined,
      callbackVariation:
        callback.variation === "none" ? undefined : callback.variation,
      scale: callback.scaleMax ? "max" : callback.variation === "none" ? undefined : "default",
    });

    reasoning.push(
      `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")} ${actionJa} → ${layoutJa}`
    );
  }

  const gapped = ensureTravelGaps(cues, bpm);
  cues.length = 0;
  cues.push(...gapped);

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
    ...(musicEngine ? { musicEngine } : {}),
  };
}
