/**
 * PortraitWaveTransport.tsx
 * 縦画面: PC 版 TimelinePanel と同じ波形操作（キュー作成・移動・導線）を共有
 */

import React, { useRef, useCallback, useState, useEffect, useLayoutEffect } from "react";
import styles from "./PortraitWaveTransport.module.css";
import { useTimelineWaveBridgeStore } from "../../store/timelineWaveBridgeStore";

const MIN_ZOOM = 1;
const MAX_ZOOM = 48;
const DOUBLE_TAP_MS = 350;
const LONG_PRESS_MS = 520;
const PORTRAIT_WAVE_CSS_H = 80;

interface Props {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
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
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const pinchRef = useRef<{ dist: number; zoom: number; anchor: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const viewDuration = duration > 0 ? duration / zoom : 0;

  useEffect(() => {
    setPortraitCanvasRef(canvasRef);
    setPortraitActive(true);
    return () => {
      setPortraitActive(false);
      setPortraitCanvasRef(null);
    };
  }, [setPortraitActive, setPortraitCanvasRef]);

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

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      longPressFiredRef.current = false;

      if (pointersRef.current.size === 2) {
        clearLongPress();
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
        bridgeApi.handlers.onWaveContextMenu(synthMouseEvent("contextmenu", e));
      }, LONG_PRESS_MS);

      bridgeApi.handlers.onWaveCanvasPointerDown(e);
    },
    [bridgeApi, zoom, viewStart, currentTime, timeFromClientX, clearLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;

      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3) {
        clearLongPress();
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

      bridgeApi.handlers.onWaveCanvasPointerMove(e);
    },
    [bridgeApi, applyZoomAt, clearLongPress]
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
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

      if (!longPressFiredRef.current) {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
          bridgeApi.handlers.onWaveDoubleClick(synthMouseEvent("dblclick", e));
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      }

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [bridgeApi, clearLongPress]
  );

  const onPointerLeave = useCallback(() => {
    clearLongPress();
    bridgeApi?.handlers.onWaveCanvasPointerLeave();
  }, [bridgeApi, clearLongPress]);

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      clearLongPress();
      pointersRef.current.delete(e.pointerId);
      pinchRef.current = null;
    },
    [clearLongPress]
  );

  const handleStop = useCallback(() => {
    onSeek(0);
    if (isPlaying) onPlayPause();
  }, [isPlaying, onPlayPause, onSeek]);

  const handleSkipBack = useCallback(() => {
    onSeek(Math.max(0, currentTime - 5));
  }, [currentTime, onSeek]);

  const handleSkipForward = useCallback(() => {
    onSeek(Math.min(duration, currentTime + 5));
  }, [currentTime, duration, onSeek]);

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
        </div>
        <span className={styles.timeText}>
          {fmt(currentTime)}
          <span className={styles.timeSep}>/</span>
          {fmt(duration)}
          {zoomLabel ? <span className={styles.zoomBadge}>{zoomLabel}</span> : null}
        </span>
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
          aria-label="波形（PC版と同じ操作: ダブルタップでキュー追加・ドラッグで長さ調整・長押しで導線/キューメニュー）"
        />
        {!registered ? (
          <div className={styles.wavePlaceholder}>波形を読み込み中…</div>
        ) : null}
      </div>
    </div>
  );
};
