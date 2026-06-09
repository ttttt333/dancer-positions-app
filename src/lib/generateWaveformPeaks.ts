/**
 * CHOREO CORE 音声エンジン準拠: クライアント側の軽量波形生成。
 * アップロード前・リモート取得待ち中に即表示するプレビュー波形用。
 */

import {
  resolveWavePeakBinCount,
  WAVE_PEAK_BIN_COUNT,
} from "./computeWavePeaksFromChannelData";

export const QUICK_WAVEFORM_POINTS = WAVE_PEAK_BIN_COUNT;
export const MAX_AUDIO_FILE_MB = 100;

const ACCEPTED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

export type WaveformPeaksResult = {
  peaks: number[];
  durationSec: number;
};

export function validateAudioFile(file: File): void {
  const mime = file.type?.trim() ?? "";
  if (mime && !ACCEPTED_MIME_TYPES.has(mime)) {
    throw new Error(
      `非対応の形式です。MP3・WAV・AAC・OGG・FLAC をお使いください。（検出: ${mime}）`
    );
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_AUDIO_FILE_MB) {
    throw new Error(
      `ファイルサイズが大きすぎます。${MAX_AUDIO_FILE_MB}MB 以下にしてください。（現在: ${sizeMB.toFixed(1)}MB）`
    );
  }
}

export async function generateWaveformPeaksFromFile(
  file: File,
  numPoints = QUICK_WAVEFORM_POINTS
): Promise<WaveformPeaksResult> {
  const arrayBuffer = await file.arrayBuffer();
  return generateWaveformPeaksFromArrayBuffer(arrayBuffer, numPoints);
}

export async function generateWaveformPeaksFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  numPointsOverride?: number
): Promise<WaveformPeaksResult> {
  const fallbackPoints = numPointsOverride ?? QUICK_WAVEFORM_POINTS;
  if (!arrayBuffer.byteLength) {
    return {
      peaks: Array(fallbackPoints).fill(0.12),
      durationSec: 0,
    };
  }

  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextClass) {
    console.warn("[generateWaveformPeaks] Web Audio API 非対応: プレースホルダー波形を使用");
    return {
      peaks: Array(fallbackPoints).fill(0.12),
      durationSec: 0,
    };
  }

  const ctx = new AudioContextClass({ sampleRate: 22050 });
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close();
  }

  const channelData = audioBuffer.getChannelData(0);
  const durationSec = Number.isFinite(audioBuffer.duration) ? audioBuffer.duration : 0;
  const numPoints =
    numPointsOverride ?? resolveWavePeakBinCount(durationSec || undefined);
  const blockSize = Math.max(1, Math.floor(channelData.length / numPoints));
  const peaks: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(channelData[start + j] ?? 0);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  let peakMax = 1e-6;
  for (const p of peaks) {
    if (p > peakMax) peakMax = p;
  }
  for (let i = 0; i < peaks.length; i++) {
    peaks[i] = Math.round((peaks[i]! / peakMax) * 1000) / 1000;
  }

  return {
    peaks,
    durationSec: Number.isFinite(audioBuffer.duration) ? audioBuffer.duration : 0,
  };
}
