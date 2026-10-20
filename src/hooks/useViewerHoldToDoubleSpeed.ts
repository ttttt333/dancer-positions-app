import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { ChoreographyProjectJson } from "../types/choreography";
import { playbackEngine } from "../core/playbackEngine";
import { normalizePracticePlaybackRate } from "../store/practicePlaybackStore";
import { usePlaybackUiStore } from "../store/usePlaybackUiStore";
import {
  toggleViewerPlayback,
  tryStartViewerPlaybackFromUserGesture,
} from "../lib/viewerPlayback";
import { WAVE_LONG_PRESS_CANCEL_PX } from "../lib/waveLongPress";

/** 閲覧ステージ長押しで 2 倍速に入るまでの待ち（YouTube 風） */
const VIEWER_HOLD_2X_MS = 420;

const INTERACTIVE_SELECTOR =
  "button, a[href], input, textarea, select, option, [role='button'], [role='dialog'], [role='menu'], [data-viewer-hold-2x-ignore]";

type Args = {
  enabled: boolean;
  project: ChoreographyProjectJson | null | undefined;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  /** 長押し対象のステージシェル（ネイティブ選択・コールアウト抑止用） */
  shellRef?: RefObject<HTMLElement | null>;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function clearDomSelection(): void {
  try {
    window.getSelection()?.removeAllRanges();
  } catch {
    /* ignore */
  }
}

/**
 * 生徒閲覧: ステージを長押ししている間だけ 2 倍速再生。
 * 離すと元の速度に戻す（再生自体は止めない）。
 */
export function useViewerHoldToDoubleSpeed({
  enabled,
  project,
  playbackRate,
  onPlaybackRateChange,
  shellRef,
}: Args) {
  const [boosting, setBoosting] = useState(false);

  const projectRef = useRef(project);
  const playbackRateRef = useRef(playbackRate);
  const onRateChangeRef = useRef(onPlaybackRateChange);
  const boostingRef = useRef(false);
  const restoreRateRef = useRef(1);
  const timerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  /** 長押し追跡中（タイマー待ち or 2x 中）— ネイティブ UI を抑止 */
  const suppressNativeUiRef = useRef(false);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);
  useEffect(() => {
    onRateChangeRef.current = onPlaybackRateChange;
  }, [onPlaybackRateChange]);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const endBoost = useCallback(() => {
    clearTimer();
    pointerIdRef.current = null;
    suppressNativeUiRef.current = false;
    if (!boostingRef.current) return;
    boostingRef.current = false;
    setBoosting(false);
    const restore = restoreRateRef.current;
    playbackEngine.setPlaybackRate(restore);
    onRateChangeRef.current(restore);
  }, [clearTimer]);

  const beginBoost = useCallback(() => {
    const p = projectRef.current;
    if (!p || boostingRef.current) return;
    const base = restoreRateRef.current;
    boostingRef.current = true;
    setBoosting(true);
    clearDomSelection();
    playbackEngine.setPlaybackRate(2);
    if (base !== 2) {
      onRateChangeRef.current(2);
    }
    const trimStart = p.trimStartSec ?? 0;
    if (!usePlaybackUiStore.getState().isPlaying) {
      if (!tryStartViewerPlaybackFromUserGesture(p, trimStart)) {
        toggleViewerPlayback(p, trimStart);
      }
    }
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      if (pointerIdRef.current != null) {
        // 2 本目（ピンチ等）→ 長押しキャンセル
        endBoost();
        return;
      }
      if (isInteractiveTarget(e.target)) return;

      // iOS/Android のテキスト選択・コールアウトを抑止
      e.preventDefault();
      clearDomSelection();

      pointerIdRef.current = e.pointerId;
      originRef.current = { x: e.clientX, y: e.clientY };
      restoreRateRef.current = normalizePracticePlaybackRate(
        playbackRateRef.current ?? 1
      );
      suppressNativeUiRef.current = true;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (pointerIdRef.current !== e.pointerId) return;
        beginBoost();
      }, VIEWER_HOLD_2X_MS);
    },
    [beginBoost, clearTimer, enabled, endBoost]
  );

  const onContextMenu = useCallback((e: ReactMouseEvent | MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ステージ上の touch / 選択 / コンテキストメニューをネイティブ側で抑止
  useEffect(() => {
    if (!enabled) return;
    const el = shellRef?.current;
    if (!el) return;

    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) {
        endBoost();
        return;
      }
      if (isInteractiveTarget(ev.target)) return;
      // passive: false 必須（iOS の長押しコールアウト抑止）
      ev.preventDefault();
      clearDomSelection();
    };

    const onSelectStart = (ev: Event) => {
      if (isInteractiveTarget(ev.target)) return;
      ev.preventDefault();
    };

    const onContextMenuCapture = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("selectstart", onSelectStart, true);
    el.addEventListener("contextmenu", onContextMenuCapture, true);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("selectstart", onSelectStart, true);
      el.removeEventListener("contextmenu", onContextMenuCapture, true);
    };
  }, [enabled, endBoost, shellRef]);

  useEffect(() => {
    if (!enabled) {
      endBoost();
      return;
    }

    const onMove = (ev: PointerEvent) => {
      if (pointerIdRef.current == null || ev.pointerId !== pointerIdRef.current) {
        return;
      }
      if (boostingRef.current) return;
      const dist = Math.hypot(
        ev.clientX - originRef.current.x,
        ev.clientY - originRef.current.y
      );
      if (dist > WAVE_LONG_PRESS_CANCEL_PX) {
        clearTimer();
        pointerIdRef.current = null;
        suppressNativeUiRef.current = false;
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (pointerIdRef.current == null || ev.pointerId !== pointerIdRef.current) {
        return;
      }
      endBoost();
    };

    const onBlur = () => endBoost();
    const onContextMenuWindow = (ev: Event) => {
      if (suppressNativeUiRef.current || boostingRef.current) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    const onSelectionChange = () => {
      if (suppressNativeUiRef.current || boostingRef.current) {
        clearDomSelection();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("contextmenu", onContextMenuWindow, true);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("contextmenu", onContextMenuWindow, true);
      document.removeEventListener("selectionchange", onSelectionChange);
      endBoost();
    };
  }, [clearTimer, enabled, endBoost]);

  return { boosting, onPointerDown, onContextMenu };
}
