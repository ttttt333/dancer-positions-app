import { DEFAULT_BEATS_PER_BAR } from "../constants";

/**
 * WHY: bar numbering is a meter convention, not something audio analysis can
 * prove. Keep it swappable for 3/4 later without touching tempo estimation.
 */
export function beatInBarFromIndex(
  index: number,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR
): number {
  const n = Math.max(1, Math.floor(beatsPerBar));
  return ((index % n) + n) % n;
}

export function barIndexFromBeatIndex(
  index: number,
  beatsPerBar: number = DEFAULT_BEATS_PER_BAR
): number {
  const n = Math.max(1, Math.floor(beatsPerBar));
  return Math.floor(index / n);
}
