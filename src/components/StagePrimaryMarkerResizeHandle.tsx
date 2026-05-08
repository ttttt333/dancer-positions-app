import type { PointerEventHandler } from "react";

export type StagePrimaryMarkerResizeHandleProps = {
  xPct: number;
  yPct: number;
  facingDeg: number;
  markerPx: number;
  /** 2 以上なら一括リサイズ用のツールチップ */
  selectedCount: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
};

/** 主選択ダンサー印の右下リサイズハンドル（回転ハンドルは別） */
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
      ? `選択中の ${selectedCount} 人の ○ サイズを一括変更（現 ${markerPx}px・ドラッグで変更）`
      : `○のサイズ（${markerPx}px）・ドラッグで変更`;
  const handleOffset = Math.round(markerPx / 2) + 14;

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
      {/* 1人選択時の回転ハンドルは非表示（ユーザー要望） */}
      <div
        data-marker-resize-handle
        title={resizeTip}
        onPointerDown={onPointerDown}
        style={{
          position: "absolute",
          left: `calc(50% + ${handleOffset}px)`,
          top: `calc(50% + ${handleOffset}px)`,
          transform: "translate(-50%, -50%)",
          width: 12,
          height: 12,
          borderRadius: 3,
          background: "#fbbf24",
          border: "1px solid #0f172a",
          boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
          cursor: "nwse-resize",
          touchAction: "none",
          pointerEvents: "auto",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
