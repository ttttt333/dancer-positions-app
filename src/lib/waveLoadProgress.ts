import { setWaveformLoadProgress } from "../store/waveformLoadProgressStore";

/** デコード待ち中にゆっくり進める擬似プログレス（decodeAudioData は進捗 API が無い） */
export function runIndeterminateDecodeProgress(
  startRatio: number,
  endRatio: number,
  message: string
): () => void {
  setWaveformLoadProgress({ ratio: startRatio, message });
  const span = Math.max(endRatio - startRatio, 0.05);
  const started = Date.now();
  const id = window.setInterval(() => {
    const t = Math.min(1, (Date.now() - started) / 12000);
    const eased = 1 - (1 - t) ** 2;
    setWaveformLoadProgress({
      ratio: startRatio + span * eased * 0.92,
      message,
    });
  }, 120);
  return () => window.clearInterval(id);
}

export function reportWaveLoadProgress(ratio: number, message?: string): void {
  setWaveformLoadProgress({
    ratio: Math.max(0, Math.min(1, ratio)),
    message,
  });
}

export function clearWaveLoadProgress(): void {
  setWaveformLoadProgress(null);
}
