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
  const bulk = selectedCount >= 2;
  const resizeTip = bulk
    ? `選択中の ${selectedCount} 人の ○ サイズを一括変更（現 ${markerPx}px・ドラッグで変更）`
    : `○のサイズ（${markerPx}px）・ドラッグで変更`;
  const handleOffset = Math.round(markerPx / 2) + (bulk ? 18 : 14);
  const visualSize = bulk ? 16 : 14;
  const hitSize = bulk ? 44 : 36;

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
        zIndex: bulk ? 20 : 14,
        pointerEvents: "none",
      }}
    >
      <div
        data-marker-resize-handle
        title={resizeTip}
        onPointerDown={onPointerDown}
        style={{
          position: "absolute",
          left: `calc(50% + ${handleOffset}px)`,
          top: `calc(50% + ${handleOffset}px)`,
          transform: "translate(-50%, -50%)",
          width: hitSize,
          height: hitSize,
          borderRadius: Math.max(6, visualSize / 2),
          background: "transparent",
          cursor: "nwse-resize",
          touchAction: "none",
          pointerEvents: "auto",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: visualSize,
            height: visualSize,
            borderRadius: 4,
            background: "#fbbf24",
            border: "2px solid #0f172a",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
