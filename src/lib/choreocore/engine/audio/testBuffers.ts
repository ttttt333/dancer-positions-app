import type { AudioFeatureFrame, EngineAudioBuffer } from "../types";

export function createEngineBuffer(
  samples: Float32Array,
  sampleRate = 22050
): EngineAudioBuffer {
  return {
    sampleRate,
    length: samples.length,
    numberOfChannels: 1,
    duration: samples.length / sampleRate,
    getChannelData: () => samples,
  };
}

export function makeSineBuffer(options: {
  frequency: number;
  durationSec: number;
  sampleRate?: number;
  amplitude?: number;
}): EngineAudioBuffer {
  const sampleRate = options.sampleRate ?? 22050;
  const amplitude = options.amplitude ?? 0.5;
  const length = Math.floor(sampleRate * options.durationSec);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] =
      amplitude * Math.sin((2 * Math.PI * options.frequency * i) / sampleRate);
  }
  return createEngineBuffer(samples, sampleRate);
}

export function makeAmplitudeRampSine(options: {
  frequency: number;
  durationSec: number;
  startAmp: number;
  endAmp: number;
  sampleRate?: number;
}): EngineAudioBuffer {
  const sampleRate = options.sampleRate ?? 22050;
  const length = Math.floor(sampleRate * options.durationSec);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / Math.max(1, length - 1);
    const amp = options.startAmp + (options.endAmp - options.startAmp) * t;
    samples[i] =
      amp * Math.sin((2 * Math.PI * options.frequency * i) / sampleRate);
  }
  return createEngineBuffer(samples, sampleRate);
}

export function makeClickTrack(options: {
  bpm: number;
  durationSec: number;
  sampleRate?: number;
}): EngineAudioBuffer {
  const sampleRate = options.sampleRate ?? 22050;
  const length = Math.floor(sampleRate * options.durationSec);
  const samples = new Float32Array(length);
  const periodSec = 60 / options.bpm;
  const clickLen = Math.max(16, Math.floor(sampleRate * 0.04));
  for (let beatT = 0; beatT < options.durationSec; beatT += periodSec) {
    const start = Math.floor(beatT * sampleRate);
    for (let i = 0; i < clickLen && start + i < length; i += 1) {
      const env = 1 - i / clickLen;
      samples[start + i] =
        env * Math.sin((2 * Math.PI * 80 * i) / sampleRate);
    }
  }
  return createEngineBuffer(samples, sampleRate);
}

export function makeQuietThenHit(options: {
  durationSec: number;
  hitTimeSec: number;
  sampleRate?: number;
}): EngineAudioBuffer {
  const sampleRate = options.sampleRate ?? 22050;
  const length = Math.floor(sampleRate * options.durationSec);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] = 0.02 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  }
  const hitStart = Math.floor(options.hitTimeSec * sampleRate);
  const clickLen = Math.floor(sampleRate * 0.03);
  for (let i = 0; i < clickLen && hitStart + i < length; i += 1) {
    const env = 1 - i / clickLen;
    samples[hitStart + i] =
      env * Math.sin((2 * Math.PI * 90 * i) / sampleRate);
  }
  return createEngineBuffer(samples, sampleRate);
}

export function generateSineWave(options: {
  frequency: number;
  duration: number;
  sampleRate?: number;
  amplitude?: number;
}): EngineAudioBuffer {
  return makeSineBuffer({
    frequency: options.frequency,
    durationSec: options.duration,
    sampleRate: options.sampleRate,
    amplitude: options.amplitude,
  });
}

export function generateClickTrack(options: {
  bpm: number;
  duration: number;
  sampleRate?: number;
}): EngineAudioBuffer {
  return makeClickTrack({
    bpm: options.bpm,
    durationSec: options.duration,
    sampleRate: options.sampleRate,
  });
}

export function generateAmplitudeEnvelope(options: {
  frequency: number;
  duration: number;
  startAmp: number;
  endAmp: number;
  sampleRate?: number;
}): EngineAudioBuffer {
  return makeAmplitudeRampSine({
    frequency: options.frequency,
    durationSec: options.duration,
    startAmp: options.startAmp,
    endAmp: options.endAmp,
    sampleRate: options.sampleRate,
  });
}

export function makeFeatureFrame(
  time: number,
  partial: Partial<AudioFeatureFrame> = {}
): AudioFeatureFrame {
  return {
    time,
    rms: 0,
    spectralFlux: 0,
    spectralCentroid: 0,
    bassEnergy: 0,
    lowMidEnergy: 0,
    midEnergy: 0,
    highMidEnergy: 0,
    highEnergy: 0,
    onsetStrength: 0,
    ...partial,
  };
}
