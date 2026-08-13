export function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

export function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + finite(v), 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function mae(predicted: number[], actual: number[]): number {
  const n = Math.min(predicted.length, actual.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i += 1) s += Math.abs(predicted[i]! - actual[i]!);
  return s / n;
}

export function rmse(predicted: number[], actual: number[]): number {
  const n = Math.min(predicted.length, actual.length);
  if (n === 0) return 0;
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const d = predicted[i]! - actual[i]!;
    s += d * d;
  }
  return Math.sqrt(s / n);
}

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return n === 1 && x[0] === y[0] ? 1 : 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = x[i]! - mx;
    const b = y[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 && dy === 0) return 1;
  if (dx === 0 || dy === 0) return 0;
  return clamp(num / Math.sqrt(dx * dy), -1, 1);
}

export function rankValues(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v || a.i - b.i);
  const ranks = Array<number>(values.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.v === indexed[i]!.v) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[indexed[k]!.i] = avg;
    i = j + 1;
  }
  return ranks;
}

export function spearman(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return n === 1 ? 1 : 0;
  return pearson(rankValues(x.slice(0, n)), rankValues(y.slice(0, n)));
}

export function f1Score(precision: number, recall: number): number {
  if (precision + recall <= 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function cohenKappa(agreements: number, n: number, pe: number): number {
  if (n <= 0) return 1;
  const po = agreements / n;
  const denom = 1 - pe;
  if (Math.abs(denom) < 1e-9) return po === 1 ? 1 : 0;
  return clamp((po - pe) / denom, -1, 1);
}

export function correlationToScore(r: number): number {
  return clamp((finite(r) + 1) * 50, 0, 100);
}
