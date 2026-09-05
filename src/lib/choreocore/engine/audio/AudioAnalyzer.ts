import {
  ANALYSIS_VERSION,
  resolveAnalysisConfig,
} from "../constants";
import type { AudioAnalysisConfig } from "../types/AnalysisTypes";
import type {
  AudioFeatureFrame,
  EngineAudioBuffer,
  MusicAnalysisResultPhase1,
} from "../types";
import { AudioAnalysisError } from "../types/AudioError";
import { calculateEnergyCurve } from "./EnergyAnalyzer";
import { detectBeats, estimateTempo } from "./BeatDetector";
import { calculateOnsetStrength, detectOnsets } from "./OnsetDetector";
import { analyzeFrequencyBands } from "./FrequencyBandAnalyzer";
import { calculateRms } from "./rms";
import { isPowerOfTwo, movingAverage } from "./signalMath";
import {
  calculateSpectralCentroid,
  calculateSpectralFlux,
  createFftScratch,
  computeMagnitudeSpectrumInto,
} from "./SpectralAnalyzer";

function mixToMono(buffer: EngineAudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  if (channels <= 1) return buffer.getChannelData(0);
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < channels; c += 1) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < len; i += 1) {
      out[i] += (ch[i] ?? 0) / channels;
    }
  }
  return out;
}

function copyFrameInto(
  source: Float32Array,
  start: number,
  dest: Float32Array
): void {
  dest.fill(0);
  const copyCount = Math.min(dest.length, Math.max(0, source.length - start));
  if (copyCount > 0) {
    dest.set(source.subarray(start, start + copyCount));
  }
}

function assertAnalyzable(
  audioBuffer: EngineAudioBuffer,
  config: AudioAnalysisConfig
): void {
  if (!audioBuffer || audioBuffer.length <= 0) {
    throw new AudioAnalysisError("EMPTY_BUFFER", "Audio buffer has 0 samples");
  }
  if (!Number.isFinite(audioBuffer.sampleRate) || audioBuffer.sampleRate <= 0) {
    throw new AudioAnalysisError(
      "INVALID_SAMPLE_RATE",
      `sampleRate must be a positive number, got ${String(audioBuffer.sampleRate)}`
    );
  }
  if (audioBuffer.numberOfChannels <= 0) {
    throw new AudioAnalysisError(
      "INVALID_CHANNELS",
      `numberOfChannels must be >= 1, got ${audioBuffer.numberOfChannels}`
    );
  }
  if (audioBuffer.duration <= 0 && audioBuffer.length <= 0) {
    throw new AudioAnalysisError("ZERO_DURATION", "Audio duration is 0");
  }
  if (!isPowerOfTwo(config.frameSize)) {
    throw new AudioAnalysisError(
      "FFT_INVALID",
      `frameSize must be a power of two, got ${config.frameSize}`
    );
  }
  if (config.hopSize < 1) {
    throw new AudioAnalysisError(
      "FRAME_TOO_SHORT",
      `hopSize must be >= 1, got ${config.hopSize}`
    );
  }
}

/**
 * Hop-level feature extraction (no tempo / hits).
 * WHY: later detectors share one deterministic frame grid.
 */
export function extractAudioFeatureFrames(
  audioBuffer: EngineAudioBuffer,
  config?: Partial<AudioAnalysisConfig>
): AudioFeatureFrame[] {
  const cfg = resolveAnalysisConfig(config);
  assertAnalyzable(audioBuffer, cfg);

  const sampleRate = audioBuffer.sampleRate;
  const mono = mixToMono(audioBuffer);
  const scratch = createFftScratch(cfg.frameSize);
  const frame = new Float32Array(cfg.frameSize);
  const prevMag = new Float64Array(scratch.mag.length);
  const frames: AudioFeatureFrame[] = [];
  const onsetRaw: number[] = [];

  let hasPrev = false;
  let prevFlux = 0;
  let fluxEma = 0;

  for (let start = 0; start < mono.length; start += cfg.hopSize) {
    copyFrameInto(mono, start, frame);
    const rms = calculateRms(frame);
    const mag = computeMagnitudeSpectrumInto(frame, scratch);
    const flux = hasPrev ? calculateSpectralFlux(mag, prevMag) : 0;
    const bands = analyzeFrequencyBands(mag, sampleRate);
    const localAvg = fluxEma > 1e-12 ? fluxEma : flux;
    const onset = calculateOnsetStrength(flux, prevFlux, localAvg);

    frames.push({
      time: start / sampleRate,
      rms,
      spectralFlux: flux,
      spectralCentroid: calculateSpectralCentroid(mag, sampleRate),
      bassEnergy: bands.bassEnergy,
      lowMidEnergy: bands.lowMidEnergy,
      midEnergy: bands.midEnergy,
      highMidEnergy: bands.highMidEnergy,
      highEnergy: bands.highEnergy,
      onsetStrength: onset,
    });
    onsetRaw.push(onset);
    prevMag.set(mag);
    hasPrev = true;
    prevFlux = flux;
    fluxEma = hasPrev && fluxEma === 0 ? flux : 0.8 * fluxEma + 0.2 * flux;
  }

  if (frames.length === 0) {
    throw new AudioAnalysisError(
      "FRAME_TOO_SHORT",
      `Could not build analysis frames (length=${audioBuffer.length}, hopSize=${cfg.hopSize})`
    );
  }

  const window = Math.max(1, cfg.smoothingWindow);
  const smoothed = movingAverage(Float64Array.from(onsetRaw), window);
  for (let i = 0; i < frames.length; i += 1) {
    frames[i]!.onsetStrength = smoothed[i]!;
  }
  return frames;
}

/**
 * Full Phase 1 pipeline: frames → energy → tempo → beats → hits.
 */
export async function analyzeAudio(
  audioBuffer: EngineAudioBuffer,
  config?: Partial<AudioAnalysisConfig>
): Promise<MusicAnalysisResultPhase1> {
  const cfg = resolveAnalysisConfig(config);
  const frames = extractAudioFeatureFrames(audioBuffer, cfg);
  const sampleRate = audioBuffer.sampleRate;
  const duration =
    audioBuffer.duration > 0
      ? audioBuffer.duration
      : audioBuffer.length / sampleRate;
  const hopSec = cfg.hopSize / sampleRate;
  const envelope = frames.map((f) => f.onsetStrength);
  const tempo = estimateTempo(envelope, sampleRate, cfg.hopSize, {
    minBpm: cfg.minBpm,
    maxBpm: cfg.maxBpm,
  });
  const energyCurve = calculateEnergyCurve(frames, cfg);
  const beats = detectBeats(envelope, tempo, duration, hopSec);
  const hits = detectOnsets(frames, {
    minimumHitInterval: cfg.minimumHitInterval,
  });
  const frameConf = frames.length >= 8 ? 1 : frames.length / 8;
  const confidence = Math.max(
    0,
    Math.min(1, 0.65 * tempo.confidence + 0.35 * frameConf)
  );

  return {
    duration,
    sampleRate,
    tempo,
    frames,
    energyCurve,
    beats,
    hits,
    analysisVersion: ANALYSIS_VERSION,
    confidence,
    provenance: "real",
  };
}

export { calculateRms };
