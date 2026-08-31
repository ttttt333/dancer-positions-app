import type { DancerSpot } from "../types/choreography";
import type { StagePosPct } from "./stageEffectivePosition";
import {
  layoutPresetPositionsById,
  resolveChangeTargetIds,
} from "./applyLayoutPresetToSelection";
import { LAYOUT_PRESET_LABELS, type LayoutPresetId } from "./formationLayouts";
import {
  applyShapePositionsToDancers,
  movementCostPct,
  STAGE_SHAPE_PRESETS,
  tryGenerateShapePreview,
  type ShapeGeneratorInput,
} from "./stageShapeGenerator";
import {
  classifyMovementCostPct,
  type MovementGrade,
} from "./stageMovementGrade";

export type ShapePreviewDraft = {
  presetId: string;
  positions: Map<string, StagePosPct>;
  movementCostPct: number;
};

export type ShapeMovementGrade = MovementGrade;

export type ShapePreviewEscAction = "close-picker" | "cancel-draft" | "none";

/** プレビュー中の形ラベル。geometry は触らない。 */
export function shapePreviewLabel(presetId: string): string {
  const gen = STAGE_SHAPE_PRESETS.find((p) => p.id === presetId);
  if (gen) return gen.label;
  const layout = LAYOUT_PRESET_LABELS[presetId as LayoutPresetId];
  return layout ?? "形";
}

/**
 * 現在ドラフトの movementCostPct を 小/中/大 にする。
 * 割り当て計算自体は既存 generateShapePreview の値を使う。
 */
export function classifyShapeMovementCost(
  totalCostPct: number,
  dancerCount: number
): ShapeMovementGrade {
  const avg = dancerCount <= 0 ? 0 : totalCostPct / dancerCount;
  return classifyMovementCostPct(avg);
}

/**
 * 形カード / Preview 中の Esc。
 * ピッカーが開いていれば閉じるだけ。ドラフトがあれば取消。選択解除はしない。
 */
export function resolveShapePreviewEsc(args: {
  pickerOpen: boolean;
  draftActive: boolean;
}): ShapePreviewEscAction {
  if (args.pickerOpen) return "close-picker";
  if (args.draftActive) return "cancel-draft";
  return "none";
}

/**
 * 永続 dancers からドラフトを作る。Project は変更しない。
 * 失敗時は null（呼び出し側は既存ドラフトを残す）。
 */
export function draftShapePreview(
  input: ShapeGeneratorInput
): { draft: ShapePreviewDraft; ignoredSpacing: boolean } | null {
  const outcome = tryGenerateShapePreview(input);
  if (!outcome.ok || outcome.result.positions.size === 0) return null;
  return {
    draft: {
      presetId: input.presetId,
      positions: outcome.result.positions,
      movementCostPct: outcome.result.movementCostPct,
    },
    ignoredSpacing: outcome.ignoredSpacing,
  };
}

/** Change と同じ雛形。選択 2人以上ならその人だけ。配列順は変えない。 */
export function draftLayoutPresetPreview(input: {
  dancers: readonly DancerSpot[];
  selectedIds: readonly string[];
  presetId: LayoutPresetId;
  layoutOpts?: ShapeGeneratorInput["layoutOpts"];
}): ShapePreviewDraft | null {
  const targetIds = resolveChangeTargetIds(
    input.dancers.map((d) => d.id),
    input.selectedIds
  );
  const positions = layoutPresetPositionsById(
    input.dancers,
    targetIds,
    input.presetId,
    input.layoutOpts
  );
  if (positions.size === 0) return null;
  const prevById = new Map(input.dancers.map((d) => [d.id, d] as const));
  let cost = 0;
  for (const [id, pos] of positions) {
    const prev = prevById.get(id);
    if (!prev) continue;
    cost += movementCostPct(prev, pos);
  }
  return {
    presetId: input.presetId,
    positions,
    movementCostPct: cost,
  };
}

/** Apply 1回。中間ドラフトはここを通さない。 */
export function applyShapePreviewDraft(
  dancers: DancerSpot[],
  draft: ShapePreviewDraft | null
): DancerSpot[] {
  if (!draft || draft.positions.size === 0) return dancers;
  return applyShapePositionsToDancers(dancers, draft.positions);
}
