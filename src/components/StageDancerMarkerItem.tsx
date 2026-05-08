import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

export type StageDancerMarkerItemProps = {
  dancerId: string;
  xPct: number;
  yPct: number;
  nameBelowLabel: string;
  pivotTransform: string;
  zMark: number;
  playbackOrPreview: boolean;
  /** 生徒閲覧「1人」で、対象外のときの薄さ */
  pivotOpacityDimmed: boolean;
  buttonTitle?: string;
  onPointerDownButton: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onContextMenuButton: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onDoubleClickButton: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  halfMarker: number;
  markerPx: number;
  borderCss: string;
  fillHex: string;
  labelFontPx: number;
  cursorCss: string;
  pointerEventsCss: "auto" | "none";
  boxShadowCss: string;
  scaleTransform: string;
  hideGlyph: boolean;
  circleLabel: ReactNode;
  screenUnrotateDeg: number;
  showNameBelow: boolean;
  labelOffsetPx: number;
  belowLabelOriginYpx: number;
  belowNameFontPx: number;
};

/** ステージ上のダンサー印 1 人分（位置・回転・○内／名下） */
export function StageDancerMarkerItem({
  dancerId,
  xPct,
  yPct,
  nameBelowLabel,
  pivotTransform,
  zMark,
  playbackOrPreview,
  pivotOpacityDimmed,
  buttonTitle,
  onPointerDownButton,
  onContextMenuButton,
  onDoubleClickButton,
  halfMarker,
  markerPx,
  borderCss,
  fillHex,
  labelFontPx,
  cursorCss,
  pointerEventsCss,
  boxShadowCss,
  scaleTransform,
  hideGlyph,
  circleLabel,
  screenUnrotateDeg,
  showNameBelow,
  labelOffsetPx,
  belowLabelOriginYpx,
  belowNameFontPx,
}: StageDancerMarkerItemProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: pivotTransform,
        transformOrigin: "center center",
        width: 0,
        height: 0,
        zIndex: zMark,
        pointerEvents: "none",
        willChange: playbackOrPreview ? "transform" : undefined,
        opacity: pivotOpacityDimmed ? 0.38 : 1,
        transition: "opacity 200ms ease",
      }}
    >
      <button
        type="button"
        data-dancer-id={dancerId}
        title={buttonTitle}
        onPointerDown={onPointerDownButton}
        onContextMenu={onContextMenuButton}
        onDoubleClick={onDoubleClickButton}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          marginLeft: -halfMarker,
          marginTop: -halfMarker,
          width: `${markerPx}px`,
          height: `${markerPx}px`,
          borderRadius: "50%",
          border: borderCss,
          backgroundColor: fillHex,
          color: "#0f172a",
          fontWeight: 700,
          fontSize: `${labelFontPx}px`,
          cursor: cursorCss,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: boxShadowCss,
          transform: scaleTransform,
          padding: 0,
          userSelect: "none",
          pointerEvents: pointerEventsCss,
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
      </button>
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
