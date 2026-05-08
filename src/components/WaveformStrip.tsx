import type { MouseEvent, PointerEvent, RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatMmSs, waveRulerTicks } from "../lib/timeFormat";

/** 目盛り行〜波形にかけて再生位置線を少しはみ出して見せる（CSS px） */
const PLAYHEAD_LINE_BLEED_TOP_CSS = 14;
const PLAYHEAD_LINE_BLEED_BOTTOM_CSS = 8;

export type WaveformStripProps = {
  waveContainerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  playheadLineOverlayRef: RefObject<HTMLDivElement | null>;
  compactTopDock: boolean;
  duration: number;
  viewMode: ChoreographyProjectJson["viewMode"];
  /** 目盛りのポインタ（音源・編集モード時のみ） */
  hasPeaks: boolean;
  waveView: { start: number; end: number; span: number };
  waveCanvasCssH: number;
  /** 波形枠全体のツールチップ（ホイール・目盛り・リサイズ等の説明） */
  chromeTitle: string;
  onWaveRulerPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onWaveClick: (e: MouseEvent<HTMLCanvasElement>) => void;
  onWaveDoubleClick: (e: MouseEvent<HTMLCanvasElement>) => void;
  onWaveContextMenu: (e: MouseEvent<HTMLCanvasElement>) => void;
  onWaveCanvasPointerDown: (e: PointerEvent<HTMLCanvasElement>) => void;
  onWaveCanvasPointerMove: (e: PointerEvent<HTMLCanvasElement>) => void;
  onWaveCanvasPointerLeave: () => void;
  onWaveBorderResizePointerDown: (e: PointerEvent<HTMLDivElement>) => void;
};

/**
 * タイムラインの波形ブロック（秒数目盛り・キャンバス・再生ヘッドオーバーレイ・高さリサイズ）。
 * イベントハンドラと ref は親（`TimelinePanel`）が保持する。
 */
export function WaveformStrip({
  waveContainerRef,
  canvasRef,
  playheadLineOverlayRef,
  compactTopDock,
  duration,
  viewMode,
  hasPeaks,
  waveView,
  waveCanvasCssH,
  chromeTitle,
  onWaveRulerPointerDown,
  onWaveClick,
  onWaveDoubleClick,
  onWaveContextMenu,
  onWaveCanvasPointerDown,
  onWaveCanvasPointerMove,
  onWaveCanvasPointerLeave,
  onWaveBorderResizePointerDown,
}: WaveformStripProps) {
  const rulerInteractive = duration > 0 && hasPeaks && viewMode !== "view";
  const rulerHeightPx = compactTopDock ? 13 : 16;

  return (
    <div
      ref={waveContainerRef}
      title={chromeTitle}
      style={{
        width: "100%",
        borderRadius: "6px",
        border: "1px solid #334155",
        overflowX: "hidden",
        /** 上部ドック固定シェルでは visible だと再生ヘッドのはみ出しが祖先のスクロール領域を膨らませる */
        overflowY: compactTopDock ? "hidden" : "visible",
        background: "#020617",
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div style={{ position: "relative", width: "100%" }}>
        <div
          onPointerDown={onWaveRulerPointerDown}
          style={{
            position: "relative",
            height: compactTopDock ? "13px" : "16px",
            fontSize: compactTopDock ? "8px" : "9px",
            color: "#94a3b8",
            borderBottom: "1px solid #1e293b",
            fontVariantNumeric: "tabular-nums",
            userSelect: "none",
            overflow: "hidden",
            cursor: rulerInteractive ? "pointer" : "default",
            touchAction: "none",
          }}
          aria-label={
            duration > 0
              ? "秒数目盛り。クリックで再生位置を移動します（一時停止のままです）。"
              : undefined
          }
        >
          {duration > 0
            ? waveRulerTicks(waveView.start, waveView.end, 10).map((tick) => {
                const span = waveView.span;
                const p = span > 0 ? ((tick - waveView.start) / span) * 100 : 0;
                const pRounded = Math.round(p * 10000) / 10000;
                return (
                  <span
                    key={tick}
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: compactTopDock ? "2px" : "3px",
                      left: `${pRounded}%`,
                      transform: "translate3d(-50%, 0, 0)",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      willChange: "transform",
                    }}
                  >
                    {formatMmSs(tick)}
                  </span>
                );
              })
            : null}
        </div>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="楽曲波形・キュー区間"
          onClick={onWaveClick}
          onDoubleClick={onWaveDoubleClick}
          onContextMenu={onWaveContextMenu}
          onPointerDown={onWaveCanvasPointerDown}
          onPointerMove={onWaveCanvasPointerMove}
          onPointerLeave={onWaveCanvasPointerLeave}
          style={{
            display: "block",
            width: "100%",
            height: `${waveCanvasCssH}px`,
            cursor: duration > 0 ? "pointer" : "default",
            touchAction: "none",
            outline: "none",
          }}
          onFocus={(ev) => {
            ev.currentTarget.style.boxShadow = "inset 0 0 0 1px rgba(129, 140, 248, 0.6)";
          }}
          onBlur={(ev) => {
            ev.currentTarget.style.boxShadow = "none";
          }}
        />
        <div
          ref={playheadLineOverlayRef}
          aria-hidden
          style={{
            position: "absolute",
            pointerEvents: "none",
            display: "none",
            left: "0%",
            transform: "translateX(-50%)",
            top: rulerHeightPx - PLAYHEAD_LINE_BLEED_TOP_CSS,
            height:
              PLAYHEAD_LINE_BLEED_TOP_CSS +
              waveCanvasCssH +
              PLAYHEAD_LINE_BLEED_BOTTOM_CSS,
            width: 3,
            background: "#ef4444",
            borderRadius: 1,
            boxShadow: "0 0 5px rgba(239, 68, 68, 0.55)",
            zIndex: 2,
          }}
        />
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="波形の高さを変更"
        onPointerDown={onWaveBorderResizePointerDown}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 10,
          cursor: "ns-resize",
          touchAction: "none",
          zIndex: 4,
        }}
      />
    </div>
  );
}
