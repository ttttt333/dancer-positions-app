export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

export function movingAverage(values: Float64Array, window: number): Float64Array {
  const n = values.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const w = Math.max(1, Math.min(window, n));
  if (w === 1) {
    out.set(values);
    return out;
  }
  const half = Math.floor(w / 2);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    let count = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    for (let j = lo; j <= hi; j += 1) {
      sum += values[j]!;
      count += 1;
    }
    out[i] = sum / count;
  }
  return out;
}

/** Linear interpolation percentile. `sorted` must be ascending. */
export function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const t = Math.max(0, Math.min(1, p));
  const idx = (sorted.length - 1) * t;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (idx - lo);
}

/**
 * Map values to 0–1 using 10th–90th percentile.
 * WHY: a single clip/crash must not squash the rest of the track to ~0.
 */
export function percentileNormalize01(values: Float64Array): Float64Array {
  const n = values.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const lo = percentileSorted(sorted, 0.1);
  const hi = percentileSorted(sorted, 0.9);
  const span = hi - lo;
  if (span <= 1e-12) {
    out.fill(0.5);
    return out;
  }
  for (let i = 0; i < n; i += 1) {
    out[i] = clamp01((values[i]! - lo) / span);
  }
  return out;
}
