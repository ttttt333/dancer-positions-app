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
import { ensureMinPairDistancePct, DANCER_MIN_DISTANCE, minPairDistanceMeters } from "../engine/formation/formationGeometry";
import { quantizeFormationGeometry } from "../engine/formation/geometricGridQuantizer";
import { repairPathCrossings } from "../engine/formation/dancerPathGuard";
import {
  classifyLayoutPresetId,
} from "../engine/formation/goldenFormationFilter";
import {
  motifRegistry,
  onPresetSelected,
} from "../engine/formation/motifConsistencyRule";
import { evaluateMotionDynamics } from "../engine/formation/motionDynamicsEvaluator";
import { resolveSectionRuleCategory } from "../engine/formation/sectionContextRules";
import { enforceAndEvaluateSymmetry } from "../engine/formation/symmetryGuard";
import {
  resolveSongSectionV2,
  type StructureResultV2,
  type SongSectionV2,
} from "../types/songStructure";
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
import { appChangePointsFromTimeline, preferStructuralChangePoints } from "./productionChangePointAdapter";
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
  familyForSuggestCue,
  isCrossLayoutPreset,
  isHorizontalWideLayout,
  layoutPresetIdFromTags,
  layoutPresetLabel,
  layoutShapeBucket,
  quantizePolicyForLayoutPreset,
  rankLayoutPresets,
  spotsForLayoutPreset,
} from "./layoutPresetBridge";
import { resolvePinnedLayoutForCue } from "./cueLayoutPins";
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
import { quantizeCueTimings } from "../engine/grid/phraseGridQuantizer";
import {
  DEFAULT_FORMATION_WEIGHTS,
  type FormationScore,
} from "../tier1";
import {
  AI_SUGGEST_CUE_MAX,
  AI_SUGGEST_CUE_MIN,
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
  /** 再提案フィードバック等で隊形ローテをずらすソルト */
  layoutVarietySalt?: number;
  /**
   * Fly song_structure_v2 の解析結果。
   * あるときモチーフ一貫性（cluster_id）と energy_trend を選定に使う。
   */
  structureV2?: StructureResultV2 | null;
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

function memberSpanMeters(members: MemberPosition[]): number {
  if (members.length < 2) return 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of members) {
    minX = Math.min(minX, m.x);
    maxX = Math.max(maxX, m.x);
    minY = Math.min(minY, m.y);
    maxY = Math.max(maxY, m.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

function refineSpotsForClass(
  spots: DancerSpot[],
  seeds: DancerSpot[],
  prev: DancerSpot[] | null,
  profile: ClassProfile,
  availableCounts: number,
  layoutOpts: LayoutPresetOptions | undefined
): DancerSpot[] {
  const targetMembers = resolveOverlaps(spotsToMembers(spots, profile), profile);
  let members = targetMembers;
  if (prev && prev.length > 0) {
    const prevM = spotsToMembers(prev, profile);
    const hard = evaluateMoveConstraints(
      prevM,
      targetMembers,
      profile,
      availableCounts
    );
    members = hard.corrected;
    const targetSpan = memberSpanMeters(targetMembers);
    const correctedSpan = memberSpanMeters(members);
    const collapsed =
      targetSpan > 2.5 && correctedSpan < targetSpan * 0.55;
    const tooTight =
      minPairDistanceMeters(
        members.map((m) => ({
          xPct: ((m.x + STAGE_WIDTH_M / 2) / STAGE_WIDTH_M) * 100,
          yPct: ((m.y + STAGE_DEPTH_M / 2) / STAGE_DEPTH_M) * 100,
        }))
      ) < DANCER_MIN_DISTANCE * 0.75;

    // 移動上限で隊形が潰れたら、予算を緩めて雛形の広がりを優先
    if (collapsed || tooTight) {
      const softProfile: ClassProfile = {
        ...profile,
        maxMoveDistancePerCount: Math.max(
          profile.maxMoveDistancePerCount * 2.2,
          1.4
        ),
      };
      members = evaluateMoveConstraints(
        prevM,
        targetMembers,
        softProfile,
        Math.max(availableCounts, FORMATION_TRAVEL_COUNTS) * 2
      ).corrected;
    }

    if (
      hard.warnings.some((w) => w.code === "CROSS_FORBIDDEN") &&
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
  return ensureMinPairDistancePct(
    membersToSpots(members, seeds),
    DANCER_MIN_DISTANCE
  );
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
  cueIndex: number;
  songSection?: SongSectionV2;
}): FormationCandidate[] {
  const n = input.seeds.length;
  const ids = rankLayoutPresets({
    family: familyForSuggestCue(
      input.cue.action,
      input.section,
      input.cue.reasonCodes,
      input.salt,
      { outroClimax: input.tasteBias.outroClimax }
    ),
    sectionType: input.section,
    salt: input.salt,
    dancerCount: n,
    allowCross: allowCrossOf(input.profile),
    taste: input.tasteBias,
    cueIndex: input.cueIndex,
    cueAction: input.cue.action,
    songSection: input.songSection,
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

function spotToMeters(d: { xPct: number; yPct: number }): {
  x: number;
  y: number;
} {
  return {
    x: (d.xPct / 100) * STAGE_WIDTH_M - STAGE_WIDTH_M / 2,
    y: (d.yPct / 100) * STAGE_DEPTH_M - STAGE_DEPTH_M / 2,
  };
}

function metersToSpotPct(x: number, y: number): { xPct: number; yPct: number } {
  return {
    xPct: clamp(((x + STAGE_WIDTH_M / 2) / STAGE_WIDTH_M) * 100, 4, 96),
    yPct: clamp(((y + STAGE_DEPTH_M / 2) / STAGE_DEPTH_M) * 100, 6, 94),
  };
}

/**
 * 格子・最低間隔の後に、前コマ→今コマの移動線交差をローカルスワップで修復する。
 * ダンサー id は維持し、幾何スロットだけ付け替える。
 */
function applyPathCrossingRepair(
  next: DancerSpot[],
  prevSpots: DancerSpot[] | undefined
): DancerSpot[] {
  if (!prevSpots || prevSpots.length < 2 || next.length < 2) return next;
  if (prevSpots.length !== next.length) return next;

  const prevById = new Map(prevSpots.map((d) => [d.id, d] as const));
  const orderedPrev: DancerSpot[] = [];
  for (const d of next) {
    const p = prevById.get(d.id);
    if (!p) return next;
    orderedPrev.push(p);
  }

  const currentPositions = orderedPrev.map(spotToMeters);
  const targetSpots = next.map(spotToMeters);
  const identity = targetSpots.map((_, i) => i);
  const repaired = repairPathCrossings(
    currentPositions,
    targetSpots,
    identity,
    { costTolerance: 1.15 }
  );

  let changed = false;
  for (let i = 0; i < repaired.length; i += 1) {
    if (repaired[i] !== i) {
      changed = true;
      break;
    }
  }
  if (!changed) return next;

  return next.map((d, dancerIdx) => {
    const spotIdx = repaired[dancerIdx]!;
    const src = next[spotIdx]!;
    return { ...d, xPct: src.xPct, yPct: src.yPct };
  });
}

function finalizeSuggestSpots(
  dancers: DancerSpot[],
  scaleMax: boolean | undefined,
  prevSpots?: DancerSpot[],
  layoutId?: LayoutPresetId | null
): DancerSpot[] {
  let next = dancers;
  if (scaleMax) next = scaleSpotsFromCenter(next, FINAL_CHORUS_SCALE);

  const policy = quantizePolicyForLayoutPreset(layoutId);
  // Step 2: 雛形系統に応じて格子・千鳥・対称の強度を変える（二重補正で形を壊さない）
  const inMeters = next.map((d) => ({
    ...d,
    ...spotToMeters(d),
  }));
  const quantized = quantizeFormationGeometry(inMeters, {
    xGridStep: 0.9,
    yGridStep: 1.0,
    minDancerDistance: DANCER_MIN_DISTANCE,
    centerTolerance: 0.3,
    enableStaggering: policy.enableStaggering,
    enableSymmetry: policy.enableSymmetry,
    enableLattice: policy.enableLattice,
  });
  const byId = new Map(quantized.map((d) => [d.id, d] as const));
  // 列グループ化で配列順が変わっても、seed/prev と同じ id 順を維持する
  next = next.map((d) => {
    const q = byId.get(d.id);
    if (!q) return d;
    return {
      ...d,
      ...metersToSpotPct(q.x, q.y),
    };
  });

  // 最終安全網（格子押し出し後の再接近を防ぐ）
  next = ensureMinPairDistancePct(next, DANCER_MIN_DISTANCE);

  // Step 3: 前コマとの動線交差を 2-opt 修復（幾何の美しさを保つ）
  return applyPathCrossingRepair(next, prevSpots);
}

const CALLBACK_LOCK_ACTIONS = new Set<FormationCueAction>([
  "EXPAND",
  "MAJOR_CHANGE",
  "V",
  "TRIANGLE",
  "ARC",
  "DIAGONAL",
  "SPLIT",
  "LINE",
]);

function resolveDistinctLayoutSpots(input: {
  preferred: LayoutPresetId | null;
  seeds: DancerSpot[];
  prevSpots: DancerSpot[];
  cue: FormationCue;
  section: SectionType;
  tasteBias: SuggestTasteBias;
  profile: ClassProfile;
  layoutOpts: LayoutPresetOptions | undefined;
  /** これまでの全使用雛形（同一IDの再出を抑える） */
  recent: LayoutPresetId[];
  salt: number;
  cueIndex: number;
  lockLayoutId?: LayoutPresetId | null;
  scaleMax?: boolean;
  songSection?: SongSectionV2;
}): { layoutId: LayoutPresetId | null; dancers: DancerSpot[] } {
  const finish = (
    layoutId: LayoutPresetId | null,
    dancers: DancerSpot[]
  ): { layoutId: LayoutPresetId | null; dancers: DancerSpot[] } => {
    let out = dancers;
    if (layoutId && out.length > 0) {
      const category = resolveSectionRuleCategory(
        classifyLayoutPresetId(layoutId),
        layoutId
      );
      const sym = enforceAndEvaluateSymmetry(
        out.map((s) => ({ xPct: s.xPct, yPct: s.yPct })),
        category
      );
      out = out.map((s, i) => ({
        ...s,
        xPct: sym.enforcedPositions[i]?.xPct ?? s.xPct,
        yPct: sym.enforcedPositions[i]?.yPct ?? s.yPct,
      }));
      // 鏡像補正で距離が潰れた場合に再確保
      out = ensureMinPairDistancePct(out, DANCER_MIN_DISTANCE);
    }
    if (input.songSection && layoutId) {
      onPresetSelected(
        input.songSection.cluster_id,
        classifyLayoutPresetId(layoutId)
      );
    }
    return { layoutId, dancers: out };
  };

  if (input.lockLayoutId) {
    const raw = spotsForLayoutPreset(
      input.lockLayoutId,
      input.seeds,
      input.prevSpots,
      input.layoutOpts
    );
    const dancers = finalizeSuggestSpots(
      refineSpotsForClass(
        raw,
        input.seeds,
        input.prevSpots,
        input.profile,
        FORMATION_TRAVEL_COUNTS,
        input.layoutOpts
      ),
      input.scaleMax,
      input.prevSpots,
      input.lockLayoutId
    );
    return finish(input.lockLayoutId, dancers);
  }
  const rankLimit = Math.min(
    28,
    Math.max(14, 8 + input.recent.length)
  );
  const ranked = rankLayoutPresets(
    {
      family: familyForSuggestCue(
        input.cue.action,
        input.section,
        input.cue.reasonCodes,
        input.salt,
        { outroClimax: input.tasteBias.outroClimax }
      ),
      sectionType: input.section,
      salt: input.salt,
      dancerCount: input.seeds.length,
      allowCross: allowCrossOf(input.profile),
      taste: input.tasteBias,
      recent: input.recent,
      cueIndex: input.cueIndex,
      cueAction: input.cue.action,
      songSection: input.songSection,
      prevSpotsPct: input.prevSpots.map((s) => ({
        xPct: s.xPct,
        yPct: s.yPct,
      })),
    },
    rankLimit
  );
  const lastId = input.recent[input.recent.length - 1] ?? null;
  const preferredOk =
    input.preferred &&
    !isHorizontalWideLayout(input.preferred) &&
    !input.recent.includes(input.preferred) &&
    input.preferred !== lastId;
  const ordered = preferredOk
    ? [input.preferred!, ...ranked.filter((id) => id !== input.preferred)]
    : ranked.filter((id) => id !== lastId).concat(lastId ? [lastId] : []);

  const usedExact = new Set(input.recent);
  const recentBuckets = new Set(
    input.recent.slice(-5).map((id) => layoutShapeBucket(id))
  );
  const recentHadHLine = input.recent.slice(-5).some(isHorizontalWideLayout);
  // 同じ「丸系」連発（U字など）を特に抑える
  const lastBucket = lastId ? layoutShapeBucket(lastId) : null;

  let fallback: { layoutId: LayoutPresetId; dancers: DancerSpot[] } | null =
    null;
  // pass0: 未使用 + 直近バケツ違い / pass1: 未使用 / pass2: 直前以外
  for (const pass of [0, 1, 2] as const) {
    for (const id of ordered) {
      if (pass <= 1 && usedExact.has(id)) continue;
      if (pass === 2 && id === lastId) continue;
      if (pass === 0 && recentBuckets.has(layoutShapeBucket(id))) continue;
      if (pass === 0 && lastBucket === "round" && layoutShapeBucket(id) === "round") {
        continue;
      }
      if (pass === 0 && recentHadHLine && isHorizontalWideLayout(id)) continue;
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
      const dancers = finalizeSuggestSpots(
        refineSpotsForClass(
          raw,
          input.seeds,
          input.prevSpots,
          input.profile,
          FORMATION_TRAVEL_COUNTS,
          input.layoutOpts
        ),
        input.scaleMax && CALLBACK_LOCK_ACTIONS.has(input.cue.action),
        input.prevSpots,
        id
      );
      if (!fallback) fallback = { layoutId: id, dancers };
      const travelFloor =
        pass === 2 ? MIN_MEAN_TRAVEL_PCT * 0.45 : MIN_MEAN_TRAVEL_PCT;
      const motion = evaluateMotionDynamics(
        input.prevSpots.map((s) => ({ xPct: s.xPct, yPct: s.yPct })),
        dancers.map((s) => ({ xPct: s.xPct, yPct: s.yPct }))
      );
      // 局所移動（参加率低）は pass0/1 でスキップ。pass2 はフォールバック許容。
      if (pass < 2 && motion.movingRatio < 0.35) {
        continue;
      }
      if (meanTravelPct(input.prevSpots, dancers) >= travelFloor) {
        return finish(id, dancers);
      }
    }
  }
  if (fallback) return finish(fallback.layoutId, fallback.dancers);
  return finish(
    null,
    finalizeSuggestSpots(
      input.prevSpots.map((s) => ({ ...s })),
      false,
      input.prevSpots
    )
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
  // Bメロ終わりは「閉じる」隊形と相性の良い verse 扱い
  if (type === "PRE_CHORUS") return "verse";
  if (type === "BREAK" || type === "BRIDGE") return "se_trigger";
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
function peakRidgeCandidates(
  peaks: number[],
  duration: number
): Array<{ time: number; score: number }> {
  const n = peaks.length;
  if (n < 8 || duration <= 0) return [];
  const mean =
    peaks.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / n;
  const raw: Array<{ time: number; score: number }> = [];
  for (let i = 2; i < n - 2; i += 1) {
    const a = peaks[i - 2] ?? 0;
    const b = peaks[i - 1] ?? 0;
    const c = peaks[i] ?? 0;
    const d = peaks[i + 1] ?? 0;
    const localMax = c >= b && c >= d && c > mean * 0.8;
    const sharpRise = c - b > 0.1 && c - a > 0.06;
    const sharpDrop = b - c > 0.1 && a > c;
    if (!localMax && !sharpRise && !sharpDrop) continue;
    const t = (i / Math.max(1, n - 1)) * duration;
    if (t < 2 || t > duration - 1.5) continue;
    raw.push({
      time: t,
      score: localMax ? c * 1.2 : Math.abs(c - b),
    });
  }
  raw.sort((x, y) => x.time - y.time);
  const dedup: Array<{ time: number; score: number }> = [];
  for (const p of raw) {
    const last = dedup[dedup.length - 1];
    if (last && p.time - last.time < 2.2) {
      if (p.score > last.score) dedup[dedup.length - 1] = p;
    } else {
      dedup.push(p);
    }
  }
  return dedup;
}

function nearestPeakTime(
  time: number,
  peaks: Array<{ time: number; score: number }>,
  maxDist: number
): number | null {
  let best: { time: number; score: number } | null = null;
  let bestDist = Infinity;
  for (const p of peaks) {
    const d = Math.abs(p.time - time);
    if (d < bestDist && d <= maxDist) {
      best = p;
      bestDist = d;
    }
  }
  return best?.time ?? null;
}

/**
 * 指定キュー数に合わせて、曲の区切り・波形の山を優先して選定する。
 * 均等時刻への埋めは最終手段にし、理想の「フレーズ幅のバラつき」を保つ。
 */
function selectCuesForTargetCount(
  analysis: CueAnalysisResult,
  targetCount: number,
  bpm: number,
  duration: number,
  structuralCps: AppChangePoint[] | undefined,
  opts?: {
    allChangePoints?: AppChangePoint[];
    peaks?: number[];
  }
): CueAnalysisResult {
  const target = Math.max(
    AI_SUGGEST_CUE_MIN,
    Math.min(AI_SUGGEST_CUE_MAX, targetCount)
  );
  const minGap = minHitGapSec(bpm);
  const active = analysis.cues
    .filter((c) => !c.suppressed)
    .sort((a, b) => a.rawTime - b.rawTime || a.id.localeCompare(b.id));

  const intents: Record<string, FormationCueIntent> = { ...analysis.intents };
  const picked: FormationCue[] = [];
  const used = new Set<string>();
  let synthIndex = 0;

  const fitsGap = (time: number, gap = minGap): boolean =>
    !picked.some((p) => Math.abs(p.rawTime - time) < gap - 1e-6);

  const takeCue = (cue: FormationCue, gap = minGap): boolean => {
    if (used.has(cue.id) || picked.length >= target) return false;
    if (!fitsGap(cue.rawTime, gap)) return false;
    picked.push(cue);
    used.add(cue.id);
    return true;
  };

  const takeSynthetic = (
    time: number,
    cp?: AppChangePoint,
    gap = minGap
  ): boolean => {
    if (picked.length >= target || time < 0 || time > duration - 0.4) return false;
    if (!fitsGap(time, gap)) return false;
    const syn = syntheticCueAt(time, bpm, cp, synthIndex++);
    intents[syn.cue.id] = syn.intent;
    picked.push(syn.cue);
    used.add(syn.cue.id);
    return true;
  };

  const takeNearTime = (
    time: number,
    gap = minGap,
    cp?: AppChangePoint
  ): boolean => {
    let best: FormationCue | null = null;
    let bestDist = Infinity;
    for (const cue of active) {
      if (used.has(cue.id)) continue;
      const dist = Math.abs(cue.rawTime - time);
      if (dist < bestDist && dist <= 3.5) {
        best = cue;
        bestDist = dist;
      }
    }
    if (best && takeCue(best, gap)) return true;
    return takeSynthetic(time, cp, gap);
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

  const structuralPriority = (st: AppChangePoint["section_type"] | undefined) => {
    if (st === "CHORUS_START" || st === "DROP") return 5;
    if (st === "PRE_CHORUS") return 4;
    if (st === "OUTRO") return 3;
    if (st === "CHORUS") return 2;
    return 0;
  };
  const structuralRemote = [...(structuralCps ?? opts?.allChangePoints ?? [])]
    .filter((cp) => structuralPriority(cp.section_type) > 0 && cp.time >= 2)
    .sort(
      (a, b) =>
        structuralPriority(b.section_type) - structuralPriority(a.section_type) ||
        a.time - b.time
    );
  for (const cp of structuralRemote) {
    if (picked.length >= target) break;
    takeNearTime(cp.time, minGap, cp);
  }

  const peakRidges = peakRidgeCandidates(opts?.peaks ?? [], duration);
  type Cand = {
    time: number;
    score: number;
    cp?: AppChangePoint;
    source: "remote" | "peak" | "engine";
  };
  const candidates: Cand[] = [];
  for (const cp of opts?.allChangePoints ?? []) {
    if (cp.time < 2 || cp.time > duration - 1.5) continue;
    const boost = structuralPriority(cp.section_type) * 20;
    candidates.push({
      time: cp.time,
      score:
        boost +
        (cp.tier === "major" ? 40 : cp.tier === "medium" ? 22 : 10) +
        (Number.isFinite(cp.score) ? cp.score * 30 : 0),
      cp,
      source: "remote",
    });
  }
  for (const p of peakRidges) {
    candidates.push({ time: p.time, score: 18 + p.score * 40, source: "peak" });
  }
  for (const cue of active) {
    if (cue.rawTime < 2) continue;
    candidates.push({
      time: cue.rawTime,
      score: cueStructureScore(cue, opts?.allChangePoints ?? structuralCps) * 0.6,
      source: "engine",
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.time - b.time);

  /** 最大の空き区間へ候補を落とす（均等割りを避ける） */
  const largestGap = (): { from: number; to: number } | null => {
    const times = [...picked.map((c) => c.rawTime), duration].sort(
      (a, b) => a - b
    );
    let best: { from: number; to: number; size: number } | null = null;
    let prev = 0;
    for (const t of times) {
      const size = t - prev;
      if (size >= minGap * 2.2 && (!best || size > best.size)) {
        best = { from: prev, to: t, size };
      }
      prev = t;
    }
    return best ? { from: best.from, to: best.to } : null;
  };

  while (picked.length < target) {
    const gap = largestGap();
    if (!gap) break;
    const lo = gap.from + minGap;
    const hi = gap.to - minGap;
    if (hi <= lo) break;

    let placed = false;
    for (const cand of candidates) {
      if (cand.time < lo || cand.time > hi) continue;
      if (!fitsGap(cand.time, minGap)) continue;
      if (takeNearTime(cand.time, minGap, cand.cp)) {
        placed = true;
        break;
      }
    }
    if (placed) continue;

    const mid = (lo + hi) / 2;
    const snapped =
      nearestPeakTime(mid, peakRidges, Math.min(8, (hi - lo) / 2)) ?? mid;
    if (!takeNearTime(snapped, minGap * 0.85)) break;
  }

  // まだ足りなければ、残り候補をスコア順で（均等埋めはしない）
  for (const cand of candidates) {
    if (picked.length >= target) break;
    takeNearTime(cand.time, minGap * 0.75, cand.cp);
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
        console.warn(
          "[ChoreoCore MusicEngine] provisional: timeline finalize failed —",
          finalized.reason,
          "cacheKey=",
          input.audioCacheKey ?? "(none)"
        );
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
      console.warn(
        "[ChoreoCore MusicEngine] provisional: Phase2 unavailable —",
        real.fallbackReason,
        "cacheKey=",
        input.audioCacheKey ?? "(none)",
        input.audioCacheKey
          ? "(Real Phase1 cache miss or rejected — ensure suggest awaited ensureRealPhase1ForSuggest)"
          : "(peaksCacheKey missing)"
      );
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
    console.warn(
      "[ChoreoCore MusicEngine] provisional: VITE_MUSIC_ENGINE_PHASE12 disabled — using peaks synthetic path"
    );
    phase1 = phase1FromPeaks(input.peaks, duration, bpm);
    structure = analyzeMusicStructure(phase1);
  }

  let structuralCps = structuralCpsFromTimeline;
  // 構造 Cue の主入力: structureV2 → timeline → v1 remote
  const preferredRemote = preferStructuralChangePoints({
    structureV2: input.structureV2,
    timelineCps: structuralCpsFromTimeline,
    remote: input.remoteChangePoints,
  });

  if (!skipRemoteOverwrite) {
    const applied = applyRemoteProductionOverwrite(
      structure,
      preferredRemote,
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
  } else if (preferredRemote?.length) {
    // Phase12 でも promote/select は v2 優先の変化点を使う
    structuralCps = thinStructuralChangePoints(preferredRemote);
  }

  return finishEngineAppSuggest({
    input: {
      ...input,
      // promote / select が常に同じ優先ソースを見る
      remoteChangePoints: preferredRemote ?? input.remoteChangePoints,
    },
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
  cueAnalysis = promoteCuesAtSongChanges(
    cueAnalysis,
    input.remoteChangePoints ?? structuralCps
  );
  cueAnalysis = selectCuesForTargetCount(
    cueAnalysis,
    maxCues,
    bpm,
    duration,
    structuralCps,
    {
      allChangePoints: input.remoteChangePoints,
      peaks: input.peaks,
    }
  );
  // Step 1: 枠数確定後に 8カウント頭へスナップ（promote 近傍マッチは既に完了）
  const beforeSnapCount = cueAnalysis.cues.filter((c) => !c.suppressed).length;
  cueAnalysis = {
    ...cueAnalysis,
    cues: quantizeCueTimings({
      cues: cueAnalysis.cues,
      bpm,
      durationSec: duration,
      beats: phase1.beats.map((b) => b.time),
      phraseBeats: 8,
      minGapBeats: 16,
    }),
  };
  const afterSnapCount = cueAnalysis.cues.filter((c) => !c.suppressed).length;
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
  const varietySalt = Math.abs(Math.round(input.layoutVarietySalt ?? 0));
  // 曲通しのモチーフロックをリセット（suggest 1 回単位）
  motifRegistry.clear();
  const candidatesByCue: Record<string, FormationCandidate[]> = {};
  for (let i = 0; i < active.length; i += 1) {
    const cue = active[i]!;
    const section = structure.sections.find(
      (s) => cue.rawTime >= s.startTime && cue.rawTime < s.endTime
    );
    const lightingSection = lightingSectionFromMusic(section?.type);
    const songSection = resolveSongSectionV2({
      timeSec: cue.rawTime,
      structureV2: input.structureV2,
      legacySection: section,
    });
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
        salt: i + Math.round(cue.energyAfter) + varietySalt,
        cueIndex: i,
        songSection,
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
    `タイミング: 8カウント頭へスナップ（選定 ${beforeSnapCount} → 吸着後 ${afterSnapCount}）`,
    `立ち位置: 0.9m×1.0m 格子・千鳥・左右対称・最小 ${DANCER_MIN_DISTANCE}m`,
    `雛形: 黄金の7大構造を優先（奇抜・散開は減点）`,
    input.structureV2
      ? `曲構造 v2: クラスタモチーフ一貫性 + energy_trend 展開（source=${input.structureV2.source ?? "v2"}）`
      : `曲構造: レガシーセクションからモチーフ近似（Fly v2 未接続時）`,
    structureLabels.length
      ? `曲の区切り: ${structureLabels.join(" → ")}（${
          input.structureV2
            ? "structure-v2 主入力"
            : "Aメロ終わり=PRE_CHORUS、サビ頭=CHORUS_START"
        }）`
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
    const songSection = resolveSongSectionV2({
      timeSec: t,
      structureV2: input.structureV2,
      legacySection: section,
    });
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
    // サビコールバック再利用は「見せ場」アクションのみ。キープ/閉じるでは固定しない
    const allowCallbackLock =
      (callback.variation === "repeat" || callback.variation === "final") &&
      CALLBACK_LOCK_ACTIONS.has(cue.action);
    const userPin = resolvePinnedLayoutForCue({
      pins: input.tasteBias.cueLayoutPins ?? [],
      cueIndex: i,
      cueCount: sequence.formations.length,
      reasonCodes: cue.reasonCodes,
      sectionLabel: songSection?.label,
    });
    const callbackLock =
      allowCallbackLock && callback.rememberedLayoutId
        ? (callback.rememberedLayoutId as LayoutPresetId)
        : null;
    // ユーザー指定ピンが最優先（「最初と最後はピラミッド」など）
    const lock = (userPin as LayoutPresetId | null) ?? callbackLock;
    const picked = resolveDistinctLayoutSpots({
      preferred: lock ?? preferred,
      seeds,
      prevSpots,
      cue,
      section: lightingSection,
      tasteBias: input.tasteBias,
      profile: input.profile,
      layoutOpts,
      recent: recentLayouts,
      salt: i + Math.round(cue.energyAfter) + varietySalt,
      cueIndex: i,
      lockLayoutId: lock,
      scaleMax: allowCallbackLock && callback.scaleMax && !userPin,
      songSection,
    });
    layoutId = picked.layoutId;
    dancers = picked.dancers;
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
        ? familyForSuggestCue(
            cue.action,
            lightingSection,
            cue.reasonCodes,
            i + Math.round(cue.energyAfter),
            { outroClimax: input.tasteBias.outroClimax }
          )
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
