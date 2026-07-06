/** 再生中クリックシーク直後、エンジン時刻が追いつくまで描画用ヘッドを固定する */
export type WaveSeekSnapLatch = {
  targetSec: number;
  viewStartOverride: number | null;
  startedAtMs: number;
};

export const WAVE_SEEK_SNAP_ENGINE_EPS_SEC = 0.1;
export const WAVE_SEEK_SNAP_MAX_MS = 500;

export function beginWaveSeekSnapLatch(
  latchRef: { current: WaveSeekSnapLatch | null },
  params: {
    targetSec: number;
    viewStartOverride: number | null;
    isPlaying: boolean;
  }
): void {
  if (!params.isPlaying || !Number.isFinite(params.targetSec)) {
    latchRef.current = null;
    return;
  }
  latchRef.current = {
    targetSec: params.targetSec,
    viewStartOverride: params.viewStartOverride,
    startedAtMs: performance.now(),
  };
}

export function clearWaveSeekSnapLatch(latchRef: {
  current: WaveSeekSnapLatch | null;
}): void {
  latchRef.current = null;
}

export function resolveWaveSeekSnapPaint(params: {
  latch: WaveSeekSnapLatch | null;
  engineSec: number | null;
  fallbackSec: number;
  nowMs?: number;
}): {
  paintSec: number;
  pinned: boolean;
  viewStartOverride: number | null;
} {
  const latch = params.latch;
  if (!latch) {
    return {
      paintSec: params.fallbackSec,
      pinned: false,
      viewStartOverride: null,
    };
  }

  const now = params.nowMs ?? performance.now();
  const engineSec = params.engineSec;
  const engineSynced =
    engineSec != null &&
    Number.isFinite(engineSec) &&
    Math.abs(engineSec - latch.targetSec) <= WAVE_SEEK_SNAP_ENGINE_EPS_SEC;
  const expired = now - latch.startedAtMs > WAVE_SEEK_SNAP_MAX_MS;

  if (engineSynced || expired) {
    return {
      paintSec:
        engineSynced && engineSec != null ? engineSec : latch.targetSec,
      pinned: false,
      viewStartOverride: null,
    };
  }

  return {
    paintSec: latch.targetSec,
    pinned: true,
    viewStartOverride: latch.viewStartOverride,
  };
}

export function advanceWaveSeekSnapLatch(
  latchRef: { current: WaveSeekSnapLatch | null },
  engineSec: number | null,
  nowMs?: number
): void {
  const { pinned } = resolveWaveSeekSnapPaint({
    latch: latchRef.current,
    engineSec,
    fallbackSec: latchRef.current?.targetSec ?? 0,
    nowMs,
  });
  if (!pinned) latchRef.current = null;
}
