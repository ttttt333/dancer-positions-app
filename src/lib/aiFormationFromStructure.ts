/**
 * 変化点 tier → 既存フォーメーション雛形プール選定 + 移動実現可能性チェック。
 * Spec §4–5: song-structure-analysis-spec.md
 */

import type { DancerSpot, Formation, Cue } from "../types/choreography";
import {
  dancersForLayoutPreset,
  LAYOUT_PRESET_OPTIONS,
  transferDancerIdentitiesByNearestPosition,
  type LayoutPresetId,
} from "./formationLayouts";
import type {
  ChangeTier,
  SongStructureAnalysis,
} from "./songStructureAnalysis";

/** 1カウントあたりの安全移動距離(m)。仮値 — 実データで要チューニング */
export const METERS_PER_COUNT = 0.4;

export type StructureFormationSuggestion = {
  eightIndex: number;
  timestamp: number;
  tier: ChangeTier;
  presetId: LayoutPresetId;
  formation: Formation;
};

const MAJOR_POOL: LayoutPresetId[] = [
  "vee",
  "inverse_vee",
  "pyramid_inverse",
  "diamond",
  "fan_back",
  "fan_front",
  "hourglass",
  "circle",
  "wing_spread",
  "cross_split",
  "arrow_front",
  "arrow_back",
  "bowtie",
  "x_shape",
  "hollow_ring",
  "quad_corners",
];

const MEDIUM_POOL: LayoutPresetId[] = [
  "pyramid",
  "stagger",
  "stagger_inverse",
  "two_rows",
  "rows_3",
  "rows_4",
  "arc",
  "grid",
  "wedge",
  "block_lr",
  "block_3",
  "diagonal_se",
  "zigzag",
  "u_shape",
  "triangle",
  "wave",
];

const MINOR_POOL: LayoutPresetId[] = [
  "line",
  "line_front",
  "line_back",
  "stagger",
  "stagger_tight",
  "stagger_wide",
  "two_rows_equal",
  "line_vertical",
  "arc_tight",
  "grid_tight",
];

const VALID_IDS = new Set(LAYOUT_PRESET_OPTIONS.map((o) => o.id));

function poolForTier(tier: ChangeTier, dynamism: number): LayoutPresetId[] {
  const base =
    tier === "major"
      ? MAJOR_POOL
      : tier === "medium"
        ? MEDIUM_POOL
        : MINOR_POOL;
  let pool = base.filter((id) => VALID_IDS.has(id));

  // song_dynamism が低い曲では major でも medium 寄りに寄せる
  if (tier === "major" && dynamism < 0.35) {
    pool = [...MEDIUM_POOL.filter((id) => VALID_IDS.has(id)), ...pool];
  }
  if (tier === "minor" && dynamism > 0.7) {
    pool = [...pool, ...MEDIUM_POOL.filter((id) => VALID_IDS.has(id)).slice(0, 4)];
  }
  return pool.length > 0 ? pool : (["line"] as LayoutPresetId[]);
}

type MeterPos = { x: number; y: number };

function pctToMeters(
  xPct: number,
  yPct: number,
  stageWidthM: number,
  stageDepthM: number
): MeterPos {
  return {
    x: (xPct / 100) * stageWidthM,
    y: (yPct / 100) * stageDepthM,
  };
}

function euclidean(a: MeterPos, b: MeterPos): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function computeMaxFeasibleDistance(availableCounts: number): number {
  return Math.max(0.5, availableCounts * METERS_PER_COUNT);
}

/** 同一 id 対応で距離を見る（無い id はスキップ） */
function pairedDisplacements(
  prev: DancerSpot[],
  next: DancerSpot[],
  stageWidthM: number,
  stageDepthM: number
): number[] {
  const nextById = new Map(next.map((d) => [d.id, d] as const));
  const dists: number[] = [];
  for (const p of prev) {
    const q = nextById.get(p.id);
    if (!q) continue;
    const a = pctToMeters(p.xPct, p.yPct, stageWidthM, stageDepthM);
    const b = pctToMeters(q.xPct, q.yPct, stageWidthM, stageDepthM);
    dists.push(euclidean(a, b));
  }
  return dists;
}

function isFormationFeasible(
  prev: DancerSpot[],
  candidate: DancerSpot[],
  availableCounts: number,
  stageWidthM: number,
  stageDepthM: number
): boolean {
  const maxDist = computeMaxFeasibleDistance(availableCounts);
  const dists = pairedDisplacements(
    prev,
    candidate,
    stageWidthM,
    stageDepthM
  );
  if (dists.length === 0) return true;
  return dists.every((d) => d <= maxDist);
}

function totalDisplacement(
  prev: DancerSpot[],
  candidate: DancerSpot[],
  stageWidthM: number,
  stageDepthM: number
): number {
  return pairedDisplacements(
    prev,
    candidate,
    stageWidthM,
    stageDepthM
  ).reduce((a, b) => a + b, 0);
}

export type PickFormationOpts = {
  count: number;
  previousDancers: DancerSpot[];
  availableCounts: number;
  stageWidthMm: number;
  stageDepthMm: number;
  dancerSpacingMm?: number | null;
  /** 直前に使った preset（連続重複を避ける） */
  avoidPresetId?: LayoutPresetId | null;
};

/**
 * 実現可能な候補の中から移動量が最大のものを選ぶ（ギリギリを攻める）。
 * 全滅なら最小移動にフォールバック。
 */
export function pickFormationPushingLimit(
  pool: LayoutPresetId[],
  opts: PickFormationOpts
): { presetId: LayoutPresetId; dancers: DancerSpot[] } {
  const stageWidthM = Math.max(1, opts.stageWidthMm / 1000);
  const stageDepthM = Math.max(1, opts.stageDepthMm / 1000);
  const layoutOpts = {
    dancerSpacingMm: opts.dancerSpacingMm ?? undefined,
    stageWidthMm: opts.stageWidthMm,
    stageDepthMm: opts.stageDepthMm,
  };

  const candidates = pool
    .filter((id) => id !== opts.avoidPresetId)
    .map((presetId) => {
      const raw = dancersForLayoutPreset(opts.count, presetId, layoutOpts);
      const dancers = transferDancerIdentitiesByNearestPosition(
        raw,
        opts.previousDancers
      );
      return { presetId, dancers };
    });

  const usable = candidates.length > 0 ? candidates : pool.map((presetId) => {
    const raw = dancersForLayoutPreset(opts.count, presetId, layoutOpts);
    const dancers = transferDancerIdentitiesByNearestPosition(
      raw,
      opts.previousDancers
    );
    return { presetId, dancers };
  });

  const feasible = usable.filter((c) =>
    isFormationFeasible(
      opts.previousDancers,
      c.dancers,
      opts.availableCounts,
      stageWidthM,
      stageDepthM
    )
  );

  const pickFrom = feasible.length > 0 ? feasible : usable;
  return pickFrom.reduce((best, cur) => {
    const bestD = totalDisplacement(
      opts.previousDancers,
      best.dancers,
      stageWidthM,
      stageDepthM
    );
    const curD = totalDisplacement(
      opts.previousDancers,
      cur.dancers,
      stageWidthM,
      stageDepthM
    );
    // 実現可能セットでは最大化、全滅フォールバックでも最大化を避ける
    if (feasible.length > 0) {
      return curD > bestD ? cur : best;
    }
    return curD < bestD ? cur : best;
  });
}

function genId(): string {
  return crypto.randomUUID?.() ?? `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function presetLabel(id: LayoutPresetId): string {
  return LAYOUT_PRESET_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export type GenerateFromStructureParams = {
  analysis: SongStructureAnalysis;
  seedDancers: DancerSpot[];
  stageWidthMm: number;
  stageDepthMm: number;
  dancerSpacingMm?: number | null;
  /** 変化点間の移動に使えるカウント（未指定時はエイト差×8） */
};

export type GenerateFromStructureResult = {
  formations: Formation[];
  cues: Cue[];
  suggestions: StructureFormationSuggestion[];
  reasoning: string[];
};

/**
 * change_points に沿ってフォーメーション＆キューを生成。
 * 切り替わりは必ずエイトグリッド上。
 */
export function generateFormationsFromStructure(
  params: GenerateFromStructureParams
): GenerateFromStructureResult {
  const {
    analysis,
    seedDancers,
    stageWidthMm,
    stageDepthMm,
    dancerSpacingMm,
  } = params;

  const count = Math.max(1, seedDancers.length);
  const secPerBeat = 60 / Math.max(1, analysis.bpm);
  const changePoints = [...analysis.change_points].sort(
    (a, b) => a.time - b.time
  );

  // 曲頭用の初期フォーメーション（変化点の手前）
  const startPreset =
    pickFormationPushingLimit(poolForTier("minor", analysis.song_dynamism), {
      count,
      previousDancers: seedDancers,
      availableCounts: 32,
      stageWidthMm,
      stageDepthMm,
      dancerSpacingMm,
    });

  const suggestions: StructureFormationSuggestion[] = [];
  const formations: Formation[] = [];
  const cues: Cue[] = [];
  const reasoning: string[] = [];

  let prevDancers = startPreset.dancers;
  let prevPreset: LayoutPresetId | null = startPreset.presetId;

  const openFormation = (
    _presetId: LayoutPresetId,
    dancers: DancerSpot[],
    name: string
  ): Formation => {
    const f: Formation = {
      id: genId(),
      name,
      setPieces: [],
      dancers,
    };
    formations.push(f);
    return f;
  };

  // t=0 からの初期キュー
  const firstCp = changePoints[0];
  const introEnd = firstCp
    ? Math.max(secPerBeat * 4, firstCp.time - secPerBeat * 4)
    : analysis.duration;
  const introFm = openFormation(
    startPreset.presetId,
    startPreset.dancers,
    `開始 ${presetLabel(startPreset.presetId)}`
  );
  cues.push({
    id: genId(),
    formationId: introFm.id,
    tStartSec: 0,
    tEndSec: Math.min(introEnd, analysis.duration),
    name: introFm.name,
  });
  reasoning.push(
    `開始: ${presetLabel(startPreset.presetId)}（BPM ${analysis.bpm} / dynamism ${analysis.song_dynamism.toFixed(2)}）`
  );

  for (let i = 0; i < changePoints.length; i++) {
    const cp = changePoints[i]!;
    const next = changePoints[i + 1];
    const eightsGap = next
      ? Math.max(1, next.eight_index - cp.eight_index)
      : 4;
    const availableCounts = eightsGap * 8;

    const pool = poolForTier(cp.tier, analysis.song_dynamism);
    const picked = pickFormationPushingLimit(pool, {
      count,
      previousDancers: prevDancers,
      availableCounts,
      stageWidthMm,
      stageDepthMm,
      dancerSpacingMm,
      avoidPresetId: prevPreset,
    });

    const name = `${tierJa(cp.tier)} ${presetLabel(picked.presetId)}`;
    const fm = openFormation(picked.presetId, picked.dancers, name);

    // キュー: 変化点から次変化点の4カウント前まで（移動余白）
    const tStart = cp.time;
    const moveGap = secPerBeat * 4;
    const tEnd = next
      ? Math.max(tStart + secPerBeat * 4, next.time - moveGap)
      : analysis.duration;

    cues.push({
      id: genId(),
      formationId: fm.id,
      tStartSec: Math.round(tStart * 100) / 100,
      tEndSec: Math.round(Math.min(tEnd, analysis.duration) * 100) / 100,
      name,
    });

    suggestions.push({
      eightIndex: cp.eight_index,
      timestamp: cp.time,
      tier: cp.tier,
      presetId: picked.presetId,
      formation: fm,
    });

    reasoning.push(
      `${formatClock(cp.time)} (8×${cp.eight_index}) ${tierJa(cp.tier)} → ${presetLabel(picked.presetId)}（移動余裕 ${availableCounts}カウント）`
    );

    prevDancers = picked.dancers;
    prevPreset = picked.presetId;
  }

  // キューを時間順に整理し、重なりを軽く補正
  cues.sort((a, b) => a.tStartSec - b.tStartSec);
  for (let i = 0; i < cues.length - 1; i++) {
    const cur = cues[i]!;
    const nxt = cues[i + 1]!;
    if (cur.tEndSec > nxt.tStartSec) {
      cur.tEndSec = Math.max(cur.tStartSec + 0.5, nxt.tStartSec);
    }
  }

  return { formations, cues, suggestions, reasoning };
}

function tierJa(t: ChangeTier): string {
  if (t === "major") return "大転換";
  if (t === "medium") return "中変化";
  return "微調整";
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** テスト・デバッグ用にプールを公開 */
export function changeTierPresetPool(
  tier: ChangeTier,
  dynamism = 0.5
): LayoutPresetId[] {
  return poolForTier(tier, dynamism);
}
