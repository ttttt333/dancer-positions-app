import type { PointerEventHandler } from "react";
import {
  STAGE_AUX_HANDLE_CORNER_OFFSET_PX,
  stageAuxHandleHitStyle,
  stageAuxHandleVisualStyle,
} from "../lib/stageSelectionAuxHandleStyles";

export type StagePrimaryMarkerResizeHandleProps = {
  xPct: number;
  yPct: number;
  facingDeg: number;
  markerPx: number;
  /** 2 以上なら一括リサイズ用のツールチップ */
  selectedCount: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
};

/** 1 人選択時：印の右下の黄四角（複数選択は StageGroupSelectionBox 側） */
export function StagePrimaryMarkerResizeHandle({
  xPct,
  yPct,
  facingDeg,
  markerPx,
  selectedCount,
  onPointerDown,
}: StagePrimaryMarkerResizeHandleProps) {
  const resizeTip =
    selectedCount >= 2
      ? `選択中の ${selectedCount} 人の ○ サイズを一括変更（基準 ${markerPx}px・ドラッグで変更）`
      : `○ のサイズ（${markerPx}px）・ドラッグで変更`;
  const inset = Math.round(markerPx / 2) + 14;
  const o = STAGE_AUX_HANDLE_CORNER_OFFSET_PX;

  return (
    <div
      role="presentation"
      aria-hidden
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: `translate(-50%, -50%) rotate(${facingDeg}deg)`,
        width: 0,
        height: 0,
        zIndex: 14,
        pointerEvents: "none",
      }}
    >
      <div
        data-marker-resize-handle
        title={resizeTip}
        onPointerDown={onPointerDown}
        style={{
          position: "absolute",
          left: `calc(50% + ${inset}px + ${o}px)`,
          top: `calc(50% + ${inset}px + ${o}px)`,
          transform: "translate(-50%, -50%)",
          zIndex: 14,
          ...stageAuxHandleHitStyle("nwse-resize"),
        }}
      >
        <span aria-hidden style={stageAuxHandleVisualStyle("#fbbf24")} />
      </div>
    </div>
  );
}
