import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
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
};

/**
 * 生徒閲覧: ステージを長押ししている間だけ 2 倍速再生。
 * 離すと元の速度に戻す（再生自体は止めない）。
 */
export function useViewerHoldToDoubleSpeed({
  enabled,
  project,
  playbackRate,
  onPlaybackRateChange,
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
      const t = e.target;
      if (t instanceof Element && t.closest(INTERACTIVE_SELECTOR)) return;

      pointerIdRef.current = e.pointerId;
      originRef.current = { x: e.clientX, y: e.clientY };
      restoreRateRef.current = normalizePracticePlaybackRate(
        playbackRateRef.current ?? 1
      );
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (pointerIdRef.current !== e.pointerId) return;
        beginBoost();
      }, VIEWER_HOLD_2X_MS);
    },
    [beginBoost, clearTimer, enabled, endBoost]
  );

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
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (pointerIdRef.current == null || ev.pointerId !== pointerIdRef.current) {
        return;
      }
      endBoost();
    };

    const onBlur = () => endBoost();
    const onContextMenu = (ev: Event) => {
      if (boostingRef.current || timerRef.current != null) {
        ev.preventDefault();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("contextmenu", onContextMenu, true);
      endBoost();
    };
  }, [clearTimer, enabled, endBoost]);

  return { boosting, onPointerDown };
}
