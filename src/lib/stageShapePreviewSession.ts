import type { DancerSpot } from "../types/choreography";
import type { StagePosPct } from "./stageEffectivePosition";
import {
  applyShapePositionsToDancers,
  STAGE_SHAPE_PRESETS,
  tryGenerateShapePreview,
  type ShapeGeneratorInput,
  type StageShapePresetId,
} from "./stageShapeGenerator";

export type ShapePreviewDraft = {
  presetId: StageShapePresetId;
  positions: Map<string, StagePosPct>;
  movementCostPct: number;
};

export type ShapeMovementGrade = "小" | "中" | "大";

export type ShapePreviewEscAction = "close-picker" | "cancel-draft" | "none";

/** プレビュー中の形ラベル。geometry は触らない。 */
export function shapePreviewLabel(presetId: StageShapePresetId): string {
  return STAGE_SHAPE_PRESETS.find((p) => p.id === presetId)?.label ?? "形";
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
  if (avg < 8) return "小";
  if (avg < 25) return "中";
  return "大";
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

/** Apply 1回。中間ドラフトはここを通さない。 */
export function applyShapePreviewDraft(
  dancers: DancerSpot[],
  draft: ShapePreviewDraft | null
): DancerSpot[] {
  if (!draft || draft.positions.size === 0) return dancers;
  return applyShapePositionsToDancers(dancers, draft.positions);
}
