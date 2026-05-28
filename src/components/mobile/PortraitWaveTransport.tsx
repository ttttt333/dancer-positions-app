/**
 * PortraitWaveTransport.tsx
 * 高解像度波形 + タップ/スワイプ/ピンチ拡大 + 赤い再生バー
 */

import React, { useRef, useCallback, useState, useEffect, useLayoutEffect } from "react";
import styles from "./PortraitWaveTransport.module.css";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";
import {
  computePortraitWavePeaks,
  getFallbackPortraitWavePeaks,
  slicePeaksForView,
} from "./portraitWavePeaks";

const CUE_HIT_SEC = 1.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 48;
const TAP_MOVE_PX = 10;
const PLAYHEAD_HIT_PX = 16;

interface Props {
  audioUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (sec: number) => void;
  onAddCue?: () => void;
  cueStartTimes?: number[];
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function nearestCueTime(tSec: number, cueStartTimes: number[]): number | null {
  if (cueStartTimes.length === 0) return null;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const t of cueStartTimes) {
    const d = Math.abs(t - tSec);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return bestDist <= CUE_HIT_SEC ? best : null;
}

function clampViewStart(viewStart: number, viewDuration: number, duration: number): number {
  if (duration <= 0) return 0;
  const maxStart = Math.max(0, duration - viewDuration);
  return Math.max(0, Math.min(maxStart, viewStart));
}

type GestureMode = "idle" | "pending" | "playhead" | "pan" | "pinch" | "zoomSwipe";

export const PortraitWaveTransport: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onAddCue,
  cueStartTimes = [],
}) => {
  const onSelectCueNearTime = useMobileShellBridgeStore((s) => s.onSelectCueNearTime);
  const peaksRef = useRef<number[]>(getFallbackPortraitWavePeaks());
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewStart, setViewStart] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const lastTapRef = useRef(0);

  const gestureRef = useRef<{
    mode: GestureMode;
    pointerId: number;
    startX: number;
    startY: number;
    startViewStart: number;
    startZoom: number;
    pinchStartDist: number;
    moved: boolean;
  }>({
    mode: "idle",
    pointerId: -1,
    startX: 0,
    startY: 0,
    startViewStart: 0,
    startZoom: 1,
    pinchStartDist: 0,
    moved: false,
  });

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const viewDuration = duration > 0 ? duration / zoom : 0;

  useEffect(() => {
    if (!audioUrl) {
      peaksRef.current = getFallbackPortraitWavePeaks();
      return;
    }
    let cancelled = false;
    computePortraitWavePeaks(audioUrl)
      .then((peaks) => {
        if (!cancelled) peaksRef.current = peaks;
      })
      .catch(() => {
        if (!cancelled) peaksRef.current = getFallbackPortraitWavePeaks();
      });
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  useEffect(() => {
    setViewStart((v) => clampViewStart(v, viewDuration, duration));
  }, [zoom, duration, viewDuration]);

  /** 再生中は赤バーが見えるよう自動スクロール */
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

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setViewportWidth(w);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const clientXToTime = useCallback(
    (clientX: number): number | null => {
      const el = viewportRef.current;
      if (!el || duration <= 0 || viewDuration <= 0) return null;
      const r = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return viewStart + ratio * viewDuration;
    },
    [duration, viewStart, viewDuration]
  );

  const playheadClientX = useCallback((): number | null => {
    const el = viewportRef.current;
    if (!el || duration <= 0 || viewDuration <= 0) return null;
    const r = el.getBoundingClientRect();
    const ratio = (currentTime - viewStart) / viewDuration;
    if (ratio < 0 || ratio > 1) return null;
    return r.left + ratio * r.width;
  }, [currentTime, viewStart, viewDuration, duration]);

  const drawWave = useCallback(() => {
    const canvas = canvasRef.current;
    const el = viewportRef.current;
    if (!canvas || !el) return;

    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) return;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const peaks = peaksRef.current;
    const vd = duration > 0 ? duration / zoom : duration;
    const visible =
      duration > 0
        ? slicePeaksForView(peaks, viewStart, vd, duration, w)
        : peaks.slice(0, w);

    const mid = h / 2;
    const barW = w / Math.max(1, visible.length);

    for (let i = 0; i < visible.length; i++) {
      const amp = visible[i] ?? 0;
      const barH = Math.max(2, amp * (h - 8) * 0.92);
      const x = i * barW;
      const tSec = duration > 0 ? viewStart + (i / Math.max(1, visible.length - 1)) * vd : 0;
      const played = duration > 0 && tSec <= currentTime;
      ctx.fillStyle = played ? "rgba(239, 68, 68, 0.55)" : "rgba(148, 163, 184, 0.35)";
      ctx.fillRect(x, mid - barH / 2, Math.max(1, barW + 0.5), barH);
    }

    /** キューマーカー */
    if (duration > 0 && vd > 0) {
      for (const t of cueStartTimes) {
        if (t < viewStart || t > viewStart + vd) continue;
        const x = ((t - viewStart) / vd) * w;
        ctx.fillStyle = "#22d3ee";
        ctx.fillRect(x - 1, 4, 2, h - 8);
      }
    }

    /** 赤い再生バー */
    if (duration > 0 && vd > 0) {
      const phX = ((currentTime - viewStart) / vd) * w;
      if (phX >= -2 && phX <= w + 2) {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(phX - 1.5, 0, 3, h);
        ctx.fillStyle = "rgba(239, 68, 68, 0.95)";
        ctx.beginPath();
        ctx.arc(phX, h / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [currentTime, cueStartTimes, duration, viewStart, zoom]);

  useLayoutEffect(() => {
    drawWave();
  }, [drawWave, viewportWidth]);

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      drawWave();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, drawWave]);

  const applyZoomAt = useCallback(
    (nextZoom: number, anchorTimeSec: number) => {
      if (duration <= 0) return;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const oldVd = duration / zoom;
      const newVd = duration / z;
      const anchorRatio = oldVd > 0 ? (anchorTimeSec - viewStart) / oldVd : 0.5;
      const nextStart = anchorTimeSec - anchorRatio * newVd;
      setZoom(z);
      setViewStart(clampViewStart(nextStart, newVd, duration));
    },
    [duration, zoom, viewStart]
  );

  const handleTapSeek = useCallback(
    (clientX: number) => {
      const tSec = clientXToTime(clientX);
      if (tSec == null) return;

      const now = Date.now();
      if (now - lastTapRef.current < 350) {
        onSeek(tSec);
        onAddCue?.();
        lastTapRef.current = 0;
        return;
      }

      const nearCue = nearestCueTime(tSec, cueStartTimes);
      if (nearCue != null) {
        onSelectCueNearTime(nearCue);
      } else {
        onSeek(tSec);
      }
      lastTapRef.current = now;
    },
    [clientXToTime, onSeek, onAddCue, cueStartTimes, onSelectCueNearTime]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = viewportRef.current;
      if (!el) return;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 2) {
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        gestureRef.current = {
          mode: "pinch",
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startViewStart: viewStart,
          startZoom: zoom,
          pinchStartDist: dist,
          moved: true,
        };
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      if (pointersRef.current.size > 2) return;

      const phX = playheadClientX();
      const nearPlayhead =
        phX != null && Math.abs(e.clientX - phX) <= PLAYHEAD_HIT_PX;

      gestureRef.current = {
        mode: nearPlayhead ? "playhead" : "pending",
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startViewStart: viewStart,
        startZoom: zoom,
        pinchStartDist: 0,
        moved: false,
      };
      el.setPointerCapture(e.pointerId);
    },
    [viewStart, zoom, playheadClientX]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current;
      const el = viewportRef.current;
      if (!el) return;

      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (g.mode === "pinch" && pointersRef.current.size >= 2) {
        const pts = [...pointersRef.current.values()];
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        if (g.pinchStartDist > 0) {
          const scale = dist / g.pinchStartDist;
          const anchor = clientXToTime((pts[0]!.x + pts[1]!.x) / 2) ?? currentTime;
          applyZoomAt(g.startZoom * scale, anchor);
        }
        return;
      }

      if (g.pointerId !== e.pointerId) return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (!g.moved && (Math.abs(dx) > TAP_MOVE_PX || Math.abs(dy) > TAP_MOVE_PX)) {
        g.moved = true;
        if (g.mode === "pending") {
          if (Math.abs(dy) > Math.abs(dx) * 1.2) {
            g.mode = "zoomSwipe";
          } else if (zoom > 1 && Math.abs(dx) > Math.abs(dy)) {
            g.mode = "pan";
          } else if (Math.abs(dx) > Math.abs(dy)) {
            g.mode = "playhead";
          }
        }
      }

      if (g.mode === "playhead") {
        const tSec = clientXToTime(e.clientX);
        if (tSec != null) onSeek(tSec);
        return;
      }

      if (g.mode === "pan" && duration > 0 && zoom > 1) {
        const vd = duration / zoom;
        const secPerPx = vd / Math.max(1, el.clientWidth);
        setViewStart(clampViewStart(g.startViewStart - dx * secPerPx, vd, duration));
        return;
      }

      if (g.mode === "zoomSwipe") {
        const factor = 1 - dy * 0.004;
        const anchor = clientXToTime(g.startX) ?? currentTime;
        applyZoomAt(g.startZoom * factor, anchor);
      }
    },
    [zoom, duration, clientXToTime, currentTime, applyZoomAt, onSeek]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      const g = gestureRef.current;

      if (g.pointerId === e.pointerId && g.mode === "pending" && !g.moved) {
        handleTapSeek(e.clientX);
      }

      if (pointersRef.current.size === 0) {
        gestureRef.current.mode = "idle";
      } else if (pointersRef.current.size === 1 && g.mode === "pinch") {
        gestureRef.current.mode = "pending";
      }

      try {
        viewportRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [handleTapSeek]
  );

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    gestureRef.current.mode = "idle";
  }, []);

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

      <div
        ref={viewportRef}
        className={styles.waveViewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-label="波形（タップで移動・上下スワイプ/ピンチで拡大・横スワイプで移動・赤バーをドラッグ）"
      >
        <canvas ref={canvasRef} className={styles.waveCanvas} />
      </div>
    </div>
  );
};
