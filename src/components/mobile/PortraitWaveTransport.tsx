/**
 * PortraitWaveTransport.tsx
 * 縦画面: PC 版 TimelinePanel と同じ波形操作（キュー作成・移動・導線）を共有
 */

import React, { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from "react";
import styles from "./PortraitWaveTransport.module.css";
import ctrlStyles from "./TransportControls.module.css";
import {
  TransportIconPause,
  TransportIconPlay,
  TransportIconSkipBack,
  TransportIconSkipForward,
  TransportIconStop,
  TransportIconZoomIn,
  TransportIconZoomOut,
} from "./TransportIcons";
import { useTimelineWaveBridgeStore } from "../../store/timelineWaveBridgeStore";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";
import { playbackEngine } from "../../core/playbackEngine";
import {
  beginPlaybackScrubSession,
  endPlaybackScrubSession,
  seekPlaybackScrubAudible,
  type PlaybackScrubSession,
} from "../../lib/playbackTransport";
import { formatMmSs, waveRulerTicks } from "../../lib/timeFormat";
import {
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  waveTimeToExtentX,
} from "../../lib/timelineWaveGeometry";

const MIN_ZOOM = 1;
const MAX_ZOOM = 48;
/** +/- ボタン: 1回あたり 10% ずつ拡大・縮小 */
const ZOOM_BUTTON_STEP = 1.1;
const DOUBLE_TAP_MS = 350;
const LONG_PRESS_MS = 520;
const PORTRAIT_WAVE_CSS_H = 96;
/** 長押し判定前にドラッグ開始する移動量（px） */
const DRAG_ARM_PX = 14;
/** この距離未満の指の動きはタップ扱い（シーク） */
const TAP_MAX_MOVE_PX = 16;
/** 長押しキャンセルまでの指の揺れ許容（px） */
const LONG_PRESS_CANCEL_PX = 18;
/** 端付近この幅に入ると波形を自動スクロール */
const EDGE_SCROLL_ZONE_MIN_PX = 32;
const EDGE_SCROLL_ZONE_RATIO = 0.14;

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
  const trimStartSec = useMobileShellBridgeStore((s) => s.trimStartSec);
  const trimEndSec = useMobileShellBridgeStore((s) => s.trimEndSec);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [viewStart, setViewStart] = useState(0);
  const viewStartRef = useRef(0);
  viewStartRef.current = viewStart;
  const lastTapRef = useRef(0);
  const pendingSingleTapRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressDoubleClickRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const pinchRef = useRef<{ dist: number; zoom: number; anchor: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pointerDownRef = useRef<React.PointerEvent<HTMLCanvasElement> | null>(null);
  const dragArmedRef = useRef(false);
  const pointerDownOriginRef = useRef<{ x: number; y: number } | null>(null);
  const scrubClientXRef = useRef<number | null>(null);
  const edgeScrollRafRef = useRef<number | null>(null);
  const scrubActiveRef = useRef(false);
  const scrubShouldSeekRef = useRef(true);
  const playheadDragRef = useRef(false);
  const scrubSessionRef = useRef<PlaybackScrubSession | null>(null);

  const viewDuration = duration > 0 ? duration / zoom : 0;
  const viewEnd = viewStart + viewDuration;

  const playheadSecForUi = useMemo(() => {
    if (
      isPlaying &&
      playbackEngine.getMediaSourceUrl() &&
      !playbackEngine.isPaused() &&
      Number.isFinite(playbackEngine.getCurrentTime())
    ) {
      return playbackEngine.getCurrentTime();
    }
    return currentTime;
  }, [currentTime, isPlaying]);

  const playheadPct = useMemo(() => {
    if (duration <= 0 || viewDuration <= 0) return 0;
    const xPlay = waveTimeToExtentX(
      playheadSecForUi,
      viewStart,
      viewDuration,
      100
    );
    return Math.min(100, Math.max(0, xPlay));
  }, [playheadSecForUi, viewStart, viewDuration, duration]);

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
    if (scrubActiveRef.current || playheadDragRef.current) return;
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

  const edgeScrollAtClientX = useCallback(
    (clientX: number) => {
      if (zoom <= 1.001 || duration <= 0) return;
      const el = viewportRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      const vd = viewDuration;
      const zone = Math.max(EDGE_SCROLL_ZONE_MIN_PX, r.width * EDGE_SCROLL_ZONE_RATIO);
      const vs = viewStartRef.current;
      let next = vs;

      if (clientX <= r.left + zone) {
        const depth = 1 - Math.max(0, (clientX - r.left) / zone);
        const pan = vd * (0.016 + 0.065 * depth);
        next = clampViewStart(vs - pan, vd, duration);
      } else if (clientX >= r.right - zone) {
        const depth = 1 - Math.max(0, (r.right - clientX) / zone);
        const pan = vd * (0.016 + 0.065 * depth);
        next = clampViewStart(vs + pan, vd, duration);
      } else {
        return;
      }
      if (next === vs) return;
      viewStartRef.current = next;
      setViewStart(next);
      syncPortraitView(next, zoom);
      bridgeApi?.drawWaveformAt(currentTime);
    },
    [zoom, duration, viewDuration, syncPortraitView, bridgeApi, currentTime]
  );

  const isInEdgeScrollZone = useCallback((clientX: number) => {
    const el = viewportRef.current;
    if (!el || zoom <= 1.001) return false;
    const r = el.getBoundingClientRect();
    const zone = Math.max(EDGE_SCROLL_ZONE_MIN_PX, r.width * EDGE_SCROLL_ZONE_RATIO);
    return clientX <= r.left + zone || clientX >= r.right - zone;
  }, [zoom]);

  const stopEdgeScrollLoop = useCallback(() => {
    if (edgeScrollRafRef.current != null) {
      cancelAnimationFrame(edgeScrollRafRef.current);
      edgeScrollRafRef.current = null;
    }
  }, []);

  const startScrubSession = useCallback(() => {
    if (!scrubSessionRef.current) {
      scrubSessionRef.current = beginPlaybackScrubSession();
    }
  }, []);

  const seekDuringScrub = useCallback(
    (t: number) => {
      seekPlaybackScrubAudible({
        t,
        durationSec: duration,
        trimStartSec,
        trimEndSec,
        roundHeadForStore: true,
      });
    },
    [duration, trimStartSec, trimEndSec]
  );

  const finishScrubSession = useCallback(() => {
    endPlaybackScrubSession(scrubSessionRef.current);
    scrubSessionRef.current = null;
  }, []);

  const tickEdgeScrollLoop = useCallback(() => {
    edgeScrollRafRef.current = null;
    if (!scrubActiveRef.current) return;
    const x = scrubClientXRef.current;
    if (x == null) return;
    if (!isInEdgeScrollZone(x)) return;
    edgeScrollAtClientX(x);
    if (scrubShouldSeekRef.current) {
      const t = timeFromClientX(x);
      if (t != null) seekDuringScrub(t);
    } else {
      useTimelineWaveBridgeStore.getState().portraitWaveEdgeScrollTick?.(x);
    }
    edgeScrollRafRef.current = requestAnimationFrame(tickEdgeScrollLoop);
  }, [edgeScrollAtClientX, isInEdgeScrollZone, timeFromClientX, seekDuringScrub]);

  const handlePortraitWaveScrub = useCallback(
    (clientX: number, end = false, shouldSeek = true) => {
      if (end) {
        scrubActiveRef.current = false;
        scrubClientXRef.current = null;
        stopEdgeScrollLoop();
        finishScrubSession();
        return;
      }
      scrubActiveRef.current = true;
      scrubShouldSeekRef.current = shouldSeek;
      scrubClientXRef.current = clientX;
      edgeScrollAtClientX(clientX);
      if (shouldSeek) {
        const t = timeFromClientX(clientX);
        if (t != null) seekDuringScrub(t);
      }
      if (isInEdgeScrollZone(clientX) && edgeScrollRafRef.current == null) {
        edgeScrollRafRef.current = requestAnimationFrame(tickEdgeScrollLoop);
      }
    },
    [
      edgeScrollAtClientX,
      isInEdgeScrollZone,
      timeFromClientX,
      seekDuringScrub,
      stopEdgeScrollLoop,
      tickEdgeScrollLoop,
      finishScrubSession,
    ]
  );

  useEffect(() => {
    useTimelineWaveBridgeStore.getState().setPortraitWaveScrubAtClientX(handlePortraitWaveScrub);
    return () => {
      stopEdgeScrollLoop();
      useTimelineWaveBridgeStore.getState().setPortraitWaveScrubAtClientX(null);
    };
  }, [handlePortraitWaveScrub, stopEdgeScrollLoop]);

  const onRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !audioUrl || duration <= 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      clearPendingSingleTap();
      startScrubSession();
      handlePortraitWaveScrub(e.clientX);
    },
    [audioUrl, duration, handlePortraitWaveScrub, clearPendingSingleTap, startScrubSession]
  );

  const onRulerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.buttons & 1) || !audioUrl || duration <= 0) return;
      handlePortraitWaveScrub(e.clientX);
    },
    [audioUrl, duration, handlePortraitWaveScrub]
  );

  const onRulerPointerUp = useCallback(() => {
    handlePortraitWaveScrub(0, true);
  }, [handlePortraitWaveScrub]);

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

  /** +/- ボタン: 再生バーの位置を画面中央に保ちながら拡大・縮小 */
  const applyZoomCenteredOnPlayhead = useCallback(
    (nextZoom: number, anchorTimeSec: number) => {
      if (duration <= 0) return;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const newVd = duration / z;
      setZoom(z);
      setViewStart(clampViewStart(anchorTimeSec - newVd / 2, newVd, duration));
    },
    [duration]
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

  const onPlayheadPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !audioUrl || duration <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      clearPendingSingleTap();
      clearLongPress();
      startScrubSession();
      playheadDragRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      handlePortraitWaveScrub(e.clientX);
    },
    [audioUrl, duration, handlePortraitWaveScrub, clearPendingSingleTap, clearLongPress, startScrubSession]
  );

  const onPlayheadPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!playheadDragRef.current || !(e.buttons & 1)) return;
      e.preventDefault();
      handlePortraitWaveScrub(e.clientX);
    },
    [handlePortraitWaveScrub]
  );

  const endPlayheadDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!playheadDragRef.current) return;
      playheadDragRef.current = false;
      handlePortraitWaveScrub(e.clientX, true);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [handlePortraitWaveScrub]
  );

  const isNearPlayhead = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0 || viewDuration <= 0) return false;
      return hitPlayheadStripForScrub(
        clientX,
        canvas,
        viewStart,
        viewDuration,
        playheadSecForUi,
        duration,
        PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX
      );
    },
    [duration, viewDuration, viewStart, playheadSecForUi]
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

      if (pointersRef.current.size === 1 && isNearPlayhead(e.clientX)) {
        clearLongPress();
        dragArmedRef.current = true;
        bridgeApi.handlers.onWaveCanvasPointerDown(e);
        return;
      }

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
    [bridgeApi, zoom, currentTime, timeFromClientX, clearLongPress, clearPendingSingleTap, isNearPlayhead]
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

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    void e;
    if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (longPressFiredRef.current) return;
      /* タップは pointerUp で処理（シークのみ） */
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (suppressDoubleClickRef.current) {
        suppressDoubleClickRef.current = false;
        return;
      }
      bridgeApi?.handlers.onWaveDoubleClick(e);
    },
    [bridgeApi]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;
      clearLongPress();
      const origin = pointerDownOriginRef.current;
      const movedPx =
        origin != null
          ? Math.hypot(e.clientX - origin.x, e.clientY - origin.y)
          : 0;
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
        dragArmedRef.current = false;
        return;
      }

      const treatAsTap = !dragArmedRef.current || movedPx <= TAP_MAX_MOVE_PX;
      dragArmedRef.current = false;

      if (treatAsTap) {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
          clearPendingSingleTap();
          suppressClickRef.current = true;
          suppressDoubleClickRef.current = true;
          bridgeApi.handlers.onWaveDoubleClick(synthMouseEvent("dblclick", e));
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
          clearPendingSingleTap();
          pendingSingleTapRef.current = window.setTimeout(() => {
            pendingSingleTapRef.current = null;
            if (longPressFiredRef.current) return;
            suppressClickRef.current = true;
            bridgeApi.handlers.onWaveClick(synthMouseEvent("click", e));
          }, DOUBLE_TAP_MS);
        }
      }

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
    applyZoomCenteredOnPlayhead(zoom * ZOOM_BUTTON_STEP, playheadSecForUi);
  }, [applyZoomCenteredOnPlayhead, zoom, playheadSecForUi]);

  const handleZoomOut = useCallback(() => {
    applyZoomCenteredOnPlayhead(zoom / ZOOM_BUTTON_STEP, playheadSecForUi);
  }, [applyZoomCenteredOnPlayhead, zoom, playheadSecForUi]);

  const zoomLabel = zoom > 1 ? `${zoom.toFixed(zoom >= 10 ? 0 : 1)}×` : null;

  return (
    <div className={styles.transport}>
      <div className={styles.row}>
        <div className={ctrlStyles.controls}>
          <div className={ctrlStyles.group}>
            <button
              className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn}`}
              onClick={handleSkipBack}
              disabled={!audioUrl}
              aria-label="5秒戻す"
            >
              <TransportIconSkipBack size={22} className={ctrlStyles.icon} />
              <span className={ctrlStyles.skipBadge}>5</span>
            </button>
            <button
              className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn}`}
              onClick={handleSkipForward}
              disabled={!audioUrl}
              aria-label="5秒進める"
            >
              <TransportIconSkipForward size={22} className={ctrlStyles.icon} />
              <span className={ctrlStyles.skipBadge}>5</span>
            </button>
            <button
              className={`${ctrlStyles.btn} ${ctrlStyles.btnPrimary}`}
              onClick={onPlayPause}
              disabled={!audioUrl}
              aria-label={isPlaying ? "一時停止" : "再生"}
            >
              {isPlaying ? (
                <TransportIconPause size={24} className={ctrlStyles.iconPrimary} />
              ) : (
                <TransportIconPlay size={24} className={ctrlStyles.iconPrimary} />
              )}
            </button>
            <button
              className={ctrlStyles.btn}
              onClick={handleStop}
              disabled={!audioUrl}
              aria-label="停止して先頭へ"
            >
              <TransportIconStop size={20} className={ctrlStyles.icon} />
            </button>
          </div>
          <div className={ctrlStyles.divider} aria-hidden />
          <div className={ctrlStyles.group}>
            <button
              className={ctrlStyles.btn}
              onClick={handleZoomIn}
              disabled={!audioUrl || zoom >= MAX_ZOOM - 0.01}
              aria-label="波形を拡大"
              title="拡大"
            >
              <TransportIconZoomIn size={22} className={ctrlStyles.icon} />
            </button>
            <button
              className={ctrlStyles.btn}
              onClick={handleZoomOut}
              disabled={!audioUrl || zoom <= MIN_ZOOM + 0.01}
              aria-label="波形を縮小"
              title="縮小"
            >
              <TransportIconZoomOut size={22} className={ctrlStyles.icon} />
            </button>
          </div>
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
          onPointerUp={onRulerPointerUp}
          onPointerCancel={onRulerPointerUp}
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
            aria-label="波形（タップで再生位置を移動・ダブルタップで10秒のキュー追加・ドラッグでキュー調整・長押しで導線/キューメニュー）"
          />
          {!registered ? (
            <div className={styles.wavePlaceholder}>波形を読み込み中…</div>
          ) : null}
        </div>
        {duration > 0 && viewDuration > 0 ? (
          <div
            className={styles.playheadLine}
            style={{ left: `${playheadPct}%` }}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={playheadSecForUi}
            aria-label="再生位置（ドラッグで移動・再生中も操作できます）"
            onPointerDown={onPlayheadPointerDown}
            onPointerMove={onPlayheadPointerMove}
            onPointerUp={endPlayheadDrag}
            onPointerCancel={endPlayheadDrag}
          />
        ) : null}
      </div>
    </div>
  );
};
