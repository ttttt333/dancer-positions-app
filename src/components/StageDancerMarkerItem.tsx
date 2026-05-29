import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";

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
  circleInnerLabelSpanStyle?: CSSProperties;
  screenUnrotateDeg: number;
  showNameBelow: boolean;
  labelOffsetPx: number;
  belowLabelOriginYpx: number;
  belowNameFontPx: number;
  /** 個人閲覧モードで自分自身のマーカーのとき true */
  isStudentHighlight?: boolean;
  /** 個人閲覧モード（1人フォーカス）が有効なとき true */
  onePersonMode?: boolean;
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
  circleInnerLabelSpanStyle,
  screenUnrotateDeg,
  showNameBelow,
  labelOffsetPx,
  belowLabelOriginYpx,
  belowNameFontPx,
  isStudentHighlight = false,
  onePersonMode = false,
}: StageDancerMarkerItemProps) {
  const pulseRingSize = markerPx + 14;

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
      {/* 個人閲覧：パルスリング */}
      {onePersonMode && isStudentHighlight && (
        <>
          <style>{`
            @keyframes _choreo_pulse {
              0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.7; }
              70%  { transform: translate(-50%, -50%) scale(1.55); opacity: 0; }
              100% { transform: translate(-50%, -50%) scale(1.55); opacity: 0; }
            }
            @keyframes _choreo_pulse2 {
              0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.45; }
              70%  { transform: translate(-50%, -50%) scale(1.9); opacity: 0; }
              100% { transform: translate(-50%, -50%) scale(1.9); opacity: 0; }
            }
          `}</style>
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: pulseRingSize,
              height: pulseRingSize,
              borderRadius: "50%",
              border: "2.5px solid rgba(250,204,21,0.85)",
              animation: "_choreo_pulse 1.6s ease-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: pulseRingSize,
              height: pulseRingSize,
              borderRadius: "50%",
              border: "2px solid rgba(250,204,21,0.5)",
              animation: "_choreo_pulse2 1.6s ease-out 0.4s infinite",
              pointerEvents: "none",
            }}
          />
        </>
      )}
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
            style={
              circleInnerLabelSpanStyle ?? {
                position: "relative",
                zIndex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `rotate(${screenUnrotateDeg}deg)`,
                transformOrigin: "center center",
              }
            }
          >
            {circleLabel}
          </span>
        ) : null}
      </button>
      {/* 個人閲覧：↓ 矢印ラベル（自分の位置を示す） */}
      {onePersonMode && isStudentHighlight && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, calc(-50% - ${halfMarker + 20}px))`,
            color: "rgba(250,204,21,0.95)",
            fontSize: "18px",
            lineHeight: 1,
            pointerEvents: "none",
            textShadow: "0 2px 6px rgba(0,0,0,0.9)",
            userSelect: "none",
            animation: "_choreo_pulse 1.6s ease-out infinite",
          }}
        >
          ↓
        </div>
      )}
      {showNameBelow || (onePersonMode && isStudentHighlight) ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, calc(-50% + ${labelOffsetPx}px)) rotate(${screenUnrotateDeg}deg)`,
            transformOrigin: `50% ${belowLabelOriginYpx}px`,
            color: onePersonMode && isStudentHighlight ? "rgba(250,204,21,0.95)" : "#f8fafc",
            fontSize: onePersonMode && isStudentHighlight ? `${Math.max(belowNameFontPx, 11)}px` : `${belowNameFontPx}px`,
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
