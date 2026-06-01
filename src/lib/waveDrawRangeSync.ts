/** キャンバス描画直後の可視時間窓（目盛り等を描画と同期する） */

export type WaveDrawRange = { start: number; end: number; span: number };

let snapshot: WaveDrawRange = { start: 0, end: 1, span: 1 };
const listeners = new Set<() => void>();

export function publishWaveDrawRange(start: number, span: number): void {
  if (!Number.isFinite(start) || !Number.isFinite(span) || span <= 0) return;
  const end = start + span;
  if (snapshot.start === start && snapshot.span === span) return;
  snapshot = { start, end, span };
  listeners.forEach((l) => l());
}

export function subscribeWaveDrawRange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWaveDrawRangeSnapshot(): WaveDrawRange {
  return snapshot;
}
