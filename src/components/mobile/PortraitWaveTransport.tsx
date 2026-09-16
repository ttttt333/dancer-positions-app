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
  TransportIconWaveZoomBig,
  TransportIconWaveZoomFit,
  TransportIconZoomIn,
  TransportIconZoomOut,
} from "./TransportIcons";
import { abortTimelineWavePointerGestures } from "../../lib/abortTimelineWavePointerGestures";
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
  waveExtentXToTime,
  waveTimeToPercent,
  resolveWaveDrawView,
  resolveWavePlayheadFollowViewStart,
  PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC,
} from "../../lib/timelineWaveGeometry";
import { PLAYHEAD_SCRUB_ARM_PX } from "../../lib/waveLongPress";
import { computeZoomToSelectedCue } from "../../lib/waveCueEditZoom";
import {
  CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH,
  PLAYHEAD_SCRUB_EDGE_SCROLL_PAN_STRENGTH,
  WAVE_EDGE_SCROLL_PAN_STRENGTH,
  WAVE_EDGE_SCROLL_ZONE_MIN_PX,
  WAVE_EDGE_SCROLL_ZONE_RATIO,
} from "../../lib/waveEdgeScrollDuringScrub";

const MIN_ZOOM = 1;
const MAX_ZOOM = 48;
/** +/- ボタン: 1回あたり 10% ずつ拡大・縮小 */
const ZOOM_BUTTON_STEP = 1.1;
/** 選択キューがないときの「調整用」フォールバック（画面に約 10 秒分） */
const FALLBACK_EDIT_VIEW_SPAN_SEC = 10;
const DOUBLE_TAP_MS = 450;
const LONG_PRESS_MS = 520;
const PORTRAIT_WAVE_CSS_H = 96;
const DEFAULT_WAVE_HEIGHT_PX = PORTRAIT_WAVE_CSS_H;
/** この距離未満の指の動きはタップ扱い（シーク） */
const TAP_MAX_MOVE_PX = 8;
/**
 * この距離を超えたらキュー枠ドラッグを開始（長押しメニューはキャンセル）。
 * ピンチズームは無効化し、拡大縮小は +/- ボタンのみ。
 */
const CUE_DRAG_ARM_PX = 6;

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
  /** 横画面下部: 上部余白・時刻表示を省きステージ領域を確保 */
  compactLandscape?: boolean;
  /** true のとき目盛り左上の折りたたみボタンを出さない（親ドックのヘッダーで操作） */
  hideRulerCollapseButton?: boolean;
  /**
   * 縦画面 FODI 風: 再生ボタンを波形左に置き、上部の操作行を出さない。
   * ズーム・±5 は親（PortraitBottomBar）から imperative handle で呼ぶ。
   */
  fodiChrome?: boolean;
}

export type PortraitWaveTransportHandle = {
  skipBack: () => void;
  skipForward: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** 選択キューが調整しやすい倍率へ一気にズーム（旧 zoomToBig） */
  zoomToBig: () => void;
  zoomToSelectedCue: () => void;
  /** 曲全体が見える最小倍率へ一気にズーム */
  zoomToFit: () => void;
};

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function clampViewStart(
  viewStart: number,
  viewDuration: number,
  dur: number,
  leadInFrac?: number
): number {
  if (dur <= 0) return 0;
  if (leadInFrac != null && viewDuration > 0) {
    const minStart = -leadInFrac * viewDuration;
    const maxStart = Math.max(minStart, dur - leadInFrac * viewDuration);
    return Math.max(minStart, Math.min(maxStart, viewStart));
  }
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
  compactLandscape = false,
  hideRulerCollapseButton = false,
  fodiChrome = false,
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
  const waveTimelineBodyRef = useRef<HTMLDivElement>(null);
  const storedViewport = useTimelineWaveBridgeStore.getState().portraitViewport;
  const portraitViewportRevision = useTimelineWaveBridgeStore(
    (s) => s.portraitViewportRevision
  );
  const [zoom, setZoom] = useState(storedViewport.zoom);
  const zoomRef = useRef(storedViewport.zoom);
  zoomRef.current = zoom;
  const [viewStart, setViewStart] = useState(storedViewport.viewStart);
  const viewStartRef = useRef(storedViewport.viewStart);
  viewStartRef.current = viewStart;
  const lastTapRef = useRef(0);
  const pendingSingleTapRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressDoubleClickRef = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  /** 1本指のみ（2本目は無視。ピンチズームは +/- ボタン専用） */
  const activePointerIdRef = useRef<number | null>(null);
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
  /** FODI 風: 波形を横スライド（再生バーは画面上で固定） */
  const waveSlideRef = useRef<{ lastX: number; pointerId: number } | null>(null);

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
            /**
             * FODI 風: 再生中も viewStart を使い、再生バー位置を固定して波形をスライド。
             * （null にすると中央追従の別経路になり、やや左固定が効かない）
             */
            viewStartOverride: fodiChrome ? viewStart : isPlaying ? null : viewStart,
          }),
    [duration, viewPortion, playheadSecForUi, isPlaying, viewStart, fodiChrome]
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
    const next = useTimelineWaveBridgeStore.getState().portraitViewport;
    setZoom(next.zoom);
    zoomRef.current = next.zoom;
    setViewStart(next.viewStart);
    viewStartRef.current = next.viewStart;
  }, [portraitViewportRevision]);

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
    setViewStart((v) =>
      clampViewStart(
        v,
        viewDuration,
        duration,
        fodiChrome ? PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC : undefined
      )
    );
  }, [zoom, duration, viewDuration, fodiChrome]);

  useEffect(() => {
    /**
     * FODI 風: 再生中・停止中どちらも再生バーを左寄りに固定する。
     * 曲頭は viewStart を負にして、バー左側に余白・波形はバーより右から開始。
     * （全体表示でも lead-in でバー位置を固定）
     */
    if (!fodiChrome || duration <= 0) return;
    if (
      scrubActiveRef.current ||
      playheadDragRef.current ||
      waveSlideRef.current
    ) {
      return;
    }
    const start = resolveWavePlayheadFollowViewStart(
      playheadSecForUi,
      duration,
      viewPortion,
      PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC,
      { allowLeadIn: true }
    );
    setViewStart((vs) => {
      const next = clampViewStart(
        start,
        viewDuration > 0 ? viewDuration : duration,
        duration,
        PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC
      );
      return Math.abs(vs - next) < 0.001 ? vs : next;
    });
  }, [
    playheadSecForUi,
    fodiChrome,
    zoom,
    duration,
    viewPortion,
    viewDuration,
    isPlaying,
  ]);

  /**
   * FODI 風: 再生中は rAF で viewStart を毎フレーム更新し、再生バーを左寄り固定・波形スライド。
   */
  useEffect(() => {
    if (!fodiChrome || !isPlaying || duration <= 0) return;
    let raf = 0;
    const tick = () => {
      if (
        !scrubActiveRef.current &&
        !playheadDragRef.current &&
        !waveSlideRef.current
      ) {
        const eng = playbackEngine.getCurrentTime();
        if (Number.isFinite(eng)) {
          const start = resolveWavePlayheadFollowViewStart(
            eng,
            duration,
            viewPortion,
            PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC,
            { allowLeadIn: true }
          );
          const next = clampViewStart(
            start,
            viewDuration > 0 ? viewDuration : duration,
            duration,
            PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC
          );
          setViewStart((vs) => (Math.abs(vs - next) < 0.0004 ? vs : next));
          bridgeApi?.drawWaveformAt(eng);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    fodiChrome,
    isPlaying,
    zoom,
    duration,
    viewPortion,
    viewDuration,
    bridgeApi,
  ]);

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
      if (!el || duration <= 0) return null;
      const z = zoomRef.current;
      const viewSpan = z > 0 ? duration / z : duration;
      if (viewSpan <= 0) return null;
      const r = el.getBoundingClientRect();
      const xPx = Math.max(0, Math.min(r.width, clientX - r.left));
      return waveExtentXToTime(
        xPx,
        viewStartRef.current,
        viewSpan,
        r.width
      );
    },
    [duration]
  );

  const edgeScrollAtClientX = useCallback(
    (clientX: number, panStrength = WAVE_EDGE_SCROLL_PAN_STRENGTH) => {
      const z = zoomRef.current;
      if (z <= 1.001 || duration <= 0) return;
      const el = viewportRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return;
      const vd = duration / z;
      const zone = Math.max(
        WAVE_EDGE_SCROLL_ZONE_MIN_PX,
        r.width * WAVE_EDGE_SCROLL_ZONE_RATIO
      );
      const vs = viewStartRef.current;
      let next = vs;

      if (clientX <= r.left + zone) {
        const depth = 1 - Math.max(0, (clientX - r.left) / zone);
        const pan = vd * (0.016 + 0.065 * depth) * panStrength;
        next = clampViewStart(
          vs - pan,
          vd,
          duration,
          fodiChrome ? PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC : undefined
        );
      } else if (clientX >= r.right - zone) {
        const depth = 1 - Math.max(0, (r.right - clientX) / zone);
        const pan = vd * (0.016 + 0.065 * depth) * panStrength;
        next = clampViewStart(
          vs + pan,
          vd,
          duration,
          fodiChrome ? PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC : undefined
        );
      } else {
        return;
      }
      if (next === vs) return;
      viewStartRef.current = next;
      setViewStart(next);
      syncPortraitView(next, z);
      bridgeApi?.drawWaveformAt(resolvePlayheadTimeForDraw());
    },
    [
      duration,
      syncPortraitView,
      bridgeApi,
      resolvePlayheadTimeForDraw,
      fodiChrome,
    ]
  );

  const resolveEdgeScrollPanStrength = useCallback((shouldSeek: boolean) => {
    if (
      !shouldSeek &&
      useTimelineWaveBridgeStore.getState().portraitWaveEdgeScrollTick != null
    ) {
      return CUE_DRAG_EDGE_SCROLL_PAN_STRENGTH;
    }
    if (shouldSeek) {
      return PLAYHEAD_SCRUB_EDGE_SCROLL_PAN_STRENGTH;
    }
    return WAVE_EDGE_SCROLL_PAN_STRENGTH;
  }, []);

  const isInEdgeScrollZone = useCallback((clientX: number) => {
    const el = viewportRef.current;
    const z = zoomRef.current;
    if (!el || z <= 1.001) return false;
    const r = el.getBoundingClientRect();
    const zone = Math.max(
      WAVE_EDGE_SCROLL_ZONE_MIN_PX,
      r.width * WAVE_EDGE_SCROLL_ZONE_RATIO
    );
    return clientX <= r.left + zone || clientX >= r.right - zone;
  }, []);

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
    const panStrength = resolveEdgeScrollPanStrength(scrubShouldSeekRef.current);
    edgeScrollAtClientX(x, panStrength);
    if (scrubShouldSeekRef.current) {
      const t = timeFromClientX(x);
      if (t != null) seekDuringScrub(t);
    } else {
      useTimelineWaveBridgeStore.getState().portraitWaveEdgeScrollTick?.(x);
    }
    edgeScrollRafRef.current = requestAnimationFrame(tickEdgeScrollLoop);
  }, [
    edgeScrollAtClientX,
    isInEdgeScrollZone,
    resolveEdgeScrollPanStrength,
    timeFromClientX,
    seekDuringScrub,
  ]);

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
      const panStrength = resolveEdgeScrollPanStrength(shouldSeek);
      if (shouldSeek) {
        edgeScrollAtClientX(clientX, panStrength);
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
      resolveEdgeScrollPanStrength,
      timeFromClientX,
      seekDuringScrub,
      stopEdgeScrollLoop,
      tickEdgeScrollLoop,
      finishScrubSession,
    ]
  );

  /** ズーム中も端スクロール＋即時 viewStart でシーク（パン競合で左に戻らない） */
  const portraitSeekAtClientX = useCallback(
    (clientX: number, end = false) => {
      handlePortraitWaveScrub(clientX, end);
    },
    [handlePortraitWaveScrub]
  );

  /** FODI: スライド可能な倍率へ（全体表示のままではバーが横移動してしまう） */
  const ensureFodiSlideZoom = useCallback(() => {
    if (!fodiChrome || duration <= 0) return;
    if (zoomRef.current > 1.08) return;
    const targetSpan = Math.min(duration, Math.max(8, duration / 12));
    const z = Math.min(MAX_ZOOM, Math.max(1.25, duration / targetSpan));
    const newVd = duration / z;
    const newPortion = 1 / z;
    const t = (() => {
      if (
        isPlaying &&
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
      ) {
        return playbackEngine.getCurrentTime();
      }
      return currentTime;
    })();
    setZoom(z);
    zoomRef.current = z;
    const start = resolveWavePlayheadFollowViewStart(
      t,
      duration,
      newPortion,
      PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC,
      { allowLeadIn: true }
    );
    const next = clampViewStart(
      start,
      newVd,
      duration,
      PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC
    );
    viewStartRef.current = next;
    setViewStart(next);
  }, [fodiChrome, duration, isPlaying, currentTime]);

  /**
   * FODI: 指の横移動分だけ時刻を動かし、再生バーは画面左寄りに固定したまま波形をスライド。
   */
  const slideWaveByDeltaX = useCallback(
    (deltaX: number) => {
      if (!fodiChrome || duration <= 0) return;
      const el = viewportRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      if (w <= 1) return;
      ensureFodiSlideZoom();
      const z = zoomRef.current;
      const span = duration / z;
      if (span <= 0) return;
      const base =
        isPlaying &&
        playbackEngine.getMediaSourceUrl() &&
        !playbackEngine.isPaused() &&
        Number.isFinite(playbackEngine.getCurrentTime())
          ? playbackEngine.getCurrentTime()
          : currentTime;
      const dt = -(deltaX / w) * span;
      const newT = Math.max(0, Math.min(duration, base + dt));
      startScrubSession();
      seekDuringScrub(newT);
      const portion = Math.min(1, Math.max(0.02, 1 / z));
      const start = resolveWavePlayheadFollowViewStart(
        newT,
        duration,
        portion,
        PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC,
        { allowLeadIn: true }
      );
      const next = clampViewStart(
        start,
        span,
        duration,
        PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC
      );
      viewStartRef.current = next;
      setViewStart(next);
      bridgeApi?.drawWaveformAt(newT);
    },
    [
      fodiChrome,
      duration,
      ensureFodiSlideZoom,
      isPlaying,
      currentTime,
      startScrubSession,
      seekDuringScrub,
      bridgeApi,
    ]
  );

  const endWaveSlide = useCallback(() => {
    if (!waveSlideRef.current) return;
    waveSlideRef.current = null;
    finishScrubSession();
  }, [finishScrubSession]);

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
      if (fodiChrome) {
        ensureFodiSlideZoom();
        startScrubSession();
        waveSlideRef.current = { lastX: e.clientX, pointerId: e.pointerId };
        return;
      }
      startScrubSession();
      portraitSeekAtClientX(e.clientX);
    },
    [
      audioUrl,
      duration,
      portraitSeekAtClientX,
      clearPendingSingleTap,
      startScrubSession,
      fodiChrome,
      ensureFodiSlideZoom,
    ]
  );

  const onRulerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!(e.buttons & 1) || !audioUrl || duration <= 0) return;
      if (fodiChrome && waveSlideRef.current) {
        const dx = e.clientX - waveSlideRef.current.lastX;
        waveSlideRef.current.lastX = e.clientX;
        if (dx !== 0) slideWaveByDeltaX(dx);
        return;
      }
      portraitSeekAtClientX(e.clientX);
    },
    [audioUrl, duration, portraitSeekAtClientX, fodiChrome, slideWaveByDeltaX]
  );

  const onRulerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (fodiChrome && waveSlideRef.current) {
        endWaveSlide();
        return;
      }
      portraitSeekAtClientX(e.clientX, true);
    },
    [portraitSeekAtClientX, fodiChrome, endWaveSlide]
  );

  /** +/- ボタン: 再生バー位置を保ちながら拡大・縮小（FODI 風はやや左固定） */
  const applyZoomCenteredOnPlayhead = useCallback(
    (nextZoom: number, anchorTimeSec: number) => {
      if (duration <= 0) return;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const newVd = duration / z;
      const newPortion = 1 / z;
      const frac = fodiChrome
        ? PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC
        : 0.5;
      const leadIn = fodiChrome ? PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC : undefined;
      setZoom(z);
      if (fodiChrome || isPlaying) {
        const start = resolveWavePlayheadFollowViewStart(
          anchorTimeSec,
          duration,
          newPortion,
          frac,
          fodiChrome ? { allowLeadIn: true } : undefined
        );
        setViewStart(clampViewStart(start, newVd, duration, leadIn));
        return;
      }
      setViewStart(
        clampViewStart(anchorTimeSec - frac * newVd, newVd, duration, leadIn)
      );
    },
    [duration, isPlaying, fodiChrome]
  );

  const applyZoomWithViewStart = useCallback(
    (nextZoom: number, nextViewStart: number) => {
      if (duration <= 0) return;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
      const newVd = duration / z;
      setZoom(z);
      setViewStart(
        clampViewStart(
          nextViewStart,
          newVd,
          duration,
          fodiChrome ? PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC : undefined
        )
      );
    },
    [duration, fodiChrome]
  );

  /**
   * FODI 風: 全体表示のまま再生すると再生バーが横移動してしまうので、
   * 再生開始時に自動で「スライド追従できる倍率」へ上げる。
   */
  useEffect(() => {
    if (!fodiChrome || !isPlaying || duration <= 0) return;
    if (zoom > 1.08) return;
    const targetSpan = Math.min(duration, Math.max(8, duration / 12));
    const z = Math.min(MAX_ZOOM, Math.max(1.25, duration / targetSpan));
    applyZoomCenteredOnPlayhead(z, playheadSecForUi);
    // 再生開始の一度だけ。zoom を依存に入れると拡大ループになる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fodiChrome, isPlaying, duration, applyZoomCenteredOnPlayhead]);

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

  const beginPortraitPlayheadDrag = useCallback(
    (clientX: number, clientY: number, pointerId: number) => {
      clearPendingSingleTap();
      clearLongPress();
      if (fodiChrome) {
        /** 再生バー掴みも「波形スライド」— バーは画面上で動かさない */
        ensureFodiSlideZoom();
        startScrubSession();
        waveSlideRef.current = { lastX: clientX, pointerId };
        try {
          waveTimelineBodyRef.current?.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      playheadDragRef.current = true;
      playheadScrubArmedRef.current = true;
      playheadOriginRef.current = { x: clientX, y: clientY };
      startScrubSession();
      portraitSeekAtClientX(clientX);
      try {
        waveTimelineBodyRef.current?.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    },
    [
      clearPendingSingleTap,
      clearLongPress,
      fodiChrome,
      ensureFodiSlideZoom,
      startScrubSession,
      portraitSeekAtClientX,
    ]
  );

  const onPlayheadPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !audioUrl || duration <= 0) return;
      /** FODI: 再生バー固定。スクロールは秒数目盛りで行う */
      if (fodiChrome) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      beginPortraitPlayheadDrag(e.clientX, e.clientY, e.pointerId);
    },
    [audioUrl, duration, beginPortraitPlayheadDrag, fodiChrome]
  );

  const onTimelinePlayheadPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (waveSlideRef.current && waveSlideRef.current.pointerId === e.pointerId) {
        e.preventDefault();
        const dx = e.clientX - waveSlideRef.current.lastX;
        waveSlideRef.current.lastX = e.clientX;
        if (dx !== 0) slideWaveByDeltaX(dx);
        return;
      }
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
    [portraitSeekAtClientX, startScrubSession, slideWaveByDeltaX]
  );

  const endPlayheadDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (waveSlideRef.current && waveSlideRef.current.pointerId === e.pointerId) {
        endWaveSlide();
        try {
          waveTimelineBodyRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      if (!playheadDragRef.current) return;
      const wasArmed = playheadScrubArmedRef.current;
      playheadDragRef.current = false;
      playheadScrubArmedRef.current = false;
      if (wasArmed) portraitSeekAtClientX(e.clientX, true);
      try {
        waveTimelineBodyRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [portraitSeekAtClientX, endWaveSlide]
  );

  const isNearPlayhead = useCallback(
    (clientX: number) => {
      /** FODI: 再生バーは固定。波形上のドラッグでは掴まず、スクロールは秒数目盛り側 */
      if (fodiChrome) return false;
      const canvas = canvasRef.current;
      if (!canvas || duration <= 0 || waveDrawView.span <= 0) return false;
      /**
       * 再生ヘッドの排他ヒットは狭めに。キュー枠端と重なるとき枠操作を優先させる。
       * （描画ヒット帯 44px より狭い）
       */
      return hitPlayheadStripForScrub(
        clientX,
        canvas,
        waveDrawView.start,
        waveDrawView.span,
        playheadSecForUi,
        duration,
        22
      );
    },
    [
      duration,
      waveDrawView.start,
      waveDrawView.span,
      playheadSecForUi,
      fodiChrome,
    ]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;
      // 2本目以降は無視（ピンチ拡大・縮小は +/- ボタンのみ）
      if (activePointerIdRef.current != null && activePointerIdRef.current !== e.pointerId) {
        return;
      }
      clearPendingSingleTap();
      activePointerIdRef.current = e.pointerId;
      longPressFiredRef.current = false;
      dragArmedRef.current = false;
      waveSlideRef.current = null;
      pointerDownRef.current = e;
      pointerDownOriginRef.current = { x: e.clientX, y: e.clientY };

      if (isNearPlayhead(e.clientX)) {
        e.preventDefault();
        e.stopPropagation();
        beginPortraitPlayheadDrag(e.clientX, e.clientY, e.pointerId);
        return;
      }

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      longPressTimerRef.current = window.setTimeout(() => {
        longPressFiredRef.current = true;
        pointerDownRef.current = null;
        pointerDownOriginRef.current = null;
        dragArmedRef.current = false;
        waveSlideRef.current = null;
        abortTimelineWavePointerGestures();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(12);
        }
        bridgeApi.openWaveCueMenuAtPointer?.(e.clientX, e.clientY);
      }, LONG_PRESS_MS);
    },
    [bridgeApi, clearPendingSingleTap, isNearPlayhead, beginPortraitPlayheadDrag]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!bridgeApi?.handlers) return;
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) {
        return;
      }

      if (waveSlideRef.current && waveSlideRef.current.pointerId === e.pointerId) {
        e.preventDefault();
        const dx = e.clientX - waveSlideRef.current.lastX;
        waveSlideRef.current.lastX = e.clientX;
        if (dx !== 0) slideWaveByDeltaX(dx);
        return;
      }

      if (playheadDragRef.current && (e.buttons & 1)) {
        e.preventDefault();
        portraitSeekAtClientX(e.clientX);
        return;
      }

      const origin = pointerDownOriginRef.current;
      if (origin && !longPressFiredRef.current) {
        const dist = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
        if (dist > CUE_DRAG_ARM_PX) {
          clearLongPress();
          clearPendingSingleTap();
          /**
           * FODI: 波形キャンバスではスクロールしない（秒数目盛り側でスライド）。
           * ここでのドラッグはキュー枠の調整のみ。
           */
          if (!dragArmedRef.current && pointerDownRef.current) {
            armCanvasDrag(pointerDownRef.current);
          }
        }
      }

      if (dragArmedRef.current) {
        bridgeApi.handlers.onWaveCanvasPointerMove(e);
      }
    },
    [
      bridgeApi,
      clearLongPress,
      clearPendingSingleTap,
      armCanvasDrag,
      portraitSeekAtClientX,
      slideWaveByDeltaX,
    ]
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
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) {
        return;
      }
      clearLongPress();
      const origin = pointerDownOriginRef.current;
      const movedPx =
        origin != null
          ? Math.hypot(e.clientX - origin.x, e.clientY - origin.y)
          : 0;
      const wasWaveSlide = waveSlideRef.current != null;
      if (wasWaveSlide) endWaveSlide();
      activePointerIdRef.current = null;
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

      if (wasWaveSlide) {
        suppressClickRef.current = true;
        dragArmedRef.current = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      const wasDragArmed = dragArmedRef.current;
      const treatAsTap = !wasDragArmed || movedPx <= TAP_MAX_MOVE_PX;
      dragArmedRef.current = false;

      if (treatAsTap && wasDragArmed) {
        // CUE_DRAG_ARM_PX を超えて武装したが TAP_MAX_MOVE_PX 以内なら
        // タップ扱いに戻す前にキュー枠ドラッグを破棄する。
        abortTimelineWavePointerGestures();
      }

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
          if (fodiChrome) {
            /**
             * 単タップ: その位置の時刻へシークし、再生バーは左寄り固定のまま波形を合わせる。
             */
            ensureFodiSlideZoom();
            const t = timeFromClientX(e.clientX);
            if (t != null) {
              startScrubSession();
              seekDuringScrub(t);
              finishScrubSession();
              const z = zoomRef.current;
              const span = duration / z;
              const portion = Math.min(1, Math.max(0.02, 1 / z));
              const start = resolveWavePlayheadFollowViewStart(
                t,
                duration,
                portion,
                PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC,
                { allowLeadIn: true }
              );
              const next = clampViewStart(
                start,
                span,
                duration,
                PORTRAIT_WAVE_PLAYHEAD_FOLLOW_FRAC
              );
              viewStartRef.current = next;
              setViewStart(next);
              bridgeApi.drawWaveformAt?.(t);
            }
          } else {
            bridgeApi.handlers.onWaveClick(synthMouseEvent("click", e));
          }
        }
      }

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [
      bridgeApi,
      clearLongPress,
      clearPendingSingleTap,
      endWaveSlide,
      fodiChrome,
      ensureFodiSlideZoom,
      timeFromClientX,
      startScrubSession,
      seekDuringScrub,
      finishScrubSession,
      duration,
    ]
  );

  const onPointerLeave = useCallback(() => {
    // pointer capture 中に leave が飛ぶことがあるので、長押し待ちは消さない。
    // ドラッグ開始後だけ TimelinePanel 側へ leave を伝える。
    if (longPressTimerRef.current != null && !dragArmedRef.current && !waveSlideRef.current) {
      return;
    }
    clearPendingSingleTap();
    if (dragArmedRef.current) {
      bridgeApi?.handlers.onWaveCanvasPointerLeave();
    }
  }, [bridgeApi, clearPendingSingleTap]);

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) {
        return;
      }
      clearLongPress();
      clearPendingSingleTap();
      if (waveSlideRef.current) endWaveSlide();
      if (dragArmedRef.current) {
        abortTimelineWavePointerGestures();
      }
      dragArmedRef.current = false;
      activePointerIdRef.current = null;
      pointerDownRef.current = null;
      pointerDownOriginRef.current = null;
    },
    [clearLongPress, clearPendingSingleTap, endWaveSlide]
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

  /** 選択キュー（または再生位置付近）を、端を掴みやすい大きさまで一気に拡大 */
  const handleZoomToSelectedCue = useCallback(() => {
    if (duration <= 0) return;
    const range = useMobileShellBridgeStore.getState().selectedCueRangeSec;
    const canvasW =
      canvasRef.current?.getBoundingClientRect().width ||
      waveTimelineBodyRef.current?.getBoundingClientRect().width ||
      360;
    if (range && range.endSec > range.startSec) {
      const next = computeZoomToSelectedCue({
        durationSec: duration,
        cueStartSec: range.startSec,
        cueEndSec: range.endSec,
        canvasCssWidthPx: canvasW,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
      });
      applyZoomWithViewStart(next.zoom, next.viewStartSec);
      return;
    }
    const span = Math.min(duration, FALLBACK_EDIT_VIEW_SPAN_SEC);
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, duration / span));
    applyZoomCenteredOnPlayhead(z, playheadSecForUi);
  }, [
    applyZoomCenteredOnPlayhead,
    applyZoomWithViewStart,
    duration,
    playheadSecForUi,
  ]);

  /** 波形全体表示: 曲の先頭から全体が見える倍率へ */
  const handleZoomToFit = useCallback(() => {
    applyZoomWithViewStart(MIN_ZOOM, 0);
  }, [applyZoomWithViewStart]);

  useImperativeHandle(
    ref,
    () => ({
      skipBack: handleSkipBack,
      skipForward: handleSkipForward,
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      zoomToBig: handleZoomToSelectedCue,
      zoomToSelectedCue: handleZoomToSelectedCue,
      zoomToFit: handleZoomToFit,
    }),
    [
      handleSkipBack,
      handleSkipForward,
      handleZoomIn,
      handleZoomOut,
      handleZoomToSelectedCue,
      handleZoomToFit,
    ]
  );

  const waveOnlyStatusText =
    waveLoadProgress?.message ??
    (!audioUrl
      ? "音源未設定 — Menu → 音源追加"
      : !hasPeaks
        ? registered
          ? "波形を読み込み中…"
          : "波形を準備中…"
        : "");

  const showWaveOnlyMetaRow =
    !showTransportControls &&
    (!compactLandscape || Boolean(waveOnlyStatusText) || showWaveLoadOverlay);

  return (
    <div
      className={`${styles.transport} ${fodiChrome ? styles.transportFodi : ""} ${showTransportControls && !fodiChrome ? "" : styles.transportWaveOnly} ${onCollapseWave ? styles.transportWaveOnlyWithCollapse : ""} ${compactLandscape ? styles.transportLandscapeCompact : ""} ${className ?? ""}`.trim()}
      style={{ ["--portrait-wave-h" as string]: `${waveHeightPx}px` } as React.CSSProperties}
    >
      {showTransportControls && !fodiChrome ? (
      <>
      <div className={styles.timeRow}>
        <span className={styles.timeText}>
          {fmt(currentTime)}
          <span className={styles.timeSep}>/</span>
          {fmt(duration)}
        </span>
      </div>
      <div className={styles.row}>
        <div className={`${ctrlStyles.controls} ${styles.rowControls}`}>
            <button
              className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn}`}
              onClick={handleSkipBack}
              disabled={!audioUrl}
              aria-label="5秒戻す"
            >
              <TransportIconSkipBack size={18} className={ctrlStyles.icon} />
              <span className={ctrlStyles.skipBadge}>5</span>
            </button>
            <button
              className={`${ctrlStyles.btn} ${ctrlStyles.skipBtn}`}
              onClick={handleSkipForward}
              disabled={!audioUrl}
              aria-label="5秒進める"
            >
              <TransportIconSkipForward size={18} className={ctrlStyles.icon} />
              <span className={ctrlStyles.skipBadge}>5</span>
            </button>
            <button
              className={`${ctrlStyles.btn} ${ctrlStyles.btnPrimary}`}
              onClick={onPlayPause}
              disabled={!audioUrl}
              aria-label={isPlaying ? "一時停止" : "再生"}
            >
              {isPlaying ? (
                <TransportIconPause size={20} className={ctrlStyles.iconPrimary} />
              ) : (
                <TransportIconPlay size={20} className={ctrlStyles.iconPrimary} />
              )}
            </button>
            <button
              className={ctrlStyles.btn}
              onClick={handleStop}
              disabled={!audioUrl}
              aria-label="停止して先頭へ"
            >
              <TransportIconStop size={16} className={ctrlStyles.icon} />
            </button>
          <div className={ctrlStyles.divider} aria-hidden />
            <button
              className={ctrlStyles.btn}
              onClick={handleZoomToFit}
              disabled={!audioUrl || zoom <= MIN_ZOOM + 0.01}
              aria-label="波形を全体表示"
              title="曲全体を表示"
            >
              <TransportIconWaveZoomFit size={18} className={ctrlStyles.icon} />
            </button>
            <button
              className={ctrlStyles.btn}
              onClick={handleZoomToSelectedCue}
              disabled={!audioUrl || zoom >= MAX_ZOOM - 0.01}
              aria-label="選択キューを調整しやすい大きさに拡大"
              title="選択キューを調整しやすい大きさに拡大"
            >
              <TransportIconWaveZoomBig size={18} className={ctrlStyles.icon} />
            </button>
            <button
              className={ctrlStyles.btn}
              onClick={handleZoomIn}
              disabled={!audioUrl || zoom >= MAX_ZOOM - 0.01}
              aria-label="波形を拡大"
              title="波形を拡大"
            >
              <TransportIconZoomIn size={18} className={ctrlStyles.icon} />
            </button>
            <button
              className={ctrlStyles.btn}
              onClick={handleZoomOut}
              disabled={!audioUrl || zoom <= MIN_ZOOM + 0.01}
              aria-label="波形を縮小"
              title="波形を縮小"
            >
              <TransportIconZoomOut size={18} className={ctrlStyles.icon} />
            </button>
        </div>
      </div>
      </>
      ) : null}

      {!showTransportControls && !fodiChrome && showWaveOnlyMetaRow ? (
        <div className={styles.waveOnlyMetaRow}>
          <span
            className={`${styles.waveOnlyStatus}${isLoadError ? ` ${styles.waveOnlyStatusError}` : ""}`}
            aria-live="polite"
          >
            {waveOnlyStatusText}
            {waveLoadProgress && !isLoadError ? (
              <span className={styles.waveOnlyPct}>
                {Math.round((waveLoadProgress.ratio ?? 0) * 100)}%
              </span>
            ) : null}
          </span>
          {!compactLandscape ? (
            <span className={styles.waveOnlyTime}>
              {fmt(currentTime)}
              <span className={styles.timeSep}>/</span>
              {fmt(duration)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={`${styles.waveFrame} ${fodiChrome ? styles.waveFrameFodi : ""}`.trim()}>
        {fodiChrome ? (
          <div className={styles.fodiPlayCol}>
            <span className={styles.fodiTime} aria-live="polite">
              {fmt(currentTime)}
            </span>
            <button
              type="button"
              className={`${ctrlStyles.btn} ${ctrlStyles.btnPrimary} ${styles.fodiPlayBtn}`}
              onClick={onPlayPause}
              disabled={!audioUrl}
              aria-label={isPlaying ? "一時停止" : "再生"}
            >
              {isPlaying ? (
                <TransportIconPause size={22} className={ctrlStyles.iconPrimary} />
              ) : (
                <TransportIconPlay size={22} className={ctrlStyles.iconPrimary} />
              )}
            </button>
            <button
              type="button"
              className={`${ctrlStyles.btn} ${styles.fodiStopBtn}`}
              onClick={handleStop}
              disabled={!audioUrl}
              aria-label="停止して先頭へ"
              title="停止して先頭へ"
            >
              <TransportIconStop size={16} className={ctrlStyles.icon} />
            </button>
          </div>
        ) : null}
        <div
          ref={waveTimelineBodyRef}
          className={`${styles.waveTimelineBody} ${fodiChrome ? styles.waveTimelineBodyFodi : ""}`.trim()}
          onPointerMove={onTimelinePlayheadPointerMove}
          onPointerUp={endPlayheadDrag}
          onPointerCancel={endPlayheadDrag}
        >
        <div className={styles.waveRulerWrap}>
          {onCollapseWave && !hideRulerCollapseButton ? (
            <button
              type="button"
              className={styles.rulerCollapseBtn}
              onPointerDown={(e) => {
                e.stopPropagation();
                abortTimelineWavePointerGestures();
              }}
              onClick={(e) => {
                e.stopPropagation();
                abortTimelineWavePointerGestures();
                onCollapseWave();
              }}
              aria-label="波形を畳む"
              title="波形を畳む"
            >
              <span className={styles.rulerCollapseTriangle} aria-hidden />
            </button>
          ) : null}
          <div
            className={`${styles.waveRuler} ${fodiChrome ? styles.waveRulerFodi : ""}`.trim()}
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={onRulerPointerUp}
            onPointerCancel={onRulerPointerUp}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-label="タイムライン（タップ・ドラッグで波形をスライド）"
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
            role="img"
            aria-label="波形（ダブルタップでキュー追加・ドラッグでキュー調整・長押しでメニュー。スクロールは上の秒数目盛り）"
          />
          {showWaveLoadOverlay ? (
            <WaveformLoadOverlay visible compact className={styles.wavePlaceholder} />
          ) : null}
        </div>
        {duration > 0 && waveDrawView.span > 0 ? (
          <div
            ref={playheadLineRef}
            className={`${styles.playheadLine} ${fodiChrome ? styles.playheadLineFodi : ""}`.trim()}
            style={{ left: "0%" }}
            role="presentation"
            aria-hidden={fodiChrome ? true : undefined}
            aria-valuemin={fodiChrome ? undefined : 0}
            aria-valuemax={fodiChrome ? undefined : duration}
            aria-valuenow={fodiChrome ? undefined : playheadSecForUi}
            aria-label={
              fodiChrome
                ? undefined
                : "再生位置（ドラッグで移動・再生中も操作できます）"
            }
            onPointerDown={onPlayheadPointerDown}
          />
        ) : null}
        </div>
      </div>
    </div>
  );
});
