import { useSyncExternalStore, type MouseEvent, type PointerEvent, type RefObject } from "react";
import {
  getWaveDrawRangeSnapshot,
  subscribeWaveDrawRange,
} from "../lib/waveDrawRangeSync";
import type { ChoreographyProjectJson } from "../types/choreography";
import { formatMmSs, waveRulerTicks } from "../lib/timeFormat";
import {
  resolveCanonicalTimelineView,
  timelineClientXToTime,
  timelineTimeToPercent,
} from "../hooks/useTimelinePixels";
import { WaveformLoadOverlay } from "./WaveformLoadOverlay";
import { useWaveformLoadProgressStore } from "../store/waveformLoadProgressStore";
import { useMusicSectionOverlayStore } from "../store/musicSectionOverlayStore";
import { PC_WAVE_RULER_HEIGHT_CSS } from "../lib/waveDockMetrics";

/** ラベル＋ドラッグハンドルが収まるセクション帯 */
const SECTION_BAR_HEIGHT = 22;

/** 波形下端の再生位置線のはみ出し（CSS px）— 上部ドックではクリップを避ける */
const PLAYHEAD_LINE_BLEED_BOTTOM_CSS = 8;
const PLAYHEAD_LINE_BLEED_COMPACT_WIDE_PX = 4;

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
  const playheadBleedPx =
    compactTopDock && wideWorkbench
      ? PLAYHEAD_LINE_BLEED_COMPACT_WIDE_PX
      : PLAYHEAD_LINE_BLEED_BOTTOM_CSS;
  const waveLoadProgress = useWaveformLoadProgressStore((s) => s.progress);
  const showWaveLoadOverlay = !hasPeaks && waveLoadProgress != null;
  const sectionSegments = useMusicSectionOverlayStore((s) => s.segments);
  const sectionAnalyzing = useMusicSectionOverlayStore((s) => s.analyzing);
  const sectionAnalyzeStatus = useMusicSectionOverlayStore((s) => s.analyzeStatus);
  const updateSectionBoundary = useMusicSectionOverlayStore((s) => s.updateBoundary);
  const nudgeBeatGrid = useMusicSectionOverlayStore((s) => s.nudgeBeatGrid);
  const canEditSections =
    viewMode !== "view" && sectionSegments.length > 0 && !sectionAnalyzing;
  const playheadHeight = `calc(${rulerHeight} + ${
    sectionSegments.length > 0 || sectionAnalyzing ? SECTION_BAR_HEIGHT : 0
  }px + ${waveCanvasCssH}px + ${playheadBleedPx}px)`;
  const drawWaveView = useSyncExternalStore(
    subscribeWaveDrawRange,
    getWaveDrawRangeSnapshot,
    getWaveDrawRangeSnapshot
  );
  /** Canvas 公開レンジと常に同じ窓（フル表示でも fallback しない） */
  const rulerView = resolveCanonicalTimelineView(
    drawWaveView,
    waveView,
    duration
  );
  /** ズーム中のみ赤バー上でポインタを受け、ドラッグで波形を横スクロール（非ズーム時はキャンバスでキュー操作を優先） */
  const zoomedWaveView =
    duration > 0 &&
    rulerView.span > 0 &&
    rulerView.span < duration - 1e-6;
  const playheadStripPointerEvents =
    zoomedWaveView && hasPeaks && viewMode !== "view" ? "auto" : "none";

  return (
    <div
      ref={waveContainerRef}
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
            ? waveRulerTicks(rulerView.start, rulerView.end, 10).map((tick) => {
                const p = timelineTimeToPercent(tick, rulerView);
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
        {sectionSegments.length > 0 && duration > 0 ? (
          <div
            data-section-track
            aria-label="AIが認識した曲のセクション。境界をドラッグして微調整できます"
            title="AIの曲理解（セクション）— 端をドラッグでビート吸着"
            style={{
              position: "relative",
              height: SECTION_BAR_HEIGHT,
              borderBottom: "1px solid #1e293b",
              background: "rgba(15, 23, 42, 0.9)",
              overflow: "hidden",
            }}
          >
            {canEditSections ? (
              <div
                style={{
                  position: "absolute",
                  right: 4,
                  top: 2,
                  zIndex: 3,
                  display: "flex",
                  gap: 2,
                  pointerEvents: "auto",
                }}
              >
                <button
                  type="button"
                  title="グリッドを -10ms（ビートナッジ）"
                  aria-label="グリッドを10ミリ秒早める"
                  onClick={() => nudgeBeatGrid(-0.01)}
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 5px",
                    borderRadius: 4,
                    border: "1px solid rgba(212,175,55,0.35)",
                    background: "rgba(10,9,8,0.75)",
                    color: "#e8d48b",
                    cursor: "pointer",
                  }}
                >
                  −10ms
                </button>
                <button
                  type="button"
                  title="グリッドを +10ms（ビートナッジ）"
                  aria-label="グリッドを10ミリ秒遅らせる"
                  onClick={() => nudgeBeatGrid(0.01)}
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 5px",
                    borderRadius: 4,
                    border: "1px solid rgba(212,175,55,0.35)",
                    background: "rgba(10,9,8,0.75)",
                    color: "#e8d48b",
                    cursor: "pointer",
                  }}
                >
                  +10ms
                </button>
              </div>
            ) : null}
            {sectionSegments.map((seg, i) => {
              const left = timelineTimeToPercent(seg.startSec, rulerView);
              const right = timelineTimeToPercent(seg.endSec, rulerView);
              const width = Math.max(0, right - left);
              if (width < 0.05) return null;
              return (
                <div
                  key={`${seg.sectionType}-${seg.startSec}-${i}`}
                  title={`${seg.label} ${formatMmSs(seg.startSec)}–${formatMmSs(seg.endSec)}（左端ドラッグでビート整列）`}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    width: `${width}%`,
                    top: 1,
                    bottom: 1,
                    background: seg.color,
                    borderRadius: 3,
                    pointerEvents: canEditSections ? "auto" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                    boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.35)",
                  }}
                >
                  {width > 4 ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: "rgba(248, 250, 252, 0.92)",
                        textShadow: "0 1px 2px rgba(0,0,0,0.55)",
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        padding: "0 6px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                    >
                      {seg.label}
                    </span>
                  ) : null}
                  {canEditSections ? (
                    <>
                      <SectionEdgeHandle
                        edge="start"
                        onDrag={(clientX, trackEl) => {
                          const t = timelineClientXToTime(
                            clientX,
                            trackEl,
                            rulerView
                          );
                          if (t != null) {
                            updateSectionBoundary(i, "start", t, {
                              skipMagnet: true,
                              realignGrid: true,
                            });
                          }
                        }}
                      />
                      <SectionEdgeHandle
                        edge="end"
                        onDrag={(clientX, trackEl) => {
                          const t = timelineClientXToTime(
                            clientX,
                            trackEl,
                            rulerView
                          );
                          if (t != null) updateSectionBoundary(i, "end", t);
                        }}
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : sectionAnalyzing ? (
          <div
            aria-live="polite"
            style={{
              position: "relative",
              height: SECTION_BAR_HEIGHT,
              borderBottom: "1px solid #1e293b",
              background:
                "linear-gradient(90deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9), rgba(15,23,42,0.95))",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent, rgba(56,189,248,0.35), transparent)",
                animation: "choreocore-wave-scan 1.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                position: "relative",
                zIndex: 1,
                fontSize: 9,
                fontWeight: 700,
                color: "#7dd3fc",
                letterSpacing: "0.04em",
                textShadow: "0 0 8px rgba(56,189,248,0.45)",
              }}
            >
              {sectionAnalyzeStatus ?? "AIがBPMとビートを展開解析中…"}
            </span>
            <style>{`
              @keyframes choreocore-wave-scan {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `}</style>
          </div>
        ) : null}
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
            onDoubleClick={(e) => {
              if (playheadStripPointerEvents !== "auto") return;
              const canvas = canvasRef.current;
              if (!canvas) return;
              e.preventDefault();
              e.stopPropagation();
              onWaveDoubleClick({
                ...e,
                currentTarget: canvas,
                target: canvas,
              } as MouseEvent<HTMLCanvasElement>);
            }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 8,
              transform: "translateX(-50%)",
              pointerEvents: playheadStripPointerEvents,
              cursor: playheadStripPointerEvents === "auto" ? "col-resize" : "default",
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

function SectionEdgeHandle({
  edge,
  onDrag,
}: {
  edge: "start" | "end";
  onDrag: (clientX: number, trackEl: HTMLElement) => void;
}) {
  return (
    <div
      role="slider"
      aria-label={edge === "start" ? "セクション開始" : "セクション終了"}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const handle = e.currentTarget;
        const trackEl = handle.closest("[data-section-track]") as HTMLElement | null;
        if (!trackEl) return;
        const pointerId = e.pointerId;
        handle.setPointerCapture(pointerId);
        const move = (ev: globalThis.PointerEvent) => {
          onDrag(ev.clientX, trackEl);
        };
        const up = (ev: globalThis.PointerEvent) => {
          onDrag(ev.clientX, trackEl);
          try {
            handle.releasePointerCapture(pointerId);
          } catch {
            /* already released */
          }
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      }}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [edge === "start" ? "left" : "right"]: -3,
        width: 8,
        cursor: "ew-resize",
        touchAction: "none",
        zIndex: 2,
        background: "rgba(248, 250, 252, 0.55)",
        borderRadius: 2,
        boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.4)",
      }}
    />
  );
}
