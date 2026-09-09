/**
 * Greedy 1:1 matching of hypothesis times to reference times within tolerance.
 * Deterministic: sort both, then left-to-right greedy on sorted refs.
 */

export type MatchPair = {
  refIndex: number;
  hypIndex: number;
  error: number;
};

export function matchTimesGreedy(
  ref: number[],
  hyp: number[],
  toleranceSec: number
): MatchPair[] {
  const refOrder = ref
    .map((t, i) => ({ t, i }))
    .sort((a, b) => a.t - b.t || a.i - b.i);
  const hypUsed = new Set<number>();
  const pairs: MatchPair[] = [];

  for (const r of refOrder) {
    let bestJ = -1;
    let bestErr = Infinity;
    for (let j = 0; j < hyp.length; j++) {
      if (hypUsed.has(j)) continue;
      const err = Math.abs(hyp[j]! - r.t);
      if (err <= toleranceSec && err < bestErr) {
        bestErr = err;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      hypUsed.add(bestJ);
      pairs.push({ refIndex: r.i, hypIndex: bestJ, error: bestErr });
    }
  }
  return pairs;
}

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function f1(precision: number, recall: number): number {
  if (precision + recall <= 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
