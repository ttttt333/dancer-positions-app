/**
 * PortraitWaveTransport.tsx
 * 縦画面: PC 版 TimelinePanel と同じ波形操作（キュー作成・移動・導線）を共有
 */

import React, { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from "react";
import styles from "./PortraitWaveTransport.module.css";
import { useTimelineWaveBridgeStore } from "../../store/timelineWaveBridgeStore";
import { formatMmSs, waveRulerTicks } from "../../lib/timeFormat";

const MIN_ZOOM = 1;
const MAX_ZOOM = 48;
const ZOOM_STEP = 1.5;
const DOUBLE_TAP_MS = 350;
const LONG_PRESS_MS = 520;
const PORTRAIT_WAVE_CSS_H = 80;
/** 長押し判定前にドラッグ開始する移動量（px） */
const DRAG_ARM_PX = 8;
/** 長押しキャンセルまでの指の揺れ許容（px） */
const LONG_PRESS_CANCEL_PX = 18;

interface Props {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function clampViewStart(viewStart: number, viewDuration: number, dur: number): number {
  if (dur <= 0) return 0;
  return Math.max(0, Math.min(Math.max(0, dur - viewDuration), viewStart));
}

function synthMouseEvent(
  type: "click" | "dblclick" | "contextmenu",
  source: React.PointerEvent<HTMLCanvasElement>
): React.MouseEvent<HTMLCanvasElement> {
  return {
    ...source,
    type,
    button: source.button,
    buttons: source.buttons,
    clientX: source.clientX,
    clientY: source.clientY,
    preventDefault: () => source.preventDefault(),
    stopPropagation: () => source.stopPropagation(),
  } as React.MouseEvent<HTMLCanvasElement>;
}

export const PortraitWaveTransport: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSeek,
}) => {
  const registered = useTimelineWaveBridgeStore((s) => s.registered);
  const bridgeApi = useTimelineWaveBridgeStore((s) => s.api);
  const syncPortraitView = useTimelineWaveBridgeStore((s) => s.syncPortraitView);
  const setPortraitActive = useTimelineWaveBridgeStore((s) => s.setPortraitActive);
  const setPortraitCanvasRef = useTimelineWaveBridgeStore((s) => s.setPortraitCanvasRef);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewStart, setViewStart] = useState(0);
  const lastTapRef = useRef(0);
  const pendingSingleTapRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const pinchRef = useRef<{ dist: number; zoom: number; anchor: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pointerDownRef = useRef<React.PointerEvent<HTMLCanvasElement> | null>(null);
  const dragArmedRef = useRef(false);
  const pointerDownOriginRef = useRef<{ x: number; y: number } | null>(null);

  const viewDuration = duration > 0 ? duration / zoom : 0;
  const viewEnd = viewStart + viewDuration;

  const playheadPct = useMemo(() => {
    if (duration <= 0 || viewDuration <= 0) return 0;
    const ratio = (currentTime - viewStart) / viewDuration;
    return Math.min(100, Math.max(0, ratio * 100));
  }, [currentTime, viewStart, viewDuration, duration]);

  const rulerTicks = useMemo(
    () => (viewDuration > 0 ? waveRulerTicks(viewStart, viewEnd, 8) : []),
    [viewStart, viewEnd, viewDuration]
  );

  const clearPendingSingleTap = useCallback(() => {
    if (pendingSingleTapRef.current != null) {
      window.clearTimeout(pendingSingleTapRef.current);
      pendingSingleTapRef.current = null;
    }
  }, []);

  useEffect(() => {
    setPortraitCanvasRef(canvasRef);
    setPortraitActive(true);
    return () => {
      clearPendingSingleTap();
      setPortraitActive(false);
      setPortraitCanvasRef(null);
    };
  }, [setPortraitActive, setPortraitCanvasRef, clearPendingSingleTap]);

  useEffect(() => {
    syncPortraitView(viewStart, zoom);
  }, [viewStart, zoom, syncPortraitView, duration]);

  useEffect(() => {
    setViewStart((v) => clampViewStart(v, viewDuration, duration));
  }, [zoom, duration, viewDuration]);

  useEffect(() => {
    if (!isPlaying || zoom <= 1 || duration <= 0) return;
    const vd = duration / zoom;
    setViewStart((vs) => {
      if (currentTime < vs) return clampViewStart(currentTime, vd, duration);
      if (currentTime > vs + vd * 0.82) {
        return clampViewStart(currentTime - vd * 0.18, vd, duration);
      }
      return vs;
    });
  }, [currentTime, isPlaying, zoom, duration]);

  const redraw = useCallback(() => {
    bridgeApi?.drawWaveformAt(currentTime);
  }, [bridgeApi, currentTime]);

  const syncCanvasBitmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.getBoundingClientRect().width;
    if (cssW <= 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(280, Math.round(cssW * dpr));
    const bh = Math.round(PORTRAIT_WAVE_CSS_H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    redraw();
  }, [redraw]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncCanvasBitmap();
    const ro = new ResizeObserver(() => syncCanvasBitmap());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [syncCanvasBitmap, registered]);

  useEffect(() => {
    if (!registered) return;
    redraw();
  }, [registered, currentTime, zoom, viewStart, redraw]);

  useEffect(() => {
    if (!isPlaying || !registered) return;
    let raf = 0;
    const tick = () => {
      redraw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, registered, redraw]);

  const timeFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = viewportRef.current;
      if (!el || duration <= 0 || viewDuration <= 0) return null;
      const r = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return viewStart + ratio * viewDuration;
    },
    [duration, viewStart, viewDuration]
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const t = timeFromClientX(clientX);
      if (t != null) onSeek(t);
    },
    [timeFromClientX, onSeek]
  );

  const onRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !audioUrl || duration <= 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      clearPendingSingleTap();
      seekFromClientX(e.clientX);
    },
    [audioUrl, duration, seekFromClientX, clearPendingSingleTap]
  );

  const onRulerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.buttons & 1) || !audioUrl || duration <= 0) return;
      seekFromClientX(e.clientX);
    },
    [audioUrl, duration, seekFromClientX]
  );

  const applyZoomAt = useCallback(
    (nextZoom: number, anchorTimeSec: number) => {
      if (duration <= 0) return;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const oldVd = duration / zoom;
      const newVd = duration / z;
      const anchorRatio = oldVd > 0 ? (anchorTimeSec - viewStart) / oldVd : 0.5;
      setZoom(z);
      setViewStart(clampViewStart(anchorTimeSec - anchorRatio * newVd, newVd, duration));
    },
    [duration, zoom, viewStart]
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const armCanvasDrag = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (dragArmedRef.current || !bridgeApi?.handlers) return;
      dragArmedRef.current = true;
      clearLongPress();
      bridgeApi.handlers.onWaveCanvasPointerDown(e);
    },
    [bridgeApi, clearLongPress]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;
      clearPendingSingleTap();
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      longPressFiredRef.current = false;
      dragArmedRef.current = false;
      pointerDownRef.current = e;
      pointerDownOriginRef.current = { x: e.clientX, y: e.clientY };

      if (pointersRef.current.size === 2) {
        clearLongPress();
        pointerDownRef.current = null;
        pointerDownOriginRef.current = null;
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        const anchor = timeFromClientX((pts[0]!.x + pts[1]!.x) / 2) ?? currentTime;
        pinchRef.current = { dist, zoom, anchor };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      if (pointersRef.current.size > 2) return;

      longPressTimerRef.current = window.setTimeout(() => {
        longPressFiredRef.current = true;
        pointerDownRef.current = null;
        pointerDownOriginRef.current = null;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(12);
        }
        bridgeApi.handlers.onWaveContextMenu(synthMouseEvent("contextmenu", e));
      }, LONG_PRESS_MS);
    },
    [bridgeApi, zoom, currentTime, timeFromClientX, clearLongPress, clearPendingSingleTap]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;

      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      const origin = pointerDownOriginRef.current;
      if (origin && !longPressFiredRef.current) {
        const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
        if (dist > LONG_PRESS_CANCEL_PX) {
          clearLongPress();
          clearPendingSingleTap();
        } else if (!dragArmedRef.current && dist > DRAG_ARM_PX && pointerDownRef.current) {
          armCanvasDrag(pointerDownRef.current);
        }
      }

      if (pinchRef.current && pointersRef.current.size >= 2) {
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        if (pinchRef.current.dist > 0) {
          const scale = dist / pinchRef.current.dist;
          applyZoomAt(pinchRef.current.zoom * scale, pinchRef.current.anchor);
        }
        return;
      }

      if (dragArmedRef.current) {
        bridgeApi.handlers.onWaveCanvasPointerMove(e);
      }
    },
    [bridgeApi, applyZoomAt, clearLongPress, clearPendingSingleTap, armCanvasDrag]
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (longPressFiredRef.current) return;
      bridgeApi?.handlers.onWaveClick(e);
    },
    [bridgeApi]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      bridgeApi?.handlers.onWaveDoubleClick(e);
    },
    [bridgeApi]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;
      clearLongPress();
      pointersRef.current.delete(e.pointerId);
      pinchRef.current = null;
      pointerDownRef.current = null;
      pointerDownOriginRef.current = null;

      if (longPressFiredRef.current) {
        longPressFiredRef.current = false;
        suppressClickRef.current = true;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      if (!dragArmedRef.current) {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
          clearPendingSingleTap();
          suppressClickRef.current = true;
          bridgeApi.handlers.onWaveDoubleClick(synthMouseEvent("dblclick", e));
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
          clearPendingSingleTap();
          pendingSingleTapRef.current = window.setTimeout(() => {
            pendingSingleTapRef.current = null;
            if (longPressFiredRef.current) return;
            bridgeApi.handlers.onWaveClick(synthMouseEvent("click", e));
          }, DOUBLE_TAP_MS);
        }
      }

      dragArmedRef.current = false;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [bridgeApi, clearLongPress, clearPendingSingleTap]
  );

  const onPointerLeave = useCallback(() => {
    clearLongPress();
    clearPendingSingleTap();
    bridgeApi?.handlers.onWaveCanvasPointerLeave();
  }, [bridgeApi, clearLongPress, clearPendingSingleTap]);

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      clearLongPress();
      clearPendingSingleTap();
      pointersRef.current.delete(e.pointerId);
      pinchRef.current = null;
    },
    [clearLongPress, clearPendingSingleTap]
  );

  const handleStop = useCallback(() => {
    onStop();
  }, [onStop]);

  const handleSkipBack = useCallback(() => {
    onSeek(Math.max(0, currentTime - 5));
  }, [currentTime, onSeek]);

  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, onSeek]);

  const handleZoomIn = useCallback(() => {
    applyZoomAt(zoom * ZOOM_STEP, currentTime);
  }, [applyZoomAt, zoom, currentTime]);

  const handleZoomOut = useCallback(() => {
    applyZoomAt(zoom / ZOOM_STEP, currentTime);
  }, [applyZoomAt, zoom, currentTime]);

  const zoomLabel = zoom > 1 ? `${zoom.toFixed(zoom >= 10 ? 0 : 1)}×` : null;

  return (
    <div className={styles.transport}>
      <div className={styles.row}>
        <div className={styles.controls}>
          <button
            className={styles.ctrlBtn}
            onClick={handleSkipBack}
            disabled={!audioUrl}
            aria-label="5秒戻す"
          >
            <span className={styles.skipIcon}>↺</span>
            <span className={styles.skipSec}>5</span>
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={handleSkipForward}
            disabled={!audioUrl}
            aria-label="5秒進める"
          >
            <span className={styles.skipIcon}>↻</span>
            <span className={styles.skipSec}>5</span>
          </button>
          <button
            className={styles.playBtn}
            onClick={onPlayPause}
            disabled={!audioUrl}
            aria-label={isPlaying ? "一時停止" : "再生"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={handleStop}
            disabled={!audioUrl}
            aria-label="停止して先頭へ"
          >
            ⏹
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={handleZoomIn}
            disabled={!audioUrl || zoom >= MAX_ZOOM - 0.01}
            aria-label="波形を拡大"
            title="拡大"
          >
            <span className={styles.zoomBtnIcon}>＋</span>
          </button>
          <button
            className={styles.ctrlBtn}
            onClick={handleZoomOut}
            disabled={!audioUrl || zoom <= MIN_ZOOM + 0.01}
            aria-label="波形を縮小"
            title="縮小"
          >
            <span className={styles.zoomBtnIcon}>－</span>
          </button>
        </div>
        <span className={styles.timeText}>
          {fmt(currentTime)}
          <span className={styles.timeSep}>/</span>
          {fmt(duration)}
          {zoomLabel ? <span className={styles.zoomBadge}>{zoomLabel}</span> : null}
        </span>
      </div>

      <div className={styles.waveFrame}>
        <div
          className={styles.waveRuler}
          onPointerDown={onRulerPointerDown}
          onPointerMove={onRulerPointerMove}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          aria-label="タイムライン（タップ・ドラッグで再生位置を移動）"
        >
          {rulerTicks.map((tick) => {
            const pct =
              viewDuration > 0
                ? ((tick - viewStart) / viewDuration) * 100
                : 0;
            return (
              <span
                key={tick}
                className={styles.rulerTick}
                style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
              >
                {formatMmSs(tick)}
              </span>
            );
          })}
        </div>
        <div ref={viewportRef} className={styles.waveViewport}>
          <canvas
            ref={canvasRef}
            className={styles.waveCanvas}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            onPointerCancel={onPointerCancel}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-label="波形（ダブルタップで7秒のキュー追加・ドラッグで長さ調整・長押しで導線/キューメニュー）"
          />
          {!registered ? (
            <div className={styles.wavePlaceholder}>波形を読み込み中…</div>
          ) : null}
        </div>
        {duration > 0 && viewDuration > 0 ? (
          <div
            className={styles.playheadLine}
            style={{ left: `${playheadPct}%` }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
};
