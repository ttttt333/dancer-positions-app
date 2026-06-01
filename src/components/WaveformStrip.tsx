import type { MouseEvent, PointerEvent, RefObject } from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatMmSs, waveRulerTicks } from "../lib/timeFormat";
import { waveTimeToPercent } from "../lib/timelineWaveGeometry";
import { WaveformLoadOverlay } from "./WaveformLoadOverlay";
import { useWaveformLoadProgressStore } from "../store/waveformLoadProgressStore";
import { PC_WAVE_RULER_HEIGHT_CSS } from "../lib/waveDockMetrics";

/** 波形下端の再生位置線のはみ出し（CSS px） */
const PLAYHEAD_LINE_BLEED_BOTTOM_CSS = 8;

/** PC: 波形上の秒数目盛り行（従来の 2/3） — `waveDockMetrics` と揃える */
const PC_WAVE_RULER_HEIGHT = PC_WAVE_RULER_HEIGHT_CSS;
const MOBILE_WAVE_RULER_HEIGHT = "13px";

export type WaveformStripProps = {
  waveContainerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  playheadLineOverlayRef: RefObject<HTMLDivElement | null>;
  compactTopDock: boolean;
  /** PC ワイド上部ドック: 秒数目盛り行を PC サイズに保つ */
  wideWorkbench?: boolean;
  /** false のとき波形下端の高さリサイズ枠を非表示（PC 上部ドックは外枠リサイズを使う） */
  showWaveHeightResizeHandle?: boolean;
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
  onPlayheadLinePointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPlayheadLinePointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPlayheadLinePointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onPlayheadLinePointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
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
  wideWorkbench = false,
  showWaveHeightResizeHandle = true,
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
  onPlayheadLinePointerDown,
  onPlayheadLinePointerMove,
  onPlayheadLinePointerUp,
  onPlayheadLinePointerCancel,
}: WaveformStripProps) {
  const rulerInteractive = duration > 0 && hasPeaks && viewMode !== "view";
  const usePcWaveRuler = !compactTopDock || wideWorkbench;
  const rulerHeight = usePcWaveRuler ? PC_WAVE_RULER_HEIGHT : MOBILE_WAVE_RULER_HEIGHT;
  const playheadHeight = `calc(${rulerHeight} + ${waveCanvasCssH}px + ${PLAYHEAD_LINE_BLEED_BOTTOM_CSS}px)`;
  const waveLoadProgress = useWaveformLoadProgressStore((s) => s.progress);
  const showWaveLoadOverlay = !hasPeaks && waveLoadProgress != null;

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
            height: rulerHeight,
            fontSize: usePcWaveRuler ? "9px" : "8px",
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
              ? "秒数目盛り。クリックで再生位置を移動します（再生中も移動できます）。"
              : undefined
          }
        >
          {duration > 0
            ? waveRulerTicks(waveView.start, waveView.end, 10).map((tick) => {
                const p = waveTimeToPercent(tick, waveView.start, waveView.span);
                const pRounded = Math.round(p * 10000) / 10000;
                return (
                  <span
                    key={tick}
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: usePcWaveRuler ? "50%" : "2px",
                      left: `${pRounded}%`,
                      transform: usePcWaveRuler
                        ? "translate3d(-50%, -50%, 0)"
                        : "translate3d(-50%, 0, 0)",
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
        <div style={{ position: "relative", width: "100%" }}>
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
          <WaveformLoadOverlay visible={showWaveLoadOverlay} />
        </div>
        <div
          ref={playheadLineOverlayRef}
          role="slider"
          aria-label="再生位置（ドラッグで移動・再生中も操作できます）"
          style={{
            position: "absolute",
            pointerEvents: "none",
            display: "none",
            left: "0%",
            transform: "translateX(-50%)",
            top: 0,
            height: playheadHeight,
            width: 16,
            touchAction: "none",
            zIndex: 3,
          }}
        >
          <div
            aria-hidden
            onPointerDown={onPlayheadLinePointerDown}
            onPointerMove={onPlayheadLinePointerMove}
            onPointerUp={onPlayheadLinePointerUp}
            onPointerCancel={onPlayheadLinePointerCancel}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 8,
              transform: "translateX(-50%)",
              pointerEvents: "auto",
              cursor: "col-resize",
              touchAction: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 3,
              transform: "translateX(-50%)",
              background: "#ef4444",
              borderRadius: 1,
              boxShadow: "0 0 5px rgba(239, 68, 68, 0.55)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>
      {showWaveHeightResizeHandle ? (
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
      ) : null}
    </div>
  );
}
