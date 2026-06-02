/**
 * PortraitWaveTransport.tsx
 * 縦画面: PC 版 TimelinePanel と同じ波形操作（キュー作成・移動・導線）を共有
 */

import React, { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo, useImperativeHandle, forwardRef } from "react";
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
import { WaveformLoadOverlay } from "../WaveformLoadOverlay";
import { useWaveformLoadProgressStore } from "../../store/waveformLoadProgressStore";
import { useMobileShellBridgeStore } from "../../store/useMobileShellBridgeStore";
import { playbackEngine } from "../../core/playbackEngine";
import {
  beginPlaybackScrubSession,
  endPlaybackScrubSession,
  seekPlaybackDuringScrub,
  type PlaybackScrubSession,
} from "../../lib/playbackTransport";
import { formatMmSs, waveRulerTicks } from "../../lib/timeFormat";
import {
  hitPlayheadStripForScrub,
  PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX,
  waveExtentXToTime,
  waveTimeToPercent,
  getWaveViewForDraw,
  resolveWaveDrawView,
} from "../../lib/timelineWaveGeometry";
import { PLAYHEAD_SCRUB_ARM_PX } from "../../lib/waveLongPress";
import { panWaveViewStartForPlayheadAtClientX } from "../../lib/waveTimelineSeek";

const MIN_ZOOM = 1;
const MAX_ZOOM = 48;
/** +/- ボタン: 1回あたり 10% ずつ拡大・縮小 */
const ZOOM_BUTTON_STEP = 1.1;
const DOUBLE_TAP_MS = 350;
const LONG_PRESS_MS = 520;
const PORTRAIT_WAVE_CSS_H = 96;
const DEFAULT_WAVE_HEIGHT_PX = PORTRAIT_WAVE_CSS_H;
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
  /** false のとき再生ボタン行を出さず波形・目盛りのみ（横画面下部用） */
  showTransportControls?: boolean;
  /** 波形キャンバスの CSS 高さ（px） */
  waveHeightPx?: number;
  className?: string;
  /** 横画面: タイムライン左端の畳むボタン */
  onCollapseWave?: () => void;
}

export type PortraitWaveTransportHandle = {
  skipBack: () => void;
  skipForward: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

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

export const PortraitWaveTransport = forwardRef<PortraitWaveTransportHandle, Props>(function PortraitWaveTransport(
  {
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onStop,
  onSeek,
  showTransportControls = true,
  waveHeightPx = DEFAULT_WAVE_HEIGHT_PX,
  className,
  onCollapseWave,
  },
  ref
) {
  const registered = useTimelineWaveBridgeStore((s) => s.registered);
  const bridgeApi = useTimelineWaveBridgeStore((s) => s.api);
  const waveLoadProgress = useWaveformLoadProgressStore((s) => s.progress);
  const hasPeaks = Boolean(bridgeApi?.hasPeaks);
  const isLoadError = waveLoadProgress?.error === true;
  const showWaveLoadOverlay =
    !hasPeaks && waveLoadProgress != null && !isLoadError;
  const syncPortraitView = useTimelineWaveBridgeStore((s) => s.syncPortraitView);
  const setPortraitActive = useTimelineWaveBridgeStore((s) => s.setPortraitActive);
  const setPortraitCanvasRef = useTimelineWaveBridgeStore((s) => s.setPortraitCanvasRef);
  const setPortraitPlayheadLineRef = useTimelineWaveBridgeStore(
    (s) => s.setPortraitPlayheadLineRef
  );
  const trimStartSec = useMobileShellBridgeStore((s) => s.trimStartSec);
  const trimEndSec = useMobileShellBridgeStore((s) => s.trimEndSec);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadLineRef = useRef<HTMLDivElement>(null);
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
  const playheadScrubArmedRef = useRef(false);
  const playheadOriginRef = useRef({ x: 0, y: 0 });
  const scrubSessionRef = useRef<PlaybackScrubSession | null>(null);

  const viewDuration = duration > 0 ? duration / zoom : 0;
  const viewPortion = Math.min(1, Math.max(0.02, zoom > 0 ? 1 / zoom : 1));

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

  const waveDrawView = useMemo(
    () =>
      duration <= 0
        ? { start: 0, span: 1, end: 1 }
        : resolveWaveDrawView({
            durationSec: duration,
            viewPortion,
            anchorTimeSec: playheadSecForUi,
            isPlaying,
            viewStartOverride: isPlaying ? null : viewStart,
          }),
    [duration, viewPortion, playheadSecForUi, isPlaying, viewStart]
  );

  const viewEnd = waveDrawView.end;

  const rulerTicks = useMemo(
    () =>
      waveDrawView.span > 0
        ? waveRulerTicks(waveDrawView.start, waveDrawView.end, 8)
        : [],
    [waveDrawView.start, waveDrawView.end, waveDrawView.span]
  );

  const clearPendingSingleTap = useCallback(() => {
    if (pendingSingleTapRef.current != null) {
      window.clearTimeout(pendingSingleTapRef.current);
      pendingSingleTapRef.current = null;
    }
  }, []);

  useEffect(() => {
    setPortraitCanvasRef(canvasRef);
    setPortraitPlayheadLineRef(playheadLineRef);
    setPortraitActive(true);
    return () => {
      clearPendingSingleTap();
      setPortraitActive(false);
      setPortraitCanvasRef(null);
      setPortraitPlayheadLineRef(null);
    };
  }, [
    setPortraitActive,
    setPortraitCanvasRef,
    setPortraitPlayheadLineRef,
    clearPendingSingleTap,
  ]);

  useEffect(() => {
    syncPortraitView(viewStart, zoom);
  }, [viewStart, zoom, syncPortraitView, duration]);

  useEffect(() => {
    setViewStart((v) => clampViewStart(v, viewDuration, duration));
  }, [zoom, duration, viewDuration]);

  useEffect(() => {
    if (!isPlaying || zoom <= 1 || duration <= 0) return;
    if (scrubActiveRef.current || playheadDragRef.current) return;
    const { start } = getWaveViewForDraw(duration, viewPortion, playheadSecForUi);
    setViewStart((vs) => {
      const next = clampViewStart(start, viewDuration, duration);
      return Math.abs(vs - next) < 0.001 ? vs : next;
    });
  }, [playheadSecForUi, isPlaying, zoom, duration, viewPortion, viewDuration]);

  const resolvePlayheadTimeForDraw = useCallback(() => {
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

  const redraw = useCallback(() => {
    bridgeApi?.drawWaveformAt(resolvePlayheadTimeForDraw());
  }, [bridgeApi, resolvePlayheadTimeForDraw]);

  const syncCanvasBitmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.getBoundingClientRect().width;
    if (cssW <= 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(280, Math.round(cssW * dpr));
    const bh = Math.round(waveHeightPx * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    redraw();
  }, [redraw, waveHeightPx]);

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
  }, [registered, currentTime, zoom, viewStart, redraw, waveDrawView.start]);

  const timeFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = viewportRef.current;
      if (!el || duration <= 0 || waveDrawView.span <= 0) return null;
      const r = el.getBoundingClientRect();
      const xPx = Math.max(0, Math.min(r.width, clientX - r.left));
      return waveExtentXToTime(
        xPx,
        waveDrawView.start,
        waveDrawView.span,
        r.width
      );
    },
    [duration, waveDrawView.start, waveDrawView.span]
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
      seekPlaybackDuringScrub(
        {
          t,
          durationSec: duration,
          trimStartSec,
          trimEndSec,
          roundHeadForStore: true,
        },
        scrubSessionRef.current
      );
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

  /** ズーム中: タップ／ドラッグ位置に赤バーが来るよう表示窓を合わせてからシーク */
  const portraitSeekAtClientX = useCallback(
    (clientX: number, end = false) => {
      if (!end && zoom > 1.001 && duration > 0) {
        const canvas = canvasRef.current;
        const t = timeFromClientX(clientX);
        if (canvas && t != null) {
          const followStart = panWaveViewStartForPlayheadAtClientX({
            scrubTimeSec: t,
            clientX,
            canvasRect: canvas.getBoundingClientRect(),
            durationSec: duration,
            viewPortion,
          });
          if (followStart != null) {
            viewStartRef.current = followStart;
            setViewStart(followStart);
            syncPortraitView(followStart, zoom);
          }
        }
      }
      handlePortraitWaveScrub(clientX, end);
    },
    [
      zoom,
      duration,
      timeFromClientX,
      viewPortion,
      syncPortraitView,
      handlePortraitWaveScrub,
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
      portraitSeekAtClientX(e.clientX);
    },
    [audioUrl, duration, portraitSeekAtClientX, clearPendingSingleTap, startScrubSession]
  );

  const onRulerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.buttons & 1) || !audioUrl || duration <= 0) return;
      portraitSeekAtClientX(e.clientX);
    },
    [audioUrl, duration, portraitSeekAtClientX]
  );

  const onRulerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      portraitSeekAtClientX(e.clientX, true);
    },
    [portraitSeekAtClientX]
  );

  const applyZoomAt = useCallback(
    (nextZoom: number, anchorTimeSec: number) => {
      if (duration <= 0) return;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const newVd = duration / z;
      const newPortion = 1 / z;
      setZoom(z);
      if (isPlaying) {
        const { start } = getWaveViewForDraw(duration, newPortion, anchorTimeSec);
        setViewStart(clampViewStart(start, newVd, duration));
        return;
      }
      const oldVd = duration / zoom;
      const anchorRatio = oldVd > 0 ? (anchorTimeSec - viewStart) / oldVd : 0.5;
      setViewStart(
        clampViewStart(anchorTimeSec - anchorRatio * newVd, newVd, duration)
      );
    },
    [duration, zoom, viewStart, isPlaying]
  );

  /** +/- ボタン: 再生バーの位置を画面中央に保ちながら拡大・縮小 */
  const applyZoomCenteredOnPlayhead = useCallback(
    (nextZoom: number, anchorTimeSec: number) => {
      if (duration <= 0) return;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const newVd = duration / z;
      const newPortion = 1 / z;
      setZoom(z);
      if (isPlaying) {
        const { start } = getWaveViewForDraw(duration, newPortion, anchorTimeSec);
        setViewStart(clampViewStart(start, newVd, duration));
        return;
      }
      setViewStart(clampViewStart(anchorTimeSec - newVd / 2, newVd, duration));
    },
    [duration, isPlaying]
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
      playheadDragRef.current = true;
      playheadScrubArmedRef.current = true;
      playheadOriginRef.current = { x: e.clientX, y: e.clientY };
      startScrubSession();
      portraitSeekAtClientX(e.clientX);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [audioUrl, duration, clearPendingSingleTap, clearLongPress, startScrubSession, portraitSeekAtClientX]
  );

  const onPlayheadPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!playheadDragRef.current || !(e.buttons & 1)) return;
      if (!playheadScrubArmedRef.current) {
        const { x, y } = playheadOriginRef.current;
        if (Math.hypot(e.clientX - x, e.clientY - y) < PLAYHEAD_SCRUB_ARM_PX) return;
        playheadScrubArmedRef.current = true;
        startScrubSession();
      }
      e.preventDefault();
      portraitSeekAtClientX(e.clientX);
    },
    [portraitSeekAtClientX, startScrubSession]
  );

  const endPlayheadDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!playheadDragRef.current) return;
      const wasArmed = playheadScrubArmedRef.current;
      playheadDragRef.current = false;
      playheadScrubArmedRef.current = false;
      if (wasArmed) portraitSeekAtClientX(e.clientX, true);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [portraitSeekAtClientX]
  );

  const isNearPlayhead = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0 || waveDrawView.span <= 0) return false;
      return hitPlayheadStripForScrub(
        clientX,
        canvas,
        waveDrawView.start,
        waveDrawView.span,
        playheadSecForUi,
        duration,
        PORTRAIT_PLAYHEAD_SCRUB_HALF_WIDTH_PX
      );
    },
    [duration, waveDrawView.start, waveDrawView.span, playheadSecForUi]
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
        bridgeApi.openWaveCueMenuAtPointer?.(e.clientX, e.clientY);
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
          suppressClickRef.current = true;
          bridgeApi.handlers.onWaveClick(synthMouseEvent("click", e));
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

  useImperativeHandle(
    ref,
    () => ({
      skipBack: handleSkipBack,
      skipForward: handleSkipForward,
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
    }),
    [handleSkipBack, handleSkipForward, handleZoomIn, handleZoomOut]
  );

  return (
    <div
      className={`${styles.transport} ${showTransportControls ? "" : styles.transportWaveOnly} ${onCollapseWave ? styles.transportWaveOnlyWithCollapse : ""} ${className ?? ""}`.trim()}
      style={{ ["--portrait-wave-h" as string]: `${waveHeightPx}px` } as React.CSSProperties}
    >
      {showTransportControls ? (
      <div className={styles.row}>
        <div className={`${ctrlStyles.controls} ${styles.rowControls}`}>
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
        </span>
      </div>
      ) : null}

      {!showTransportControls ? (
        <div className={styles.waveOnlyMetaRow}>
          <span
            className={`${styles.waveOnlyStatus}${isLoadError ? ` ${styles.waveOnlyStatusError}` : ""}`}
            aria-live="polite"
          >
            {waveLoadProgress?.message ??
              (!audioUrl
                ? "音源未設定 — Menu → 音源追加"
                : !hasPeaks
                  ? registered
                    ? "波形を読み込み中…"
                    : "波形を準備中…"
                  : "")}
            {waveLoadProgress && !isLoadError ? (
              <span className={styles.waveOnlyPct}>
                {Math.round((waveLoadProgress.ratio ?? 0) * 100)}%
              </span>
            ) : null}
          </span>
          <span className={styles.waveOnlyTime}>
            {fmt(currentTime)}
            <span className={styles.timeSep}>/</span>
            {fmt(duration)}
          </span>
        </div>
      ) : null}

      <div className={styles.waveFrame}>
        <div className={styles.waveTimelineBody}>
        <div className={styles.waveRulerWrap}>
          {onCollapseWave ? (
            <button
              type="button"
              className={styles.rulerCollapseBtn}
              onClick={(e) => {
                e.stopPropagation();
                onCollapseWave();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="波形を畳む"
              title="波形を畳む"
            >
              <span className={styles.rulerCollapseTriangle} aria-hidden />
            </button>
          ) : null}
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
            const pct = waveTimeToPercent(tick, waveDrawView.start, waveDrawView.span);
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
            aria-label="波形（タップで再生位置を移動・ダブルタップでキュー追加・ドラッグでキュー調整・キュー内長押しで操作メニュー・間を長押しで導線メニュー）"
          />
          {showWaveLoadOverlay ? (
            <WaveformLoadOverlay visible compact className={styles.wavePlaceholder} />
          ) : null}
        </div>
        {duration > 0 && waveDrawView.span > 0 ? (
          <div
            ref={playheadLineRef}
            className={styles.playheadLine}
            style={{ left: "0%" }}
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
    </div>
  );
});
