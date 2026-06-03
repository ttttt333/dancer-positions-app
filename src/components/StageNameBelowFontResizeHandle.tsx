import type { PointerEventHandler } from "react";
import {
  STAGE_AUX_HANDLE_CORNER_OFFSET_PX,
  stageAuxHandleHitStyle,
  stageAuxHandleVisualStyle,
} from "../lib/stageSelectionAuxHandleStyles";

export type StageNameBelowFontResizeHandleProps = {
  /** 床 pct 座標（ダンサー中心） */
  xPct: number;
  yPct: number;
  markerPx?: number;
  selectedCount: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
};

/** 1 人選択時：ダンサー左上付近の青四角（複数選択は StageGroupSelectionBox 側） */
export function StageNameBelowFontResizeHandle({
  xPct,
  yPct,
  markerPx = 24,
  selectedCount,
  onPointerDown,
}: StageNameBelowFontResizeHandleProps) {
  const title =
    selectedCount >= 2
      ? `選択中 ${selectedCount} 人の名前サイズを変更（上下ドラッグ）`
      : "名前のサイズを変更（上下ドラッグ）";
  const inset = Math.round(markerPx / 2) + 14;
  const o = STAGE_AUX_HANDLE_CORNER_OFFSET_PX;
  const left = `calc(${xPct}% - ${inset}px - ${o}px)`;
  const top = `calc(${yPct}% - ${inset}px - ${o}px)`;

  return (
    <div
      role="presentation"
      aria-hidden
      data-name-below-font-handle
      title={title}
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        left,
        top,
        transform: "translate(-50%, -50%)",
        zIndex: 15,
        ...stageAuxHandleHitStyle("ns-resize"),
      }}
    >
      <span aria-hidden style={stageAuxHandleVisualStyle("#3b82f6")} />
    </div>
  );
}
