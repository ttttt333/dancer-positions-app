import type { DancerSpot } from "../types/choreography";
import {
  DANCER_STAGE_POSITION_PCT_HI,
  DANCER_STAGE_POSITION_PCT_LO,
} from "./dancerSpacing";
import {
  dancersForLayoutPreset,
  type LayoutPresetId,
  type LayoutPresetOptions,
} from "./formationLayouts";
import { minCostBipartiteAssignment } from "./minCostAssignment";
import type { StagePosPct } from "./stageEffectivePosition";

/** Phase 4-B で使う形。座標は既存 formationLayouts から取る。 */
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

function clampStagePct(v: number): number {
  return Math.max(
    DANCER_STAGE_POSITION_PCT_LO,
    Math.min(DANCER_STAGE_POSITION_PCT_HI, v)
  );
}

/** 既存プリセットから座標スロットだけ取り出す（identity は捨てる） */
export function generateShapeSlots(
  count: number,
  presetId: StageShapePresetId,
  layoutOpts?: LayoutPresetOptions
): StagePosPct[] {
  if (count <= 0) return [];
  return dancersForLayoutPreset(count, presetId as LayoutPresetId, layoutOpts).map(
    (d) => ({
      xPct: clampStagePct(d.xPct),
      yPct: clampStagePct(d.yPct),
    })
  );
}

export function movementCostPct(from: StagePosPct, to: StagePosPct): number {
  const dx = from.xPct - to.xPct;
  const dy = from.yPct - to.yPct;
  return Math.hypot(dx, dy);
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
 * 形状スロット生成 → 最小移動割当 → 評価（movementCostPct）。
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
