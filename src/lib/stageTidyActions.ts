import type { StageEditMode } from "./stageEditMode";
import {
  alignSelectedDancers,
  distributeSelectedDancers,
  type SelectionAlignEdge,
  type SelectionDistributeAxis,
} from "./stageSelectionTransform";
import type { DancerSpot } from "../types/choreography";
import type { StagePosPct } from "./stageEffectivePosition";

export type StageTidyAction = {
  id:
    | "align-row"
    | "align-col"
    | "distribute-x"
    | "distribute-y"
    | "center-x"
    | "center-y";
  label: string;
} & (
  | { kind: "align"; edge: SelectionAlignEdge }
  | { kind: "distribute"; axis: SelectionDistributeAxis }
);

/**
 * 振付家向けの6操作。座標計算は既存 align / distribute のまま。
 * 横にそろえる = Y を選択範囲の上下中央へ（Xは維持）。
 * 縦にそろえる = X を選択範囲の左右中央へ（Yは維持）。
 */
export const STAGE_TIDY_ACTIONS: readonly StageTidyAction[] = [
  { id: "align-row", label: "横にそろえる", kind: "align", edge: "centerY" },
  { id: "align-col", label: "縦にそろえる", kind: "align", edge: "centerX" },
  { id: "distribute-x", label: "等間隔（横）", kind: "distribute", axis: "x" },
  { id: "distribute-y", label: "等間隔（縦）", kind: "distribute", axis: "y" },
  { id: "center-x", label: "中央（左右）", kind: "align", edge: "centerX" },
  { id: "center-y", label: "中央（上下）", kind: "align", edge: "centerY" },
];

export function isStageTidyAvailable(mode: StageEditMode): boolean {
  return mode === "group" || mode === "formation";
}

export function applyStageTidyAction(
  dancers: DancerSpot[],
  targetIds: readonly string[],
  actionId: StageTidyAction["id"]
): DancerSpot[] {
  const action = STAGE_TIDY_ACTIONS.find((a) => a.id === actionId);
  if (!action) return dancers;
  if (action.kind === "align") {
    return alignSelectedDancers(dancers, targetIds, action.edge);
  }
  return distributeSelectedDancers(dancers, targetIds, action.axis);
}

export function tidyActionLabel(actionId: StageTidyAction["id"]): string {
  return STAGE_TIDY_ACTIONS.find((a) => a.id === actionId)?.label ?? "整える";
}

export type TidyPreviewDraft = {
  actionId: StageTidyAction["id"];
  label: string;
  positions: Map<string, StagePosPct>;
};

/**
 * 永続 dancers は変えない。変わった id の座標だけ返す。
 * 変化がなければ null（呼び出し側は既存ドラフトを残す／何もしない）。
 */
export function draftTidyPreview(
  dancers: readonly DancerSpot[],
  targetIds: readonly string[],
  actionId: StageTidyAction["id"]
): TidyPreviewDraft | null {
  const action = STAGE_TIDY_ACTIONS.find((a) => a.id === actionId);
  if (!action) return null;
  const next = applyStageTidyAction([...dancers], targetIds, actionId);
  const prevById = new Map(dancers.map((d) => [d.id, d] as const));
  const positions = new Map<string, StagePosPct>();
  for (const d of next) {
    const prev = prevById.get(d.id);
    if (!prev) continue;
    if (prev.xPct === d.xPct && prev.yPct === d.yPct) continue;
    positions.set(d.id, { xPct: d.xPct, yPct: d.yPct });
  }
  if (positions.size === 0) return null;
  return { actionId, label: action.label, positions };
}
