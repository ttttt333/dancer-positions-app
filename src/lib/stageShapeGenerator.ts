import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
  dancerStepPctFromSpacingMm,
} from "./dancerSpacing";
import {
  dancersForLayoutPreset,
  type LayoutPresetId,
  type LayoutPresetOptions,
} from "./formationLayouts";
import { minCostBipartiteAssignment } from "./minCostAssignment";
import type { StagePosPct } from "./stageEffectivePosition";

/** Phase 4-B で使う形。line 系は既存 formationLayouts、vee は専用 geometry。 */
export const STAGE_SHAPE_PRESETS = [
  { id: "line", label: "横一列" },
  { id: "line_vertical", label: "縦一列" },
  { id: "vee", label: "V字" },
] as const;

export type StageShapePresetId = (typeof STAGE_SHAPE_PRESETS)[number]["id"];

export type ShapeGeneratorInput = {
  dancers: readonly DancerSpot[];
  selectedIds: readonly string[];
  presetId: StageShapePresetId;
  layoutOpts?: LayoutPresetOptions;
};

export type ShapeGeneratorResult = {
  positions: Map<string, StagePosPct>;
  /** ステージ％での移動距離合計（評価用。UI 表示は任意） */
  movementCostPct: number;
};

/**
 * 形ごとの配置枠。y は既存ステージと同じく大きいほど客席側。
 * 将来の W / 円 / 三角も count + bbox + minSpacing から slot を出す。
 */
export type ShapeGeometry = {
  x0: number;
  x1: number;
  /** 奥（客席から遠い） */
  y0: number;
  /** 手前（客席側） */
  y1: number;
  minSpacingPct: number;
};

/** FORMATION SHAPE 用 V。既存 formationLayouts の vee とは独立。 */
export const SHAPE_VEE_BBOX = {
  x0: 20,
  x1: 80,
  y0: 30,
  y1: 68,
} as const;

const DEFAULT_MIN_SPACING_PCT = 8;
/** 同一座標とみなす距離（％）。slot validation 用 */
const SLOT_DUP_EPS_PCT = 0.35;

function clampStagePct(v: number): number {
  return Math.max(
    DANCER_STAGE_POSITION_PCT_LO,
    Math.min(DANCER_STAGE_POSITION_PCT_HI, v)
  );
}

function resolveMinSpacingPct(layoutOpts?: LayoutPresetOptions): number {
  const fromMm = dancerStepPctFromSpacingMm(
    layoutOpts?.dancerSpacingMm,
    layoutOpts?.stageWidthMm
  );
  if (fromMm != null && fromMm > 0) return fromMm;
  return DEFAULT_MIN_SPACING_PCT;
}

export function movementCostPct(from: StagePosPct, to: StagePosPct): number {
  const dx = from.xPct - to.xPct;
  const dy = from.yPct - to.yPct;
  return Math.hypot(dx, dy);
}

export function shapeSlotsOverlap(
  slots: readonly StagePosPct[],
  minDistPct = SLOT_DUP_EPS_PCT
): boolean {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (movementCostPct(slots[i]!, slots[j]!) < minDistPct) return true;
    }
  }
  return false;
}

/**
 * slot 数・範囲・重複を検証する。壊れていれば例外（UI より先にテストで落とす）。
 */
export function validateShapeSlots(
  slots: readonly StagePosPct[],
  expectedCount: number
): StagePosPct[] {
  if (slots.length !== expectedCount) {
    throw new Error(
      `shape slot count ${slots.length} !== expected ${expectedCount}`
    );
  }
  const next = slots.map((s) => ({
    xPct: clampStagePct(s.xPct),
    yPct: clampStagePct(s.yPct),
  }));
  for (const s of next) {
    if (!Number.isFinite(s.xPct) || !Number.isFinite(s.yPct)) {
      throw new Error("shape slot is not finite");
    }
  }
  if (shapeSlotsOverlap(next)) {
    throw new Error("shape slots overlap");
  }
  return next;
}

/**
 * 奇数: 客席側に独立した中央 1 slot。そこから奥へ左右対称に開く。
 * 偶数: 先端は中央 1 人ではなく、客席側の 2 人が独立 slot。
 */
export function generateVeeSlots(
  count: number,
  geometry: ShapeGeometry
): StagePosPct[] {
  if (count <= 0) return [];
  const cx = (geometry.x0 + geometry.x1) / 2;
  const frontY = geometry.y1;
  const maxHalfW = (geometry.x1 - geometry.x0) / 2;
  const minSp = Math.max(3, geometry.minSpacingPct);
  const maxDepth = Math.max(8, frontY - geometry.y0);

  if (count === 1) {
    return [{ xPct: clampStagePct(cx), yPct: clampStagePct((geometry.y0 + frontY) / 2) }];
  }

  const odd = count % 2 === 1;
  const rows = odd ? (count + 1) / 2 : count / 2;
  const gaps = Math.max(1, rows - 1);
  const frontHalf = odd ? 0 : Math.max(minSp / 2, 4);
  const openPerRow = Math.max(minSp * 0.9, 7);
  const rowStep = Math.max(minSp * 0.85, 7);
  const minBackHalf = odd ? 14 : Math.max(14, frontHalf + 8);
  const minDepth = 16;

  let backHalf = Math.min(
    maxHalfW,
    Math.max(minBackHalf, frontHalf + openPerRow * gaps)
  );
  if (backHalf < frontHalf + 0.8) {
    backHalf = Math.min(maxHalfW, frontHalf + 0.8);
  }
  let depth = Math.min(maxDepth, Math.max(minDepth, rowStep * gaps));

  const slots: StagePosPct[] = [];
  for (let r = 0; r < rows; r++) {
    const t = rows === 1 ? 0 : r / gaps;
    const y = frontY - t * depth;
    const half = frontHalf + t * (backHalf - frontHalf);
    if (odd && r === 0) {
      slots.push({ xPct: clampStagePct(cx), yPct: clampStagePct(y) });
    } else {
      slots.push({
        xPct: clampStagePct(cx - half),
        yPct: clampStagePct(y),
      });
      slots.push({
        xPct: clampStagePct(cx + half),
        yPct: clampStagePct(y),
      });
    }
  }
  return slots;
}

function generateLineSlotsFromPreset(
  count: number,
  presetId: Exclude<StageShapePresetId, "vee">,
  layoutOpts?: LayoutPresetOptions
): StagePosPct[] {
  return dancersForLayoutPreset(count, presetId as LayoutPresetId, layoutOpts).map(
    (d) => ({
      xPct: clampStagePct(d.xPct),
      yPct: clampStagePct(d.yPct),
    })
  );
}

/** 座標スロットだけ。identity は持たない。vee は既存プリセットを使わない。 */
export function generateShapeSlots(
  count: number,
  presetId: StageShapePresetId,
  layoutOpts?: LayoutPresetOptions
): StagePosPct[] {
  if (count <= 0) return [];
  const raw =
    presetId === "vee"
      ? generateVeeSlots(count, {
          ...SHAPE_VEE_BBOX,
          minSpacingPct: resolveMinSpacingPct(layoutOpts),
        })
      : generateLineSlotsFromPreset(count, presetId, layoutOpts);
  return validateShapeSlots(raw, count);
}

/**
 * 選択中の現在位置とスロットの最小費用割当。
 * 配列順は変えない。戻りは id → 新座標。
 */
export function assignSlotsByMinMovement(
  selected: readonly DancerSpot[],
  slots: readonly StagePosPct[]
): { positions: Map<string, StagePosPct>; movementCostPct: number } {
  const positions = new Map<string, StagePosPct>();
  if (selected.length === 0 || slots.length === 0) {
    return { positions, movementCostPct: 0 };
  }

  const n = Math.min(selected.length, slots.length);
  const cost: number[][] = [];
  for (let i = 0; i < n; i++) {
    const from = selected[i]!;
    const row: number[] = [];
    for (let j = 0; j < slots.length; j++) {
      row.push(movementCostPct(from, slots[j]!));
    }
    cost.push(row);
  }

  const assignment = minCostBipartiteAssignment(cost);
  let total = 0;
  for (let i = 0; i < assignment.length; i++) {
    const slotIndex = assignment[i]!;
    if (slotIndex < 0) continue;
    const slot = slots[slotIndex];
    const dancer = selected[i];
    if (!slot || !dancer) continue;
    positions.set(dancer.id, slot);
    total += cost[i]![slotIndex]!;
  }

  return { positions, movementCostPct: total };
}

/**
 * Shape Generator。UI も将来の AI もこの関数だけを呼ぶ。
 * 形状スロット → validation → 最小移動割当 → 評価（movementCostPct）。
 * 永続データは変更しない。xPct/yPct の Map だけ返す。
 */
export function generateShapePreview(
  input: ShapeGeneratorInput
): ShapeGeneratorResult {
  const idSet = new Set(input.selectedIds);
  const selected = input.dancers.filter((d) => idSet.has(d.id));
  const slots = generateShapeSlots(
    selected.length,
    input.presetId,
    input.layoutOpts
  );
  return assignSlotsByMinMovement(selected, slots);
}

export function applyShapePositionsToDancers(
  dancers: DancerSpot[],
  positions: ReadonlyMap<string, StagePosPct>
): DancerSpot[] {
  if (positions.size === 0) return dancers;
  return dancers.map((d) => {
    const pos = positions.get(d.id);
    if (!pos) return d;
    return { ...d, xPct: pos.xPct, yPct: pos.yPct };
  });
}
