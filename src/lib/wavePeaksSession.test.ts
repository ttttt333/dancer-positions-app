import { describe, expect, it } from "vitest";
import {
  resolveWavePeakBinCount,
  WAVE_PEAK_BIN_COUNT,
  isWavePeaksResolutionStale,
} from "./computeWavePeaksFromChannelData";
import { QUICK_WAVEFORM_POINTS } from "./generateWaveformPeaks";
import { createPlaceholderWavePeaks } from "./placeholderWavePeaks";
import {
  peaksMeetSupabasePersistQuality,
  shouldReplaceWavePeaks,
} from "./wavePeaksSession";

function quickPeaks(): number[] {
  return Array.from({ length: QUICK_WAVEFORM_POINTS }, () => 0.5);
}

function fullResPeaks(durationSec: number): number[] {
  return Array.from({ length: resolveWavePeakBinCount(durationSec) }, () => 0.5);
}

describe("shouldReplaceWavePeaks", () => {
  it("accepts first real peaks when store is empty", () => {
    const incoming = { peaks: fullResPeaks(60), durationSec: 60 };
    expect(shouldReplaceWavePeaks(incoming, null)).toBe(true);
  });

  it("rejects placeholder incoming over real current", () => {
    const current = fullResPeaks(60);
    const incoming = {
      peaks: createPlaceholderWavePeaks(60),
      durationSec: 60,
    };
    expect(shouldReplaceWavePeaks(incoming, current, 60)).toBe(false);
  });

  it("replaces placeholder current with real incoming", () => {
    const current = createPlaceholderWavePeaks(60);
    const incoming = { peaks: fullResPeaks(60), durationSec: 60 };
    expect(shouldReplaceWavePeaks(incoming, current, 60)).toBe(true);
  });

  it("uses payload duration for both sides (not playback UI)", () => {
    const current = fullResPeaks(60);
    const incoming = { peaks: fullResPeaks(180), durationSec: 180 };
    expect(shouldReplaceWavePeaks(incoming, current, 60)).toBe(true);
    expect(shouldReplaceWavePeaks(incoming, current, 999)).toBe(true);
  });

  it("keeps fresh current when incoming is same resolution", () => {
    const durationSec = 60;
    const peaks = fullResPeaks(durationSec);
    const incoming = { peaks: [...peaks], durationSec };
    expect(shouldReplaceWavePeaks(incoming, peaks, durationSec)).toBe(false);
  });

  it("upgrades when incoming has higher resolution only", () => {
    const durationSec = 60;
    const current = Array.from({ length: WAVE_PEAK_BIN_COUNT }, () => 0.5);
    const incoming = {
      peaks: fullResPeaks(durationSec),
      durationSec,
    };
    expect(current.length).toBeLessThan(incoming.peaks.length);
    expect(shouldReplaceWavePeaks(incoming, current, durationSec)).toBe(true);
  });
});

describe("peaksMeetSupabasePersistQuality", () => {
  it("rejects fixed-bin quick waveform when track needs more bins", () => {
    const quick = quickPeaks();
    expect(QUICK_WAVEFORM_POINTS).toBe(WAVE_PEAK_BIN_COUNT);
    expect(isWavePeaksResolutionStale(quick, 25)).toBe(false);
    expect(peaksMeetSupabasePersistQuality(quick, 25)).toBe(false);
  });

  it("allows quick waveform for short tracks where target equals quick bin count", () => {
    const quick = quickPeaks();
    const dur = 20;
    expect(resolveWavePeakBinCount(dur)).toBe(WAVE_PEAK_BIN_COUNT);
    expect(peaksMeetSupabasePersistQuality(quick, dur)).toBe(true);
  });
});
