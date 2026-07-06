import { describe, expect, it } from "vitest";
import type { WaveSeekSnapLatch } from "./waveSeekSnapLatch";
import {
  advanceWaveSeekSnapLatch,
  beginWaveSeekSnapLatch,
  resolveWaveSeekSnapPaint,
  WAVE_SEEK_SNAP_ENGINE_EPS_SEC,
} from "./waveSeekSnapLatch";

describe("waveSeekSnapLatch", () => {
  it("pins paint sec and view while engine has not caught up", () => {
    const latchRef: { current: WaveSeekSnapLatch | null } = { current: null };
    beginWaveSeekSnapLatch(latchRef, {
      targetSec: 42,
      viewStartOverride: 30,
      isPlaying: true,
    });
    const snap = resolveWaveSeekSnapPaint({
      latch: latchRef.current,
      engineSec: 10,
      fallbackSec: 10,
      nowMs: 1000,
    });
    expect(snap.pinned).toBe(true);
    expect(snap.paintSec).toBe(42);
    expect(snap.viewStartOverride).toBe(30);
  });

  it("releases when engine syncs within epsilon", () => {
    const latchRef: { current: WaveSeekSnapLatch | null } = { current: null };
    beginWaveSeekSnapLatch(latchRef, {
      targetSec: 42,
      viewStartOverride: 30,
      isPlaying: true,
    });
    const snap = resolveWaveSeekSnapPaint({
      latch: latchRef.current,
      engineSec: 42 + WAVE_SEEK_SNAP_ENGINE_EPS_SEC * 0.5,
      fallbackSec: 10,
      nowMs: 1100,
    });
    expect(snap.pinned).toBe(false);
    advanceWaveSeekSnapLatch(latchRef, 42);
    expect(latchRef.current).toBeNull();
  });

  it("does not latch when paused", () => {
    const latchRef: { current: WaveSeekSnapLatch | null } = {
      current: { targetSec: 1, viewStartOverride: 0, startedAtMs: 0 },
    };
    beginWaveSeekSnapLatch(latchRef, {
      targetSec: 50,
      viewStartOverride: 40,
      isPlaying: false,
    });
    expect(latchRef.current).toBeNull();
  });
});
