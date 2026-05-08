import type { ReactNode } from "react";

export type StageDancerDragGhostItemProps = {
  xPct: number;
  yPct: number;
  pivotTransform: string;
  halfMarker: number;
  markerPx: number;
  fillHex: string;
  labelFontPx: number;
  hideGlyph: boolean;
  circleLabel: ReactNode;
  screenUnrotateDeg: number;
  showNameBelow: boolean;
  labelOffsetPx: number;
  belowLabelOriginYpx: number;
  belowNameFontPx: number;
  nameBelowLabel: string;
};

/** ドラッグ開始位置の薄いゴースト印（本印の手前に重ねる） */
export function StageDancerDragGhostItem({
  xPct,
  yPct,
  pivotTransform,
  halfMarker,
  markerPx,
  fillHex,
  labelFontPx,
  hideGlyph,
  circleLabel,
  screenUnrotateDeg,
  showNameBelow,
  labelOffsetPx,
  belowLabelOriginYpx,
  belowNameFontPx,
  nameBelowLabel,
}: StageDancerDragGhostItemProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: pivotTransform,
        transformOrigin: "center center",
        width: 0,
        height: 0,
        zIndex: 3,
        pointerEvents: "none",
        opacity: 0.38,
        filter: "grayscale(0.15)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          marginLeft: -halfMarker,
          marginTop: -halfMarker,
          width: `${markerPx}px`,
          height: `${markerPx}px`,
          borderRadius: "50%",
          border: "2px dashed rgba(255,255,255,0.45)",
          backgroundColor: fillHex,
          color: "#0f172a",
          fontWeight: 700,
          fontSize: `${labelFontPx}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          userSelect: "none",
        }}
      >
        {!hideGlyph ? (
          <span
            style={{
              position: "relative",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `rotate(${screenUnrotateDeg}deg)`,
              transformOrigin: "center center",
            }}
          >
            {circleLabel}
          </span>
        ) : null}
      </div>
      {showNameBelow ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, calc(-50% + ${labelOffsetPx}px)) rotate(${screenUnrotateDeg}deg)`,
            transformOrigin: `50% ${belowLabelOriginYpx}px`,
            color: "#f8fafc",
            fontSize: `${belowNameFontPx}px`,
            fontWeight: 700,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.85)",
            userSelect: "none",
            maxWidth: "120px",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {nameBelowLabel}
        </div>
      ) : null}
    </div>
  );
}
