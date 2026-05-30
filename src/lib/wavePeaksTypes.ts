import { WAVE_PEAK_BIN_COUNT } from "./computeWavePeaksFromChannelData";

export type WavePeaksPayload = {
  v: 1;
  binCount: number;
  peaks: number[];
  durationSec: number;
};

export function normalizeWavePeaksPayload(raw: unknown): WavePeaksPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const peaks = o.peaks;
  if (!Array.isArray(peaks) || peaks.length === 0) return null;
  const nums = peaks.filter((n) => typeof n === "number" && Number.isFinite(n)) as number[];
  if (nums.length === 0) return null;
  const durationSec =
    typeof o.durationSec === "number" && Number.isFinite(o.durationSec) && o.durationSec > 0
      ? o.durationSec
      : 0;
  const binCount =
    typeof o.binCount === "number" && Number.isFinite(o.binCount)
      ? o.binCount
      : nums.length;
  return {
    v: 1,
    binCount,
    peaks: nums,
    durationSec,
  };
}

export function createWavePeaksPayload(
  peaks: number[],
  durationSec: number
): WavePeaksPayload {
  return {
    v: 1,
    binCount: peaks.length,
    peaks,
    durationSec,
  };
}
