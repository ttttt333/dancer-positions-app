import type { StudentPick } from "../../components/ChoreoStudentViewGate";
import {
  EDITOR_GRID_GAP_PX,
  STAGE_COL_MIN_PX,
  STAGE_RESIZER_PX,
  TIMELINE_FULL_COL_MIN_PX,
} from "./editorConstants";

export function round2Pct(n: number): number {
  return Math.round(n * 100) / 100;
}

export function studentPickToStageFocus(
  p: StudentPick
):
  | { kind: "all" }
  | { kind: "one"; crewMemberId: string; label: string } {
  if (p.kind === "all") {
    return { kind: "all" };
  }
  return { kind: "one", crewMemberId: p.id, label: p.label };
}

/**
 * ステージ列の最大幅（px）。
 * 右列の最小幅＋列間ギャップ＋リサイザを除いた残りまで許可する。
 *
 * 幅の基準: `gridEl.getBoundingClientRect().width`（レイアウト後の要素 border box）。
 * ビューポート判定は `readLayoutViewportSize` を使うこと。
 */
export function readMaxStageWidthPx(
  gridEl: HTMLElement,
  minRightColPx: number = TIMELINE_FULL_COL_MIN_PX
): number {
  const rect = gridEl.getBoundingClientRect();
  const cs = getComputedStyle(gridEl);
  const padX =
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const gap =
    parseFloat(cs.columnGap) ||
    parseFloat(cs.rowGap) ||
    parseFloat(cs.gap) ||
    EDITOR_GRID_GAP_PX;
  const gapsBetween3Cols = 2 * gap;
  const inner = rect.width - padX - gapsBetween3Cols - STAGE_RESIZER_PX;
  const maxStage = inner - minRightColPx;
  return Math.max(STAGE_COL_MIN_PX, Math.floor(maxStage));
}
