import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import {
  dancersForLayoutPreset,
  transferDancerIdentitiesByNearestPosition,
  transferDancerIdentitiesByOrder,
  type LayoutPresetId,
  type LayoutPresetOptions,
} from "./formationLayouts";
import { retainDancerIdsInFormation } from "./stageEditMode";

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
  let dx = to.x - from.x;
  let dy = to.y - from.y;

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
 * 雛形を targetIds にだけ当てる。配列順と未選択の座標は変えない。
 * 全員対象のときは既存 Change と同じ（順番で identity を載せる）。
 */
export function applyLayoutPresetToTargetDancers(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  presetId: LayoutPresetId,
  opts?: LayoutPresetOptions
): DancerSpot[] {
  if (dancers.length === 0) return dancers;
  const idSet = new Set(targetIds);
  const targets = dancers.filter((d) => idSet.has(d.id));
  if (targets.length === 0) return dancers;

  const positioned = dancersForLayoutPreset(targets.length, presetId, opts);
  if (positioned.length === 0) return dancers;

  if (isFullFormationTarget(dancers, targetIds)) {
    return transferDancerIdentitiesByOrder(positioned, dancers);
  }

  const assigned = transferDancerIdentitiesByNearestPosition(
    positioned,
    targets
  );
  const placed = translateSpotsToMatchCentroid(assigned, targets);
  const byId = new Map(placed.map((d) => [d.id, d]));
  return dancers.map((d) => {
    const next = byId.get(d.id);
    if (!next) return d;
    return { ...d, xPct: next.xPct, yPct: next.yPct };
  });
}
