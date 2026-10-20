import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import {
  dancersForLayoutPreset,
  transferDancerIdentitiesByNearestPosition,
  type LayoutPresetId,
  type LayoutPresetOptions,
} from "./formationLayouts";
import type { StagePosPct } from "./stageEffectivePosition";
import { retainDancerIdsInFormation } from "./stageEditMode";
import { clusterSelectionByDepthRows } from "./stageColumnSwap";

/**
 * Change の適用先。2人以上選択していればその人だけ。
 * 未選択・1人だけはこれまで通りフォーメーション全員。
 */
export function resolveChangeTargetIds(
  formationDancerIds: readonly string[],
  selectedIds: readonly string[]
): string[] {
  const live = retainDancerIdsInFormation(
    [...selectedIds],
    [...formationDancerIds]
  );
  if (live.length >= 2) return live;
  return [...formationDancerIds];
}

function isFullFormationTarget(
  dancers: readonly DancerSpot[],
  targetIds: readonly string[]
): boolean {
  if (dancers.length === 0) return true;
  if (targetIds.length !== dancers.length) return false;
  const set = new Set(targetIds);
  return dancers.every((d) => set.has(d.id));
}

function centroidOf(
  spots: readonly { xPct: number; yPct: number }[]
): { x: number; y: number } {
  const n = spots.length;
  if (n <= 0) return { x: 50, y: 50 };
  let x = 0;
  let y = 0;
  for (const s of spots) {
    x += s.xPct;
    y += s.yPct;
  }
  return { x: x / n, y: y / n };
}

function clampPct(v: number): number {
  return Math.min(
    DANCER_STAGE_POSITION_PCT_HI,
    Math.max(DANCER_STAGE_POSITION_PCT_LO, v)
  );
}

function translateSpotsByDelta(
  spots: readonly DancerSpot[],
  dx0: number,
  dy0: number
): DancerSpot[] {
  let dx = dx0;
  let dy = dy0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of spots) {
    minX = Math.min(minX, s.xPct + dx);
    maxX = Math.max(maxX, s.xPct + dx);
    minY = Math.min(minY, s.yPct + dy);
    maxY = Math.max(maxY, s.yPct + dy);
  }
  if (minX < DANCER_STAGE_POSITION_PCT_LO) {
    dx += DANCER_STAGE_POSITION_PCT_LO - minX;
  }
  if (maxX > DANCER_STAGE_POSITION_PCT_HI) {
    dx -= maxX - DANCER_STAGE_POSITION_PCT_HI;
  }
  if (minY < DANCER_STAGE_POSITION_PCT_LO) {
    dy += DANCER_STAGE_POSITION_PCT_LO - minY;
  }
  if (maxY > DANCER_STAGE_POSITION_PCT_HI) {
    dy -= maxY - DANCER_STAGE_POSITION_PCT_HI;
  }

  return spots.map((s) => ({
    ...s,
    xPct: clampPct(s.xPct + dx),
    yPct: clampPct(s.yPct + dy),
  }));
}

/**
 * 選択メンバーの今いる場所に形を寄せる。
 * bbox に縮めない（前列だけピラミッド、などに奥行きが要るため）。
 */
export function translateSpotsToMatchCentroid(
  spots: readonly DancerSpot[],
  reference: readonly { xPct: number; yPct: number }[]
): DancerSpot[] {
  if (spots.length === 0 || reference.length === 0) return [...spots];
  const from = centroidOf(spots);
  const to = centroidOf(reference);
  return translateSpotsByDelta(spots, to.x - from.x, to.y - from.y);
}

/**
 * 客席側の一列目（手前・y が大きい段）の重心。
 * 段が取れないときは全員の重心にフォールバック。
 */
export function frontRowCentroidOf(
  dancers: readonly DancerSpot[]
): { x: number; y: number } | null {
  if (dancers.length === 0) return null;
  const ids = dancers.map((d) => d.id);
  const rows = clusterSelectionByDepthRows([...dancers], ids);
  const front = rows[0] ?? [...dancers];
  if (front.length === 0) return null;
  return centroidOf(front);
}

/**
 * 新しい雛形の一列目を、参照（直前キューなど）の一列目の位置へ平行移動する。
 * ステージセンター基準の雛形を、前キューの前列位置ベースに寄せる。
 */
export function translateSpotsToMatchFrontRow(
  spots: readonly DancerSpot[],
  reference: readonly DancerSpot[]
): DancerSpot[] {
  if (spots.length === 0 || reference.length === 0) return [...spots];
  const from = frontRowCentroidOf(spots);
  const to = frontRowCentroidOf(reference);
  if (!from || !to) return [...spots];
  return translateSpotsByDelta(spots, to.x - from.x, to.y - from.y);
}

/**
 * 最短距離マッチ用の「前の立ち位置」。
 * matchSource にあればその座標を使い、身元は targets 側を保つ。
 */
export function resolveNearestMatchSpots(
  targets: readonly DancerSpot[],
  matchSource?: readonly DancerSpot[] | null
): DancerSpot[] {
  if (!matchSource || matchSource.length === 0) return [...targets];
  const byId = new Map(matchSource.map((d) => [d.id, d]));
  return targets.map((d) => {
    const src = byId.get(d.id);
    if (!src) return d;
    return { ...d, xPct: src.xPct, yPct: src.yPct };
  });
}

/**
 * 雛形スロットを最終位置へ寄せてから、前キュー座標に対して最短距離で人を割り当てる。
 * （先に割当してから平行移動すると、最終軌道が最短にならない）
 */
function placePresetWithShortestTravel(
  dancers: readonly DancerSpot[],
  targetIds: readonly string[],
  presetId: LayoutPresetId,
  opts?: LayoutPresetOptions,
  matchSource?: readonly DancerSpot[] | null
): DancerSpot[] | null {
  const idSet = new Set(targetIds);
  const targets = dancers.filter((d) => idSet.has(d.id));
  if (targets.length === 0) return null;

  const positioned = dancersForLayoutPreset(targets.length, presetId, opts);
  if (positioned.length === 0) return null;

  const full = isFullFormationTarget(dancers, targetIds);
  /** 全員適用かつ直前キューあり → 一列目位置へ寄せたスロットで最短割当 */
  const slots =
    full && matchSource && matchSource.length > 0
      ? translateSpotsToMatchFrontRow(positioned, matchSource)
      : positioned;

  const matchSpots = resolveNearestMatchSpots(targets, matchSource);
  const assigned = transferDancerIdentitiesByNearestPosition(slots, matchSpots);

  if (full) return assigned;
  /** 部分適用は選択メンバーの今の重心へ寄せる（割当後） */
  return translateSpotsToMatchCentroid(assigned, targets);
}

/**
 * 雛形を targetIds にだけ当てる。配列順と未選択の座標は変えない。
 * matchSource（直前キュー）があるとき、最終スロット位置へ寄せたうえで
 * 前の立ち位置から最短距離（Hungarian）で人を割り当てる。
 */
export function applyLayoutPresetToTargetDancers(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  presetId: LayoutPresetId,
  opts?: LayoutPresetOptions,
  matchSource?: readonly DancerSpot[] | null
): DancerSpot[] {
  if (dancers.length === 0) return dancers;
  const placed = placePresetWithShortestTravel(
    dancers,
    targetIds,
    presetId,
    opts,
    matchSource
  );
  if (!placed) return dancers;
  const byId = new Map(placed.map((d) => [d.id, d]));
  return dancers.map((d) => {
    const next = byId.get(d.id);
    if (!next) return d;
    return { ...d, xPct: next.xPct, yPct: next.yPct };
  });
}

/**
 * 形プレビュー用。配列順は変えない。id → 新座標だけ返す。
 */
export function layoutPresetPositionsById(
  dancers: readonly DancerSpot[],
  targetIds: readonly string[],
  presetId: LayoutPresetId,
  opts?: LayoutPresetOptions,
  matchSource?: readonly DancerSpot[] | null
): Map<string, StagePosPct> {
  const positions = new Map<string, StagePosPct>();
  const placed = placePresetWithShortestTravel(
    dancers,
    targetIds,
    presetId,
    opts,
    matchSource
  );
  if (!placed) return positions;
  for (const d of placed) {
    positions.set(d.id, { xPct: d.xPct, yPct: d.yPct });
  }
  return positions;
}
